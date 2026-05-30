import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SetupStatusView } from "@auto8/shared";

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<SetupStatusView> {
    const [llmSetting, productCount, connectorCount, userCount] =
      await Promise.all([
        this.prisma.llmSetting.findUnique({ where: { id: "default" } }),
        this.prisma.product.count(),
        this.prisma.connector.count(),
        this.prisma.user.count(),
      ]);

    const llmConfigured =
      !!llmSetting && llmSetting.apiKey != null && llmSetting.apiKey.length > 0;
    const catalogueLoaded = productCount > 0;
    const connectorConfigured = connectorCount > 0;
    const teamMembersAdded = userCount > 1;

    return {
      llmConfigured,
      catalogueLoaded,
      connectorConfigured,
      teamMembersAdded,
      completed:
        llmConfigured &&
        catalogueLoaded &&
        connectorConfigured &&
        teamMembersAdded,
    };
  }
}
