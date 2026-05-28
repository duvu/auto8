import {
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Roles } from "../rbac/roles.decorator";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import type { BackgroundJobView, PaginatedResponse } from "@auto8/shared";

@Controller("jobs")
export class JobsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles("admin" as never)
  async listJobs(
    @Query() pagination: PaginationQueryDto,
    @Query("status") status?: string,
    @Query("type") type?: string,
  ): Promise<PaginatedResponse<BackgroundJobView>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    };

    const [jobs, total] = await Promise.all([
      this.prisma.backgroundJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.backgroundJob.count({ where }),
    ]);

    return {
      data: jobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        payload: j.payload,
        attempts: j.attempts,
        maxAttempts: j.maxAttempts,
        errorMessage: j.errorMessage,
        nextRunAt: (j as { nextRunAt?: Date | null }).nextRunAt?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        hasMore: skip + jobs.length < total,
      },
    };
  }

  @Get(":id")
  @Roles("admin" as never)
  async getJob(@Param("id") id: string): Promise<BackgroundJobView> {
    const job = await this.prisma.backgroundJob.findUniqueOrThrow({
      where: { id },
    });
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      payload: job.payload,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorMessage: job.errorMessage,
      nextRunAt: (job as { nextRunAt?: Date | null }).nextRunAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}
