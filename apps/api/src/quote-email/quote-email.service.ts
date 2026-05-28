import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { QuoteEmailDraftView, QuoteEmailSendView, UpdateQuoteEmailInput } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SmartEmailGenerationService } from "./smart-email-generation.service";

@Injectable()
export class QuoteEmailService {
  private readonly logger = new Logger(QuoteEmailService.name);
  private transport: Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly smartEmailGeneration: SmartEmailGenerationService,
  ) {}

  async generateDraft(quoteId: string, autoSend: boolean): Promise<void> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        rfq: { include: { intake: true } },
      },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found.");
    }

    const rfqIntake = quote.rfq.intake;
    const recipientEmail = rfqIntake.senderEmail ?? "";

    const aiEnabled = this.config.get<boolean>("QUOTE_EMAIL_AI") === true;

    let subject = this.generateSubject(quote.rfq.reference, quote.customerName);
    let body = this.generateBody(quote, rfqIntake);

    if (aiEnabled) {
      const aiSubject = await this.smartEmailGeneration.generateSubject(quote, rfqIntake);
      if (aiSubject) subject = aiSubject;

      const aiIntro = await this.smartEmailGeneration.generateBodyIntro(quote, rfqIntake);
      if (aiIntro) {
        body = aiIntro + "\n\n" + this.generateBody(quote, rfqIntake);
      }
    }

    await this.prisma.quoteEmail.upsert({
      where: { quoteId },
      create: {
        quoteId,
        subject,
        body,
        recipientEmail,
        autoSend,
        status: "draft",
      },
      update: {
        subject,
        body,
        recipientEmail,
        autoSend,
      },
    });
  }

  async getDraft(quoteId: string): Promise<QuoteEmailDraftView> {
    const email = await this.prisma.quoteEmail.findUnique({
      where: { quoteId },
      include: {
        sends: {
          orderBy: { sentAt: "desc" },
        },
      },
    });

    if (!email) {
      throw new NotFoundException("Quote email draft not found.");
    }

    return this.serialize(email);
  }

  async updateDraft(quoteId: string, input: UpdateQuoteEmailInput): Promise<QuoteEmailDraftView> {
    const email = await this.prisma.quoteEmail.findUnique({
      where: { quoteId },
      include: { sends: true },
    });

    if (!email) {
      throw new NotFoundException("Quote email draft not found.");
    }

    const hasSentSuccessfully = email.sends.some((s) => s.status === "sent");
    if (hasSentSuccessfully) {
      throw new ConflictException("Cannot update email draft after a successful send.");
    }

    const updated = await this.prisma.quoteEmail.update({
      where: { quoteId },
      data: {
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.body !== undefined && { body: input.body }),
        ...(input.recipientEmail !== undefined && { recipientEmail: input.recipientEmail }),
      },
      include: {
        sends: { orderBy: { sentAt: "desc" } },
      },
    });

    const result = this.serialize(updated);
    this.auditService.log({ action: 'quote_email.update_draft', resourceType: 'quote_email', resourceId: quoteId, after: { subject: updated.subject, body: updated.body, recipientEmail: updated.recipientEmail } });
    return result;
  }

  async send(quoteId: string, actorId: string | null): Promise<QuoteEmailSendView> {
    const email = await this.prisma.quoteEmail.findUnique({
      where: { quoteId },
      include: { sends: true },
    });

    if (!email) {
      throw new NotFoundException("Quote email draft not found.");
    }

    const smtpHost = this.config.get<string>("SMTP_HOST");
    if (!smtpHost) {
      throw new InternalServerErrorException(
        "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables."
      );
    }

    const transport = this.getTransport();
    const from = this.config.get<string>("QUOTE_EMAIL_FROM") ?? this.config.get<string>("SMTP_USER") ?? "";
    const sentAt = new Date();

    try {
      await transport.sendMail({
        from,
        to: email.recipientEmail,
        subject: email.subject,
        text: email.body,
      });

      const send = await this.prisma.quoteEmailSend.create({
        data: {
          quoteEmailId: email.id,
          sentByUserId: actorId,
          recipientEmail: email.recipientEmail,
          status: "sent",
          sentAt,
        },
      });

      await this.prisma.quoteEmail.update({
        where: { id: email.id },
        data: { status: "sent" },
      });

      // Advance pipeline status to 'sent'
      const quote = await this.prisma.quote.findUnique({
        where: { id: quoteId },
        select: { rfqId: true },
      });
      if (quote?.rfqId) {
        const rfq = await this.prisma.rfq.findUnique({
          where: { id: quote.rfqId },
          select: { intakeId: true },
        });
        if (rfq?.intakeId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (this.prisma.rfqIntake as any).update({
            where: { id: rfq.intakeId },
            data: { rfqPipelineStatus: "sent" },
          });
        }
      }

      const sendResult = this.serializeSend(send);
      this.auditService.log({ actorId, action: 'quote_email.send', resourceType: 'quote_email', resourceId: quoteId, after: { status: 'sent', recipient: email.recipientEmail } });
      return sendResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send quote email for quoteId=${quoteId}: ${errorMessage}`);

      const send = await this.prisma.quoteEmailSend.create({
        data: {
          quoteEmailId: email.id,
          sentByUserId: actorId,
          recipientEmail: email.recipientEmail,
          status: "error",
          errorMessage,
          sentAt,
        },
      });

      await this.prisma.quoteEmail.update({
        where: { id: email.id },
        data: { status: "error" },
      });

      throw new InternalServerErrorException(`Failed to send email: ${errorMessage}`);
    }
  }

  private getTransport(): Transporter {
    if (this.transport) return this.transport;

    const smtpSecure = this.config.get<boolean>("SMTP_SECURE", true);

    this.transport = nodemailer.createTransport({
      host: this.config.get<string>("SMTP_HOST"),
      port: this.config.get<number>("SMTP_PORT") ?? 587,
      secure: smtpSecure,
      auth: {
        user: this.config.get<string>("SMTP_USER"),
        pass: this.config.get<string>("SMTP_PASS"),
      },
      tls: smtpSecure
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false },
    });

    return this.transport;
  }

  private generateSubject(reference: string, customerName: string): string {
    return `Quote ${reference} – ${customerName}`;
  }

  private generateBody(
    quote: {
      customerName: string;
      customerCompany: string;
      notes: string | null;
      lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
    },
    rfqIntake: { subject: string }
  ): string {
    const lineItemsText = quote.lineItems
      .map(
        (item, i) =>
          `${i + 1}. ${item.description} — Qty: ${item.quantity}, Unit Price: $${(item.unitPrice / 100).toFixed(2)}, Subtotal: $${((item.quantity * item.unitPrice) / 100).toFixed(2)}`
      )
      .join("\n");

    const total = quote.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    return [
      `Dear ${quote.customerName},`,
      "",
      `Thank you for your inquiry regarding: ${rfqIntake.subject}`,
      "",
      `We are pleased to provide the following quote for ${quote.customerCompany}:`,
      "",
      "--- Line Items ---",
      lineItemsText,
      "",
      `Total: $${(total / 100).toFixed(2)}`,
      "",
      ...(quote.notes ? [`Notes: ${quote.notes}`, ""] : []),
      "Please let us know if you have any questions.",
      "",
      "Best regards,",
      "The auto8 Team",
    ].join("\n");
  }

  private serialize(
    email: {
      id: string;
      quoteId: string;
      subject: string;
      body: string;
      recipientEmail: string;
      status: string;
      autoSend: boolean;
      createdAt: Date;
      updatedAt: Date;
      sends: Array<{
        id: string;
        status: string;
        sentAt: Date;
        sentByUserId: string | null;
        recipientEmail: string;
        errorMessage: string | null;
      }>;
    }
  ): QuoteEmailDraftView {
    return {
      id: email.id,
      quoteId: email.quoteId,
      subject: email.subject,
      body: email.body,
      recipientEmail: email.recipientEmail,
      status: email.status as "draft" | "sent" | "error",
      autoSend: email.autoSend,
      sends: email.sends.map(this.serializeSend),
      createdAt: email.createdAt.toISOString(),
      updatedAt: email.updatedAt.toISOString(),
    };
  }

  private serializeSend(send: {
    id: string;
    status: string;
    sentAt: Date;
    sentByUserId: string | null;
    recipientEmail: string;
    errorMessage: string | null;
  }): QuoteEmailSendView {
    return {
      id: send.id,
      status: send.status as "sent" | "error",
      sentAt: send.sentAt.toISOString(),
      sentByUserId: send.sentByUserId,
      recipientEmail: send.recipientEmail,
      errorMessage: send.errorMessage,
    };
  }
}
