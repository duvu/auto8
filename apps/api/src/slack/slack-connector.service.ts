import { createHmac, timingSafeEqual } from "node:crypto";

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Connector } from "@prisma/client";

import type { ConnectorTestResult, SlackRfqIntakeInput } from "@auto8/shared";

import type { ConnectorService, NormalizedRfqIntake } from "../connectors/connector.interface";
import { PrismaService } from "../prisma/prisma.service";
import { RfqIntakeService } from "../rfqs/rfq-intake.service";

type RequestHeaders = Record<string, string | string[] | undefined>;

export type SlackSyncSummary = {
  imported: number;
  skipped: number;
  failed: number;
  importedReferences: string[];
  errors: string[];
};

@Injectable()
export class SlackConnectorService implements ConnectorService {
  private readonly logger = new Logger(SlackConnectorService.name);

  constructor(
    private readonly rfqIntakeService: RfqIntakeService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  isConfigured(): boolean {
    return !!this.config.get<string>("SLACK_SIGNING_SECRET")?.trim();
  }

  async intakeSlack(input: SlackRfqIntakeInput, rawPayload: string, headers: RequestHeaders, connector?: Connector) {
    this.validateSlackIntake(input);
    if (connector) {
      this.verifySlackRequestForConnector(headers, rawPayload, connector);
    } else {
      this.verifySlackRequest(headers, rawPayload, input.workspaceId);
    }

    // Deduplication: check if a message with this ID was already processed
    if (input.messageId?.trim()) {
      const existing = await this.prisma.rfqIntake.findFirst({
        where: {
          slackMessageId: input.messageId.trim(),
          connectorId: connector ? connector.id : null,
        },
      });
      if (existing) {
        throw new ConflictException(`Slack message ${input.messageId} has already been processed.`);
      }
    }

    const normalized: NormalizedRfqIntake = {
      sourceType: "slack",
      sourceLabel: connector
        ? connector.label
        : input.channelName?.trim()
          ? `Slack / #${input.channelName.trim()}`
          : "Slack",
      senderEmail: this.normalizeOptionalEmail(input.submitterEmail),
      senderName: this.optionalString(input.submitterName),
      subject: input.subject.trim(),
      body: input.body.trim(),
      receivedAt: input.submittedAt,
      rawPayload,
      slackWorkspaceId: input.workspaceId.trim(),
      slackWorkspaceName: this.optionalString(input.workspaceName),
      slackChannelId: input.channelId.trim(),
      slackChannelName: this.optionalString(input.channelName),
      slackSubmitterId: input.submitterId.trim(),
      slackSubmitterName: this.optionalString(input.submitterName),
      slackSubmitterEmail: this.normalizeOptionalEmail(input.submitterEmail),
      slackMessageId: input.messageId?.trim() || null,
      connectorId: connector?.id,
    };

    const detail = await this.rfqIntakeService.createRfqFromIntake(normalized);

    // Send confirmation to channel
    const botToken = connector
      ? (JSON.parse(connector.credentialsJson) as Record<string, string>)["botToken"]
      : this.config.get<string>("SLACK_BOT_TOKEN")?.trim();
    await this.sendConfirmationWithToken(input.channelId.trim(), detail.reference, input.subject.trim(), botToken);

    return detail;
  }

  async testConnector(connector: Connector): Promise<ConnectorTestResult> {
    try {
      const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
      const botToken = creds["botToken"];
      if (!botToken) return { ok: false, error: "botToken not configured" };

      const response = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: { Authorization: `Bearer ${botToken}`, "Content-Type": "application/json" },
      });
      const data = (await response.json()) as { ok: boolean; team?: string; user?: string; error?: string };
      if (data.ok) {
        return { ok: true, detail: `${data.team ?? "unknown"}/${data.user ?? "unknown"}` };
      }
      return { ok: false, error: data.error ?? "unknown error" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  verifySlackRequestForConnector(headers: RequestHeaders, rawPayload: string, connector: Connector): void {
    const creds = JSON.parse(connector.credentialsJson) as Record<string, string>;
    const signingSecret = creds["signingSecret"];
    if (!signingSecret) {
      throw new UnauthorizedException("Connector signing secret not configured.");
    }
    this.verifyWithSecret(headers, rawPayload, signingSecret, "");
  }

  /**
   * Handle Slack Events API requests.
   * Supports url_verification challenge and event_callback for message events.
   */
  async handleEvent(
    body: Record<string, any>,
    rawPayload: string,
    headers: RequestHeaders
  ): Promise<{ challenge?: string; ok: boolean }> {
    // Handle url_verification challenge (no signature needed per Slack docs)
    if (body.type === "url_verification") {
      return { challenge: body.challenge, ok: true };
    }

    // For all other events, verify signature
    if (body.type === "event_callback") {
      const workspaceId = body.team_id ?? "";
      this.verifySlackRequest(headers, rawPayload, workspaceId);

      const event = body.event;

      if (event?.type === "message" && !event.bot_id && !event.subtype) {
        // Only process non-bot, non-subtype messages
        const input: SlackRfqIntakeInput = {
          workspaceId: body.team_id ?? "",
          workspaceName: body.team_domain ?? undefined,
          channelId: event.channel ?? "",
          channelName: event.channel_name ?? undefined,
          submitterId: event.user ?? "",
          submitterName: event.user_profile?.display_name ?? undefined,
          submitterEmail: event.user_profile?.email ?? undefined,
          messageId: event.ts ?? undefined,
          subject: this.extractSubjectFromMessage(event.text ?? ""),
          body: event.text ?? "",
          submittedAt: event.ts ? new Date(parseFloat(event.ts) * 1000).toISOString() : new Date().toISOString()
        };

        try {
          this.validateSlackIntake(input);
          await this.intakeFromEvent(input, rawPayload);
        } catch (error) {
          this.logger.warn(`Failed to process Slack event: ${(error as Error).message}`);
        }
      }

      return { ok: true };
    }

    return { ok: true };
  }

  /**
   * Process an intake from Events API (already verified).
   */
  private async intakeFromEvent(input: SlackRfqIntakeInput, rawPayload: string) {
    // Dedup
    if (input.messageId?.trim()) {
      const existing = await this.prisma.rfqIntake.findFirst({
        where: { slackMessageId: input.messageId.trim(), connectorId: null },
      });
      if (existing) {
        this.logger.debug(`Slack message ${input.messageId} already processed, skipping.`);
        return;
      }
    }

    const normalized: NormalizedRfqIntake = {
      sourceType: "slack",
      sourceLabel: input.channelName?.trim() ? `Slack / #${input.channelName.trim()}` : "Slack (Events API)",
      senderEmail: this.normalizeOptionalEmail(input.submitterEmail),
      senderName: this.optionalString(input.submitterName),
      subject: input.subject.trim(),
      body: input.body.trim(),
      receivedAt: input.submittedAt,
      rawPayload,
      slackWorkspaceId: input.workspaceId.trim(),
      slackWorkspaceName: this.optionalString(input.workspaceName),
      slackChannelId: input.channelId.trim(),
      slackChannelName: this.optionalString(input.channelName),
      slackSubmitterId: input.submitterId.trim(),
      slackSubmitterName: this.optionalString(input.submitterName),
      slackSubmitterEmail: this.normalizeOptionalEmail(input.submitterEmail),
      slackMessageId: input.messageId?.trim() || null
    };

      const detail = await this.rfqIntakeService.createRfqFromIntake(normalized);
      await this.sendConfirmationWithToken(input.channelId.trim(), detail.reference, input.subject.trim(), this.config.get<string>("SLACK_BOT_TOKEN")?.trim());

    return detail;
  }

  /**
   * Send a confirmation message to a Slack channel.
   * Requires SLACK_BOT_TOKEN to be configured.
   */
  private async sendConfirmation(channelId: string, rfqReference: string, subject: string): Promise<void> {
    const botToken = this.config.get<string>("SLACK_BOT_TOKEN")?.trim();
    await this.sendConfirmationWithToken(channelId, rfqReference, subject, botToken);
  }

  private async sendConfirmationWithToken(channelId: string, rfqReference: string, subject: string, botToken?: string): Promise<void> {
    if (!botToken) {
      this.logger.debug("SLACK_BOT_TOKEN not configured, skipping confirmation message.");
      return;
    }

    try {
      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${botToken}`
        },
        body: JSON.stringify({
          channel: channelId,
          text: `Your RFQ has been received and assigned reference *${rfqReference}*.\nSubject: ${subject}`
        })
      });

      if (!response.ok) {
        this.logger.warn(`Slack API returned ${response.status} when sending confirmation`);
      }

      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        this.logger.warn(`Slack API error sending confirmation: ${data.error}`);
      }
    } catch (error) {
      // Non-critical: log but don't fail the intake
      this.logger.warn(`Failed to send Slack confirmation: ${(error as Error).message}`);
    }
  }

  private extractSubjectFromMessage(text: string): string {
    // Take the first line as subject, truncated to 200 chars
    const firstLine = text.split("\n")[0]?.trim() ?? "(no subject)";
    return firstLine.length > 200 ? firstLine.slice(0, 200) + "..." : firstLine || "(no subject)";
  }

  private validateSlackIntake(input: SlackRfqIntakeInput) {
    if (
      !input.workspaceId?.trim() ||
      !input.channelId?.trim() ||
      !input.submitterId?.trim() ||
      !input.subject?.trim() ||
      !input.body?.trim() ||
      !input.submittedAt?.trim()
    ) {
      throw new BadRequestException(
        "Slack RFQ requires workspace, channel, submitter, subject, body, and submittedAt."
      );
    }

    if (Number.isNaN(Date.parse(input.submittedAt))) {
      throw new BadRequestException("submittedAt must be an ISO-8601 timestamp.");
    }
  }

  private verifySlackRequest(headers: RequestHeaders, rawPayload: string, workspaceId: string) {
    const signingSecret = this.config.get<string>("SLACK_SIGNING_SECRET")?.trim();

    if (!signingSecret) {
      throw new UnauthorizedException("Slack connector is not configured.");
    }

    const allowedWorkspaceIds = (this.config.get<string>("SLACK_ALLOWED_WORKSPACE_IDS") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (allowedWorkspaceIds.length > 0 && !allowedWorkspaceIds.includes(workspaceId.trim())) {
      throw new ForbiddenException("Slack workspace is not allowed.");
    }

    this.verifyWithSecret(headers, rawPayload, signingSecret, workspaceId);
  }

  private verifyWithSecret(headers: RequestHeaders, rawPayload: string, signingSecret: string, _workspaceId: string): void {
    const timestampHeader = this.readHeader(headers, "x-slack-request-timestamp");
    const signatureHeader = this.readHeader(headers, "x-slack-signature");

    if (!timestampHeader || !signatureHeader) {
      throw new UnauthorizedException("Slack signature headers are required.");
    }

    const timestamp = Number(timestampHeader);

    if (!Number.isInteger(timestamp)) {
      throw new UnauthorizedException("Slack request timestamp is invalid.");
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowInSeconds - timestamp) > 300) {
      throw new UnauthorizedException("Slack request timestamp is outside the allowed window.");
    }

    const expectedSignature = `v0=${createHmac("sha256", signingSecret)
      .update(`v0:${timestamp}:${rawPayload}`)
      .digest("hex")}`;

    const providedBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException("Slack request signature is invalid.");
    }
  }

  private readHeader(headers: RequestHeaders, name: string) {
    const value = headers[name.toLowerCase()] ?? headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private normalizeOptionalEmail(value: string | null | undefined) {
    return this.optionalString(value)?.toLowerCase() ?? null;
  }

  private optionalString(value: string | null | undefined) {
    return value?.trim() || null;
  }
}
