import * as crypto from "crypto";
import * as nodemailer from "nodemailer";

import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

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

    return this.issueTokenPair(user.id, user.role as string);
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

    return this.issueTokenPair(user.id, user.role as string);
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

  private async issueTokenPair(userId: string, role: string): Promise<TokenPair> {
    const accessToken = this.jwtService.sign({ sub: userId, role });

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

    const smtpHost = this.config.get<string>("SMTP_HOST");
    if (!smtpHost) return; // no email transport configured, skip silently

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: this.config.get<number>("SMTP_PORT") ?? 587,
      auth: {
        user: this.config.get<string>("SMTP_USER"),
        pass: this.config.get<string>("SMTP_PASS"),
      },
    });

    await transport.sendMail({
      from: this.config.get<string>("SMTP_FROM", "noreply@auto8.dev"),
      to: email,
      subject: "Reset your password",
      text: `Click the link to reset your password: ${resetLink}\n\nThis link expires in 1 hour.`,
    });
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
}
