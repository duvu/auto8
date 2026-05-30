import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type OAuth2Provider = "gmail" | "outlook" | "slack";

@Injectable()
export class OAuth2Config {
  constructor(private readonly config: ConfigService) {}

  isConfigured(provider: OAuth2Provider): boolean {
    return !!(this.getClientId(provider) && this.getClientSecret(provider));
  }

  getClientId(provider: OAuth2Provider): string | undefined {
    switch (provider) {
      case "gmail":   return this.config.get<string>("GOOGLE_CLIENT_ID")?.trim() || undefined;
      case "outlook": return this.config.get<string>("MICROSOFT_CLIENT_ID")?.trim() || undefined;
      case "slack":   return this.config.get<string>("SLACK_CLIENT_ID")?.trim() || undefined;
    }
  }

  getClientSecret(provider: OAuth2Provider): string | undefined {
    switch (provider) {
      case "gmail":   return this.config.get<string>("GOOGLE_CLIENT_SECRET")?.trim() || undefined;
      case "outlook": return this.config.get<string>("MICROSOFT_CLIENT_SECRET")?.trim() || undefined;
      case "slack":   return this.config.get<string>("SLACK_CLIENT_SECRET")?.trim() || undefined;
    }
  }

  getCallbackUrl(): string {
    const base =
      this.config.get<string>("OAUTH2_CALLBACK_BASE_URL")?.trim() ||
      this.config.get<string>("FRONTEND_URL")?.trim() ||
      "http://localhost:4000";
    return `${base}/api/connectors/oauth2/callback`;
  }
}
