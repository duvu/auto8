import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    this.fromEmail = this.config.get<string>("RESEND_FROM_EMAIL", "noreply@auto8.dev");
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn("RESEND_API_KEY not set — email sending disabled");
    }
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) return;
    try {
      await this.resend.emails.send({ from: this.fromEmail, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${String(err)}`);
    }
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.send(
      to,
      "Reset your password",
      `<p>Click the link to reset your password:</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>This link expires in 1 hour.</p>`,
    );
  }

  async sendInvite(to: string, inviteUrl: string, workspaceName: string): Promise<void> {
    await this.send(
      to,
      `You've been invited to ${workspaceName} on auto8`,
      `<p>You've been invited to join <strong>${workspaceName}</strong> on auto8.</p>
<p><a href="${inviteUrl}">Accept invitation</a></p>
<p>This link expires in 7 days.</p>`,
    );
  }

  async sendEmailVerification(to: string, verifyUrl: string): Promise<void> {
    await this.send(
      to,
      "Verify your email address",
      `<p>Please verify your email address to activate your auto8 account:</p>
<p><a href="${verifyUrl}">Verify email</a></p>
<p>This link expires in 24 hours.</p>`,
    );
  }

  async sendPortalRevisionNotification(to: string, rfqRef: string, note: string): Promise<void> {
    await this.send(
      to,
      `Quote ${rfqRef} — Revision Requested`,
      `<p>A customer has requested a revision for quote <strong>${rfqRef}</strong>.</p>
<p><strong>Note:</strong> ${note}</p>`,
    );
  }
}
