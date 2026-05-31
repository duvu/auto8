import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import * as Sentry from "@sentry/nestjs";
import { Request } from "express";

import type { UserRole } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Try cookie first, then fall back to Bearer header
    let token: string | undefined = request.cookies?.["access_token"] as string | undefined;

    if (!token) {
      const authHeader = request.headers["authorization"] as string | undefined;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      throw new UnauthorizedException("Authentication required.");
    }

    let payload: { sub: string; role: UserRole; workspaceId?: string };

    try {
      payload = this.jwtService.verify<{ sub: string; role: UserRole; workspaceId?: string }>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token.");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated.");
    }

    (request as Request & { user?: unknown }).user = user;
    if (payload.workspaceId) {
      (request as Request & { workspaceId?: string }).workspaceId = payload.workspaceId;
    }

    Sentry.setUser({ id: user.id, email: user.email });

    if (user.role === "admin" || user.role === "super_admin") {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    // No specific roles required — any authenticated user is allowed
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`This action requires one of the following roles: ${requiredRoles.join(", ")}.`);
    }

    return true;
  }
}
