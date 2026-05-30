import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Redirect,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Response } from "express";
import type { User } from "@prisma/client";
import type { UserRole } from "@prisma/client";

import { CurrentUser } from "../rbac/current-user.decorator";
import { Roles } from "../rbac/roles.decorator";
import { Public } from "../rbac/public.decorator";
import { OAuth2Config, type OAuth2Provider } from "./oauth2.config";
import { OAuth2ConnectorService } from "./oauth2-connector.service";
import { ConfigService } from "@nestjs/config";

const OAUTH2_PROVIDERS: OAuth2Provider[] = ["gmail", "outlook", "slack"];

@Controller("connectors/oauth2")
export class OAuth2ConnectorController {
  constructor(
    private readonly oauth2Service: OAuth2ConnectorService,
    private readonly oauth2Config: OAuth2Config,
    private readonly config: ConfigService,
  ) {}

  /** GET /api/connectors/oauth2/providers — no auth required, used by frontend to show/hide buttons */
  @Public()
  @Get("providers")
  getProviders(): Record<OAuth2Provider, boolean> {
    return {
      gmail: this.oauth2Config.isConfigured("gmail"),
      outlook: this.oauth2Config.isConfigured("outlook"),
      slack: this.oauth2Config.isConfigured("slack"),
    };
  }

  /** GET /api/connectors/oauth2/start?provider=gmail — requires auth */
  @Roles() // any authenticated role
  @Get("start")
  start(
    @Query("provider") provider: string,
    @CurrentUser() user: User,
  ): { authorizationUrl: string } {
    if (!OAUTH2_PROVIDERS.includes(provider as OAuth2Provider)) {
      throw new BadRequestException("Unsupported provider");
    }
    if (!this.oauth2Config.isConfigured(provider as OAuth2Provider)) {
      throw new ServiceUnavailableException("OAuth2 not configured for this provider");
    }
    const authorizationUrl = this.oauth2Service.buildAuthorizationUrl(provider as OAuth2Provider, user.id);
    return { authorizationUrl };
  }

  /** GET /api/connectors/oauth2/callback — called by OAuth2 provider redirect */
  @Public()
  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") providerError: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "";

    if (providerError) {
      res.redirect(`${frontendUrl}/connectors?error=oauth2_denied`);
      return;
    }

    if (!code || !state) {
      res.redirect(`${frontendUrl}/connectors?error=oauth2_failed`);
      return;
    }

    try {
      await this.oauth2Service.handleCallback(code, state);
      res.redirect(`${frontendUrl}/connectors`);
    } catch {
      res.redirect(`${frontendUrl}/connectors?error=oauth2_failed`);
    }
  }
}
