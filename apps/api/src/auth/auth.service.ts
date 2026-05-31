import * as crypto from "crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return this.issueTokenPair(user.id, user.role as string, user.workspaceId);
  }

  async refresh(refreshTokenPlaintext: string): Promise<TokenPair> {
    const tokenHash = sha256(refreshTokenPlaintext);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found or deactivated.");
    }

    return this.issueTokenPair(user.id, user.role as string, user.workspaceId);
  }

  async logout(refreshTokenPlaintext: string): Promise<void> {
    const tokenHash = sha256(refreshTokenPlaintext);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record) return; // no-op if not found
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(userId: string, role: string, workspaceId: string): Promise<TokenPair> {
    const accessToken = this.jwtService.sign({ sub: userId, role, workspaceId });

    const refreshPlaintext = crypto.randomBytes(32).toString("hex");
    const refreshHash = sha256(refreshPlaintext);

    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d");
    const refreshMs = this.parseDuration(refreshExpiresIn);
    const expiresAt = new Date(Date.now() + refreshMs);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: refreshPlaintext };
  }

  private parseDuration(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[unit] ?? 86400000);
  }

  async forgotPassword(email: string): Promise<void> {
    // Silent no-op if user not found (don't leak user existence)
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return;

    const plaintextToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(plaintextToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendUrl = this.config.get<string>("FRONTEND_URL", "http://localhost:3000");
    const resetLink = `${frontendUrl}/reset-password?token=${plaintextToken}`;

    await this.emailService.sendPasswordReset(email, resetLink);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = sha256(token);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired password reset token.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all active refresh tokens for the user
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async register(workspaceName: string, email: string, password: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already in use.");

    const slug = workspaceName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const existingWs = await this.prisma.workspace.findUnique({ where: { slug } });
    if (existingWs) throw new ConflictException("Workspace slug already taken.");

    const passwordHash = await bcrypt.hash(password, 12);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const workspace = await this.prisma.workspace.create({
      data: { name: workspaceName, slug },
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        name: email.split("@")[0],
        passwordHash,
        role: "admin",
        workspaceId: workspace.id,
        isEmailVerified: false,
      },
    });

    await this.prisma.subscription.create({
      data: {
        workspaceId: workspace.id,
        plan: "trial",
        status: "trialing",
        trialEndsAt,
      },
    });

    const plainToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.emailVerifyToken.create({
      data: { token: plainToken, userId: user.id, expiresAt },
    });

    const frontendUrl = this.config.get<string>("FRONTEND_URL", "http://localhost:3000");
    const verifyLink = `${frontendUrl}/verify-email?token=${plainToken}`;
    await this.emailService.sendEmailVerification(email, verifyLink);
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.emailVerifyToken.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired verification token.");
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { isEmailVerified: true },
      }),
      this.prisma.emailVerifyToken.delete({ where: { id: record.id } }),
    ]);
  }

  async sendInvite(email: string, workspaceId: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("User already exists.");

    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException("Workspace not found.");

    const plainToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.prisma.inviteToken.create({
      data: { token: plainToken, email, workspaceId, expiresAt },
    });

    const frontendUrl = this.config.get<string>("FRONTEND_URL", "http://localhost:3000");
    const inviteLink = `${frontendUrl}/invite?token=${plainToken}`;
    await this.emailService.sendInvite(email, inviteLink, workspace.name);
  }

  async acceptInvite(
    token: string,
    password: string,
    name?: string,
  ): Promise<TokenPair> {
    const record = await this.prisma.inviteToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired invite token.");
    }

    const existing = await this.prisma.user.findUnique({ where: { email: record.email } });
    if (existing) throw new ConflictException("User already exists.");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: record.email,
        name: name ?? record.email.split("@")[0],
        passwordHash,
        role: "quote_operator",
        workspaceId: record.workspaceId,
        isEmailVerified: true,
      },
    });

    await this.prisma.inviteToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return this.issueTokenPair(user.id, user.role, user.workspaceId);
  }

  async getSubscription(workspaceId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { workspaceId } });
    if (!sub) throw new NotFoundException("Subscription not found.");
    return sub;
  }
}
