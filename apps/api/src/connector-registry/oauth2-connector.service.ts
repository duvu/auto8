import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";

import { PrismaService } from "../prisma/prisma.service";
import { OAuth2Config, type OAuth2Provider } from "./oauth2.config";
import { encrypt, isEncrypted } from "./crypto.util";

interface StatePayload {
  provider: OAuth2Provider;
  userId: string;
  nonce: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  bot_user_id?: string;
}

@Injectable()
export class OAuth2ConnectorService {
  private readonly logger = new Logger(OAuth2ConnectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly oauth2Config: OAuth2Config,
  ) {}

  buildAuthorizationUrl(provider: OAuth2Provider, userId: string): string {
    if (!this.oauth2Config.isConfigured(provider)) {
      throw new ServiceUnavailableException(`OAuth2 not configured for this provider`);
    }

    const state = this.jwtService.sign(
      { provider, userId, nonce: crypto.randomBytes(8).toString("hex") } satisfies StatePayload,
      { expiresIn: "5m" },
    );

    const clientId = this.oauth2Config.getClientId(provider)!;
    const callbackUrl = this.oauth2Config.getCallbackUrl();

    switch (provider) {
      case "gmail": {
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", callbackUrl);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly");
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "consent");
        url.searchParams.set("state", state);
        return url.toString();
      }
      case "outlook": {
        const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", callbackUrl);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", "Mail.Read offline_access");
        url.searchParams.set("state", state);
        return url.toString();
      }
      case "slack": {
        const url = new URL("https://slack.com/oauth/v2/authorize");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", callbackUrl);
        url.searchParams.set("scope", "channels:history,im:history,channels:read");
        url.searchParams.set("state", state);
        return url.toString();
      }
    }
  }

  async handleCallback(code: string, stateToken: string): Promise<void> {
    let payload: StatePayload;
    try {
      payload = this.jwtService.verify<StatePayload>(stateToken);
    } catch {
      throw new BadRequestException("Invalid or expired OAuth2 state parameter");
    }

    const { provider, userId } = payload;
    const tokens = await this.exchangeCode(provider, code);
    await this.upsertConnector(provider, userId, tokens);
  }

  private async exchangeCode(provider: OAuth2Provider, code: string): Promise<TokenResponse> {
    const clientId = this.oauth2Config.getClientId(provider)!;
    const clientSecret = this.oauth2Config.getClientSecret(provider)!;
    const callbackUrl = this.oauth2Config.getCallbackUrl();

    let tokenUrl: string;
    let body: Record<string, string>;

    switch (provider) {
      case "gmail": {
        tokenUrl = "https://oauth2.googleapis.com/token";
        body = {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        };
        break;
      }
      case "outlook": {
        tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
        body = {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
          scope: "Mail.Read offline_access",
        };
        break;
      }
      case "slack": {
        tokenUrl = "https://slack.com/api/oauth.v2.access";
        body = {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
        };
        break;
      }
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      this.logger.error(`Token exchange failed for ${provider}: ${response.status} ${text}`);
      throw new GatewayTimeoutException(`Token exchange failed for provider ${provider}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Slack wraps tokens
    if (provider === "slack") {
      const botToken = (data["bot_token"] as string | undefined) ?? (data["access_token"] as string | undefined);
      return { access_token: botToken ?? "" };
    }

    return data as unknown as TokenResponse;
  }

  private async upsertConnector(provider: OAuth2Provider, userId: string, tokens: TokenResponse): Promise<void> {
    const encKey = this.config.get<string>("CREDENTIALS_ENCRYPTION_KEY")?.trim() || undefined;

    const credentialsObj = provider === "gmail"
      ? { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? "", searchQuery: "is:unread" }
      : provider === "outlook"
        ? { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? "", maxResults: 50, markAsRead: true }
        : { botToken: tokens.access_token };

    let credentialsJson = JSON.stringify(credentialsObj);
    if (encKey && !isEncrypted(credentialsJson)) {
      credentialsJson = encrypt(credentialsJson, encKey);
    }

    const providerTypeMap: Record<OAuth2Provider, string> = { gmail: "gmail", outlook: "outlook", slack: "slack" };
    const type = providerTypeMap[provider];

    const existing = await this.prisma.connector.findFirst({ where: { type } });
    if (existing) {
      await this.prisma.connector.update({
        where: { id: existing.id },
        data: { credentialsJson, isEnabled: true, failureCount: 0, lastError: null },
      });
      this.logger.log(`Updated OAuth2 credentials for ${type} connector ${existing.id}`);
    } else {
      const providerLabel: Record<OAuth2Provider, string> = { gmail: "Gmail (OAuth2)", outlook: "Outlook (OAuth2)", slack: "Slack (OAuth2)" };
      await this.prisma.connector.create({
        data: { type, label: providerLabel[provider], credentialsJson, isEnabled: true },
      });
      this.logger.log(`Created OAuth2 connector for ${type}`);
    }
  }
}
