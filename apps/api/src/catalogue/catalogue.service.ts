import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import * as XLSX from "xlsx";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import type { CatalogueUploadResult, PaginatedResponse, ProductView } from "@auto8/shared";

function serializeProduct(p: {
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
  updatedAt: Date;
}): ProductView {
  return {
    id: p.id,
    productCode: p.productCode,
    productName: p.productName,
    description: p.description,
    brand: p.brand,
    unit: p.unit,
    basePrice: p.basePrice,
    currency: p.currency,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
}

@Injectable()
export class CatalogueService {
  private readonly logger = new Logger(CatalogueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async upload(file: Express.Multer.File): Promise<CatalogueUploadResult> {
    // Ensure a default catalogue exists to associate products with
    const defaultCatalogue = await this.prisma.productCatalogue.upsert({
      where: { id: "default" },
      create: { id: "default", name: "Default Catalogue" },
      update: {},
    });

    const mimeType = file.mimetype;
    const ext = file.originalname.split(".").pop()?.toLowerCase();

    let rows: Record<string, unknown>[] = [];

    if (ext === "csv" || mimeType === "text/csv") {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    } else if (
      ext === "xlsx" ||
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    } else {
      throw new BadRequestException("File must be .xlsx or .csv");
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const productCode = String(row["productCode"] ?? row["product_code"] ?? "").trim();
      const productName = String(row["productName"] ?? row["product_name"] ?? "").trim();

      if (!productCode) {
        skipped++;
        errors.push(`Row ${i + 2}: missing productCode`);
        continue;
      }

      if (!productName) {
        skipped++;
        errors.push(`Row ${i + 2}: missing productName`);
        continue;
      }

      try {
        await this.prisma.product.upsert({
          where: { productCode },
          create: {
            catalogueId: defaultCatalogue.id,
            productCode,
            productName,
            description: row["description"] ? String(row["description"]) : null,
            brand: row["brand"] ? String(row["brand"]) : null,
            unit: row["unit"] ? String(row["unit"]) : null,
            basePrice: row["basePrice"] !== undefined ? (isNaN(Number(row["basePrice"])) ? null : Number(row["basePrice"])) : null,
            currency: row["currency"] ? String(row["currency"]) : "USD",
          },
          update: {
            productName,
            description: row["description"] ? String(row["description"]) : undefined,
            brand: row["brand"] ? String(row["brand"]) : undefined,
            unit: row["unit"] ? String(row["unit"]) : undefined,
            basePrice: row["basePrice"] !== undefined ? Number(row["basePrice"]) : undefined,
            currency: row["currency"] ? String(row["currency"]) : undefined,
          },
        });
        imported++;
      } catch (err) {
        skipped++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${i + 2} (${productCode}): ${msg}`);
      }
    }

    this.logger.log(`Catalogue upload: imported=${imported}, skipped=${skipped}`);
    return { imported, skipped, errors };
  }

  async findAll(
    q?: string,
    pagination?: PaginationQueryDto,
  ): Promise<PaginatedResponse<ProductView>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = q
      ? {
          isActive: true,
          OR: [
            { productCode: { contains: q, mode: "insensitive" as const } },
            { productName: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : { isActive: true };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take: limit, orderBy: { productName: "asc" } }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map(serializeProduct),
      meta: { total, page, limit, hasMore: skip + products.length < total },
    };
  }

  async findOne(id: string): Promise<ProductView> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return serializeProduct(product);
  }

  async update(id: string, data: Partial<{
    productName: string;
    description: string;
    brand: string;
    unit: string;
    basePrice: number;
    currency: string;
    isActive: boolean;
  }>): Promise<ProductView> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);
    const updated = await this.prisma.product.update({ where: { id }, data });
    return serializeProduct(updated);
  }

  async deactivate(id: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}
