import { Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { LlmService } from "../llm/llm.service";
import type { RfqExtractedItemView, RfqItemMatchView, RfqMatchGroupView } from "@auto8/shared";

function serializeMatch(match: {
  id: string;
  rfqExtractedItemId: string;
  productId: string | null;
  score: number;
  status: string;
  overrideDescription: string | null;
  overrideUnitPrice: number | null;
  createdAt: Date;
  product?: {
    id: string;
    productCode: string;
    productName: string;
    description: string | null;
    brand: string | null;
    unit: string | null;
    basePrice: number | null;
    currency: string;
    defaultMarkup?: number;
    categoryTags?: string[];
    isActive: boolean;
    createdAt: Date;
  } | null;
}): RfqItemMatchView {
  return {
    id: match.id,
    rfqExtractedItemId: match.rfqExtractedItemId,
    product: match.product
      ? {
          id: match.product.id,
          productCode: match.product.productCode,
          productName: match.product.productName,
          description: match.product.description,
          brand: match.product.brand,
          unit: match.product.unit,
          basePrice: match.product.basePrice,
          currency: match.product.currency,
          defaultMarkup: match.product.defaultMarkup ?? 0,
          categoryTags: match.product.categoryTags ?? [],
          isActive: match.product.isActive,
          createdAt: match.product.createdAt.toISOString(),
        }
      : null,
    score: match.score,
    status: match.status,
    overrideDescription: match.overrideDescription,
    overrideUnitPrice: match.overrideUnitPrice,
    createdAt: match.createdAt.toISOString(),
  };
}

@Injectable()
export class ItemMatchingService {
  private readonly logger = new Logger(ItemMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llmService: LlmService | null,
    @Optional() private readonly configService: ConfigService | null,
  ) {}

  private get similarityThreshold(): number {
    return parseFloat(
      this.configService?.get<string>("EMBEDDING_SIMILARITY_THRESHOLD") ?? "0.75"
    );
  }

  private async vectorSearch(
    queryText: string,
    limit: number,
  ): Promise<Array<{ productId: string; score: number }>> {
    if (!this.llmService) return [];
    const embedding = await this.llmService.embedText(queryText);
    if (!embedding) return [];

    const threshold = this.similarityThreshold;
    const vectorLiteral = `[${embedding.join(",")}]`;

    type VectorRow = { id: string; similarity: number };
    const rows = await this.prisma.$queryRaw<VectorRow[]>`
      SELECT id, (1 - (embedding <=> ${vectorLiteral}::vector)) AS similarity
      FROM "public"."Product"
      WHERE "isActive" = true
        AND embedding IS NOT NULL
        AND (1 - (embedding <=> ${vectorLiteral}::vector)) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({ productId: r.id, score: r.similarity }));
  }

  async matchItemsForRfq(rfqId: string): Promise<void> {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { extractedItems: true },
    });

    if (!rfq) throw new NotFoundException("RFQ not found.");
    if (!rfq.extractedItems || rfq.extractedItems.length === 0) return;

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
    });

    if (products.length === 0) return;

    for (const item of rfq.extractedItems) {
      const existingCount = await this.prisma.rfqItemMatch.count({
        where: { rfqExtractedItemId: item.id },
      });
      if (existingCount > 0) continue;

      const queryText = item.description ?? item.partNumber ?? "";
      if (!queryText) continue;

      let top3: Array<{ productId: string; score: number }> = [];

      const vectorResults = await this.vectorSearch(queryText, 3).catch(() => []);
      if (vectorResults.length > 0) {
        top3 = vectorResults;
        this.logger.debug(`Vector search for "${queryText}" → ${top3.length} hits`);
      } else {
        const tokens = queryText
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 2);

        if (tokens.length === 0) continue;

        const scored: Array<{ productId: string; score: number }> = [];
        for (const product of products) {
          const searchText = [product.productName, product.productCode, product.description ?? ""]
            .join(" ")
            .toLowerCase();
          const matchedTokens = tokens.filter((t) => searchText.includes(t));
          if (matchedTokens.length === 0) continue;
          scored.push({ productId: product.id, score: matchedTokens.length / tokens.length });
        }
        top3 = scored.sort((a, b) => b.score - a.score).slice(0, 3);
      }

      if (top3.length > 0) {
        await this.prisma.rfqItemMatch.createMany({
          data: top3.map((candidate) => ({
            rfqExtractedItemId: item.id,
            productId: candidate.productId,
            score: candidate.score,
            status: "pending",
          })),
        });
      }
    }
  }

  async getMatchesForRfq(rfqId: string): Promise<RfqMatchGroupView[]> {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: {
        extractedItems: {
          include: {
            matches: {
              include: { product: true },
              orderBy: { score: "desc" },
            },
          },
        },
      },
    });

    if (!rfq) throw new NotFoundException("RFQ not found.");

    return (rfq.extractedItems ?? []).map((item) => {
      const i = item as unknown as Record<string, unknown>;
      const extractedItem: RfqExtractedItemView = {
        id: i.id as string,
        rfqId,
        partNumber: (i.partNumber as string | null) ?? null,
        description: (i.description as string) ?? "",
        quantity: (i.quantity as number | null) ?? null,
        unit: (i.unit as string | null) ?? null,
        confidence: (i.confidence as number) ?? 0,
        confidenceReason: (i.confidenceReason as string | null) ?? null,
        createdAt: (i.createdAt as Date).toISOString(),
      };
      return {
        extractedItem,
        matches: ((i.matches as unknown[]) ?? []).map(
          serializeMatch as (m: unknown) => RfqItemMatchView
        ),
      };
    });
  }

  async updateMatch(
    matchId: string,
    action: "accept" | "override",
    overrideDescription?: string,
    overrideUnitPrice?: number,
  ): Promise<RfqItemMatchView> {
    const existing = await this.prisma.rfqItemMatch.findUnique({
      where: { id: matchId },
    });
    if (!existing) throw new NotFoundException("Match not found.");

    const updated = await this.prisma.rfqItemMatch.update({
      where: { id: matchId },
      data: {
        status: action === "accept" ? "accepted" : "overridden",
        overrideDescription: action === "override" ? (overrideDescription ?? null) : null,
        overrideUnitPrice: action === "override" ? (overrideUnitPrice ?? null) : null,
      },
      include: { product: true },
    });

    return serializeMatch(updated);
  }
}
