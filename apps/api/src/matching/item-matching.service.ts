import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RfqItemMatchView } from "@auto8/shared";

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
  constructor(private readonly prisma: PrismaService) {}

  async matchItemsForRfq(rfqId: string): Promise<void> {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { extractedItems: true },
    });

    if (!rfq) throw new NotFoundException("RFQ not found.");
    if (!rfq.extractedItems || rfq.extractedItems.length === 0) return;

    // Load all active products for matching
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
    });

    if (products.length === 0) return;

    for (const item of rfq.extractedItems) {
      // Skip if matches already exist for this item
      const existingCount = await this.prisma.rfqItemMatch.count({
        where: { rfqExtractedItemId: item.id },
      });
      if (existingCount > 0) continue;

      // Tokenize description for keyword matching
      const tokens = (item.description ?? item.partNumber ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2);

      if (tokens.length === 0) continue;

      // Score each product using term overlap
      const scored: Array<{ productId: string; score: number }> = [];
      for (const product of products) {
        const searchText = [
          product.productName,
          product.productCode,
          product.description ?? "",
        ]
          .join(" ")
          .toLowerCase();

        const matchedTokens = tokens.filter((t) => searchText.includes(t));
        if (matchedTokens.length === 0) continue;

        const score = matchedTokens.length / tokens.length;
        scored.push({ productId: product.id, score });
      }

      // Take top 3 candidates
      const top3 = scored.sort((a, b) => b.score - a.score).slice(0, 3);

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

  async getMatchesForRfq(rfqId: string): Promise<{ extractedItemId: string; description: string; matches: RfqItemMatchView[] }[]> {
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

    return (rfq.extractedItems ?? []).map((item) => ({
      extractedItemId: item.id,
      description: item.description,
      matches: (item.matches ?? []).map(serializeMatch),
    }));
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
        overrideDescription: action === "override" ? (overrideDescription ?? null) : undefined,
        overrideUnitPrice: action === "override" ? (overrideUnitPrice ?? null) : undefined,
      },
      include: { product: true },
    });

    return serializeMatch(updated);
  }
}
