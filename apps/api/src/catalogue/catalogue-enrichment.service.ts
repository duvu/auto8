import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { EnrichmentPreviewResponse, CatalogueEnrichmentSuggestionView, ConfirmEnrichmentInput } from "@auto8/shared";
import type { JobsService } from "../jobs/jobs.service";

@Injectable()
export class CatalogueEnrichmentService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly jobsService?: JobsService,
  ) {}

  async triggerEnrichment(catalogueId: string): Promise<{ ok: boolean; jobEnqueued: boolean }> {
    const catalogue = await this.prisma.productCatalogue.findUnique({ where: { id: catalogueId } });
    if (!catalogue) throw new NotFoundException(`Catalogue ${catalogueId} not found`);

    if (this.jobsService) {
      await this.jobsService.enqueue("catalogue_enrichment", { catalogueId });
      return { ok: true, jobEnqueued: true };
    }
    return { ok: true, jobEnqueued: false };
  }

  async getPreview(catalogueId: string): Promise<EnrichmentPreviewResponse> {
    const catalogue = await this.prisma.productCatalogue.findUnique({ where: { id: catalogueId } });
    if (!catalogue) throw new NotFoundException(`Catalogue ${catalogueId} not found`);

    const rows = await this.prisma.catalogueEnrichmentSuggestion.findMany({
      where: { catalogueId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    const pending: CatalogueEnrichmentSuggestionView[] = rows.map((r) => ({
      id: r.id,
      catalogueId: r.catalogueId,
      productCode: r.productCode,
      suggestions: r.suggestions as Record<string, unknown>,
      status: r.status as "pending" | "confirmed" | "dismissed",
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return { catalogueId, pending, total: pending.length };
  }

  async confirmEnrichment(catalogueId: string, input: ConfirmEnrichmentInput): Promise<{ confirmed: number }> {
    const catalogue = await this.prisma.productCatalogue.findUnique({ where: { id: catalogueId } });
    if (!catalogue) throw new NotFoundException(`Catalogue ${catalogueId} not found`);

    let confirmed = 0;
    for (const suggestionId of input.suggestionIds) {
      const suggestion = await this.prisma.catalogueEnrichmentSuggestion.findUnique({
        where: { id: suggestionId },
      });
      if (!suggestion || suggestion.catalogueId !== catalogueId) continue;

      const sugg = suggestion.suggestions as Record<string, unknown>;
      const categoryTags = Array.isArray(sugg["categoryTags"]) ? (sugg["categoryTags"] as string[]) : [];
      const improvedDescription = typeof sugg["improvedDescription"] === "string" ? sugg["improvedDescription"] : undefined;
      const brand = typeof sugg["brand"] === "string" ? sugg["brand"] : undefined;

      await this.prisma.product.updateMany({
        where: { productCode: suggestion.productCode, catalogueId },
        data: {
          ...(categoryTags.length > 0 && { categoryTags }),
          ...(improvedDescription && { description: improvedDescription }),
          ...(brand && { brand }),
        },
      });

      await this.prisma.catalogueEnrichmentSuggestion.update({
        where: { id: suggestionId },
        data: { status: "confirmed" },
      });
      confirmed++;
    }

    return { confirmed };
  }
}
