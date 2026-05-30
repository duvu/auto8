import * as crypto from "crypto";

import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QuoteStatus } from "@prisma/client";

import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";

export interface QuotePortalView {
  reference: string;
  customerName: string;
  customerCompany: string;
  lineItems: {
    description: string;
    qty: number;
    unitPrice: number;
    total: number;
    currency: string;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  currency: string;
  validUntil: string | null;
  notes: string | null;
}

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async createShareLink(quoteId: string): Promise<{ url: string; token: string }> {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.magicLinkToken.create({
      data: { token, quoteId, expiresAt },
    });

    const baseUrl = this.config.get<string>("FRONTEND_URL", "http://localhost:3000");
    return { url: `${baseUrl}/portal/q/${token}`, token };
  }

  async revokeShareLinks(quoteId: string): Promise<void> {
    await this.prisma.magicLinkToken.deleteMany({ where: { quoteId } });
  }

  private async validateToken(token: string) {
    const record = await this.prisma.magicLinkToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new NotFoundException("Link not found or expired");
    }
    return record;
  }

  async getQuoteData(token: string): Promise<QuotePortalView> {
    const record = await this.validateToken(token);

    const quote = await this.prisma.quote.findUnique({
      where: { id: record.quoteId },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!quote) throw new NotFoundException("Quote not found");

    const subtotal = quote.lineItems.reduce((s, li) => s + li.subtotal, 0);
    const validUntil = quote.validityDays
      ? new Date(quote.createdAt.getTime() + quote.validityDays * 86400000).toISOString()
      : null;

    return {
      reference: quote.id.slice(0, 8).toUpperCase(),
      customerName: quote.customerName,
      customerCompany: quote.customerCompany,
      lineItems: quote.lineItems.map((li) => ({
        description: li.description,
        qty: li.quantity,
        unitPrice: li.unitPrice,
        total: li.subtotal,
        currency: quote.currency,
      })),
      subtotal,
      discount: quote.discount,
      tax: quote.tax,
      grandTotal: quote.grandTotal ?? subtotal * (1 - quote.discount / 100) * (1 + quote.tax / 100),
      currency: quote.currency,
      validUntil,
      notes: quote.notes,
    };
  }

  async acceptQuote(token: string): Promise<void> {
    const record = await this.validateToken(token);
    await this.prisma.$transaction([
      this.prisma.quoteStatusEvent.create({
        data: { quoteId: record.quoteId, status: QuoteStatus.customer_accepted },
      }),
      this.prisma.quote.update({
        where: { id: record.quoteId },
        data: { status: QuoteStatus.customer_accepted },
      }),
      this.prisma.magicLinkToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  async rejectQuote(token: string, note?: string): Promise<void> {
    const record = await this.validateToken(token);
    await this.prisma.$transaction([
      this.prisma.quoteStatusEvent.create({
        data: { quoteId: record.quoteId, status: QuoteStatus.customer_rejected, note },
      }),
      this.prisma.quote.update({
        where: { id: record.quoteId },
        data: { status: QuoteStatus.customer_rejected },
      }),
      this.prisma.magicLinkToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  async requestRevision(token: string, note: string): Promise<void> {
    const record = await this.validateToken(token);
    await this.prisma.$transaction([
      this.prisma.quoteStatusEvent.create({
        data: { quoteId: record.quoteId, status: QuoteStatus.revision_requested, note },
      }),
      this.prisma.quote.update({
        where: { id: record.quoteId },
        data: { status: QuoteStatus.revision_requested },
      }),
      this.prisma.magicLinkToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.sendRevisionNotification(record.quoteId, note);
  }

  private async sendRevisionNotification(quoteId: string, note: string): Promise<void> {
    const notifyEmail = this.config.get<string>("RESEND_FROM_EMAIL", "noreply@auto8.dev");
    const rfqRef = quoteId.slice(0, 8).toUpperCase();
    await this.emailService.sendPortalRevisionNotification(notifyEmail, rfqRef, note);
  }
}
