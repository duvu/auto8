import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogView, AuditLogQueryParams, PaginatedResponse } from '@auto8/shared';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { buildPaginatedResponse } from '../common/utils/paginate';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(params: {
    actorId?: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    before?: unknown;
    after?: unknown;
  }): void {
    this.prisma.auditLog
      .create({
        data: {
          actorId: params.actorId ?? null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          before: params.before !== undefined ? (params.before as object) : undefined,
          after: params.after !== undefined ? (params.after as object) : undefined,
        },
      })
      .catch((err: unknown) => {
        this.logger.error(`Failed to write AuditLog [${params.action}]: ${String(err)}`);
      });
  }

  async listLogs(
    query: AuditLogQueryParams,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<AuditLogView>> {
    const where = {
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const skip = (pagination.page - 1) * pagination.limit;

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(entries.map(this.serialize), total, pagination);
  }

  async getResourceLogs(resourceType: string, resourceId: string): Promise<AuditLogView[]> {
    const entries = await this.prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: 'desc' },
    });
    return entries.map(this.serialize);
  }

  private serialize(entry: {
    id: string;
    actorId: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    before: unknown;
    after: unknown;
    createdAt: Date;
  }): AuditLogView {
    return {
      id: entry.id,
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      before: entry.before ?? null,
      after: entry.after ?? null,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
