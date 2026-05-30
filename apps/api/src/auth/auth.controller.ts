import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";

import type { UserView } from "@auto8/shared";

import { CurrentUser } from "../rbac/current-user.decorator";
import { CurrentWorkspaceId } from "../rbac/current-workspace-id.decorator";
import { Public } from "../rbac/public.decorator";
import { Roles } from "../rbac/roles.decorator";
import { AuthService } from "./auth.service";
import { AcceptInviteDto, InviteDto } from "./dto/invite.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

const IS_PROD = process.env["NODE_ENV"] === "production";

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie("access_token", { httpOnly: true, secure: IS_PROD, sameSite: "strict" });
  res.clearCookie("refresh_token", { httpOnly: true, secure: IS_PROD, sameSite: "strict" });
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ auth: { ttl: 300000, limit: 5 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const { accessToken, refreshToken } = await this.authService.login(dto.email, dto.password);
    setAuthCookies(res, accessToken, refreshToken);
    return { message: "ok" };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = req.cookies["refresh_token"] as string | undefined;
    if (!refreshToken) {
      res.status(HttpStatus.UNAUTHORIZED).json({ message: "No refresh token provided." });
      return { message: "unauthorized" };
    }
    const tokens = await this.authService.refresh(refreshToken);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { message: "ok" };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies["refresh_token"] as string | undefined;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    clearAuthCookies(res);
  }

  @Get("me")
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: UserView): Promise<UserView> {
    return user;
  }

  @Public()
  @Throttle({ auth: { ttl: 300000, limit: 5 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Throttle({ auth: { ttl: 300000, limit: 5 } })
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<{ message: string }> {
    await this.authService.register(dto.workspaceName, dto.email, dto.password);
    return { message: "Registration successful. Please verify your email." };
  }

  @Public()
  @Post("verify-email")
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.authService.verifyEmail(dto.token);
  }

  @Roles("admin", "super_admin")
  @Post("invite")
  @HttpCode(HttpStatus.NO_CONTENT)
  async invite(
    @Body() dto: InviteDto,
    @CurrentWorkspaceId() workspaceId: string,
  ): Promise<void> {
    await this.authService.sendInvite(dto.email, workspaceId);
  }

  @Public()
  @Post("invite/accept")
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const { accessToken, refreshToken } = await this.authService.acceptInvite(
      dto.token,
      dto.password,
      dto.name,
    );
    setAuthCookies(res, accessToken, refreshToken);
    return { message: "ok" };
  }
}
