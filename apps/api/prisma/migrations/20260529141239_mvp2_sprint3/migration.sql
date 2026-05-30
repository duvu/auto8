-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "categoryTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "embedding" vector(1536);

-- CreateTable
CREATE TABLE "public"."CatalogueEnrichmentSuggestion" (
    "id" TEXT NOT NULL,
    "catalogueId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogueEnrichmentSuggestion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."CatalogueEnrichmentSuggestion" ADD CONSTRAINT "CatalogueEnrichmentSuggestion_catalogueId_fkey" FOREIGN KEY ("catalogueId") REFERENCES "public"."ProductCatalogue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
