import { Injectable } from "@nestjs/common";

import type { SlaConfigView, UpdateSlaConfigInput } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<SlaConfigView> {
    const config = await (this.prisma as unknown as {
      slaConfig: {
        findUnique: (args: unknown) => Promise<{ id: string; defaultResponseHours: number; warningThresholdHours: number; updatedAt: Date } | null>;
        create: (args: unknown) => Promise<{ id: string; defaultResponseHours: number; warningThresholdHours: number; updatedAt: Date }>;
      };
    }).slaConfig.findUnique({ where: { id: "default" } });

    if (config) {
      return {
        defaultResponseHours: config.defaultResponseHours,
        warningThresholdHours: config.warningThresholdHours,
        updatedAt: config.updatedAt.toISOString(),
      };
    }

    // Create default if not exists
    const created = await (this.prisma as unknown as {
      slaConfig: {
        create: (args: unknown) => Promise<{ id: string; defaultResponseHours: number; warningThresholdHours: number; updatedAt: Date }>;
      };
    }).slaConfig.create({ data: { id: "default" } });

    return {
      defaultResponseHours: created.defaultResponseHours,
      warningThresholdHours: created.warningThresholdHours,
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateConfig(input: UpdateSlaConfigInput): Promise<SlaConfigView> {
    const updated = await (this.prisma as unknown as {
      slaConfig: {
        upsert: (args: unknown) => Promise<{ id: string; defaultResponseHours: number; warningThresholdHours: number; updatedAt: Date }>;
      };
    }).slaConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        defaultResponseHours: input.defaultResponseHours ?? 24,
        warningThresholdHours: input.warningThresholdHours ?? 4,
      },
      update: {
        ...(input.defaultResponseHours !== undefined && { defaultResponseHours: input.defaultResponseHours }),
        ...(input.warningThresholdHours !== undefined && { warningThresholdHours: input.warningThresholdHours }),
      },
    });

    return {
      defaultResponseHours: updated.defaultResponseHours,
      warningThresholdHours: updated.warningThresholdHours,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async computeExpectedResponseBy(): Promise<Date> {
    const config = await this.getConfig();
    const now = new Date();
    return new Date(now.getTime() + config.defaultResponseHours * 60 * 60 * 1000);
  }
}
