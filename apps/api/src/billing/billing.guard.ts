import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BillingGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Skip if public route
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Skip if user not set (auth guard handles that)
    const user = (request as unknown as Record<string, unknown>)["user"] as { role?: string; workspaceId?: string } | undefined;
    if (!user) return true;

    // super_admin bypasses billing
    if (user.role === "super_admin") return true;

    const workspaceId = user.workspaceId;
    if (!workspaceId) return true;

    const sub = await this.prisma.subscription.findUnique({ where: { workspaceId } });
    if (!sub) return true; // No subscription record — allow (legacy/seed data)

    const now = new Date();
    if (sub.status === "active") return true;
    if (sub.status === "trialing" && sub.trialEndsAt > now) return true;

    throw new ForbiddenException(
      "Your subscription has expired. Please upgrade to continue using auto8.",
    );
  }
}
