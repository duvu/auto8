import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import * as XLSX from "xlsx";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import type {
  CatalogueUploadResult,
  PaginatedResponse,
  ProductView,
  UploadPreviewResult,
  UploadPreviewRow,
} from "@auto8/shared";
import { buildPaginatedResponse } from "../common/utils/paginate";
import { CreateProductDto } from "./dto/create-product.dto";
import { JobsService } from "../jobs/jobs.service";

function serializeProduct(p: {
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
    defaultMarkup: p.defaultMarkup ?? 0,
    categoryTags: p.categoryTags ?? [],
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
}

@Injectable()
export class CatalogueService {
  private readonly logger = new Logger(CatalogueService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly jobsService?: JobsService,
  ) {}

  async enqueueEmbeddingJob(catalogueId?: string): Promise<void> {
    if (!this.jobsService) return;
    await this.jobsService.enqueue("generate_embeddings", catalogueId ? { catalogueId } : {});
  }

  async upload(file: Express.Multer.File): Promise<CatalogueUploadResult> {
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
            basePrice:
              row["basePrice"] !== undefined
                ? isNaN(Number(row["basePrice"]))
                  ? null
                  : Number(row["basePrice"])
                : null,
            currency: row["currency"] ? String(row["currency"]) : "USD",
            defaultMarkup:
              row["defaultMarkup"] !== undefined
                ? isNaN(Number(row["defaultMarkup"]))
                  ? 0
                  : Number(row["defaultMarkup"])
                : 0,
          },
          update: {
            productName,
            description: row["description"] ? String(row["description"]) : undefined,
            brand: row["brand"] ? String(row["brand"]) : undefined,
            unit: row["unit"] ? String(row["unit"]) : undefined,
            basePrice: row["basePrice"] !== undefined ? Number(row["basePrice"]) : undefined,
            currency: row["currency"] ? String(row["currency"]) : undefined,
            ...(row["defaultMarkup"] !== undefined && { defaultMarkup: Number(row["defaultMarkup"]) }),
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
    if (imported > 0) {
      await this.enqueueEmbeddingJob(defaultCatalogue.id);
    }
    return { imported, skipped, errors };
  }

  async dryRunUpload(file: Express.Multer.File): Promise<UploadPreviewResult> {
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

    const previewRows: UploadPreviewRow[] = [];
    let createCount = 0;
    let updateCount = 0;
    let skipCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const productCode = String(row["productCode"] ?? row["product_code"] ?? "").trim();
      const productName = String(row["productName"] ?? row["product_name"] ?? "").trim();

      if (!productCode) {
        skipCount++;
        previewRows.push({
          row: i + 2,
          productCode: "",
          productName,
          action: "skip",
          reason: "missing productCode",
        });
        continue;
      }
      if (!productName) {
        skipCount++;
        previewRows.push({
          row: i + 2,
          productCode,
          productName: "",
          action: "skip",
          reason: "missing productName",
        });
        continue;
      }

      const existing = await this.prisma.product.findUnique({ where: { productCode } });
      if (existing) {
        updateCount++;
        previewRows.push({ row: i + 2, productCode, productName, action: "update" });
      } else {
        createCount++;
        previewRows.push({ row: i + 2, productCode, productName, action: "create" });
      }
    }

    return { rows: previewRows, createCount, updateCount, skipCount };
  }

  async findAll(
    q?: string,
    pagination?: PaginationQueryDto,
  ): Promise<PaginatedResponse<ProductView>> {
    const pag = pagination ?? new PaginationQueryDto();
    const skip = (pag.page - 1) * pag.limit;

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
      this.prisma.product.findMany({
        where,
        skip,
        take: pag.limit,
        orderBy: { productName: "asc" },
      }),
      this.prisma.product.count({ where }),
    ]);

    return buildPaginatedResponse(products.map(serializeProduct), total, pag);
  }

  async findOne(id: string): Promise<ProductView> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return serializeProduct(product);
  }

  async create(dto: CreateProductDto): Promise<ProductView> {
    const defaultCatalogue = await this.prisma.productCatalogue.upsert({
      where: { id: "default" },
      create: { id: "default", name: "Default Catalogue" },
      update: {},
    });

    const existing = await this.prisma.product.findUnique({
      where: { productCode: dto.productCode },
    });
    if (existing) {
      throw new ConflictException(`Product code '${dto.productCode}' already exists`);
    }

    const product = await this.prisma.product.create({
      data: {
        catalogueId: defaultCatalogue.id,
        productCode: dto.productCode,
        productName: dto.productName,
        description: dto.description ?? null,
        brand: dto.brand ?? null,
        unit: dto.unit ?? null,
        basePrice: dto.basePrice ?? null,
        currency: dto.currency ?? "USD",
        ...(dto.defaultMarkup !== undefined && { defaultMarkup: dto.defaultMarkup }),
      },
    });
    return serializeProduct(product);
  }

  async fullUpdate(id: string, dto: CreateProductDto): Promise<ProductView> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        productCode: dto.productCode,
        productName: dto.productName,
        description: dto.description ?? null,
        brand: dto.brand ?? null,
        unit: dto.unit ?? null,
        basePrice: dto.basePrice ?? null,
        currency: dto.currency ?? "USD",
        ...(dto.defaultMarkup !== undefined && { defaultMarkup: dto.defaultMarkup }),
      },
    });
    return serializeProduct(updated);
  }

  async reactivate(id: string): Promise<ProductView> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: true },
    });
    return serializeProduct(updated);
  }

  async exportCsv(): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { productCode: "asc" },
    });

    const header = "productCode,productName,description,brand,unit,basePrice,currency";
    const escape = (val: string | null | undefined): string => {
      if (val == null) return "";
      const s = String(val);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = products.map((p) =>
      [p.productCode, p.productName, p.description, p.brand, p.unit, p.basePrice, p.currency]
        .map((v) => escape(v != null ? String(v) : null))
        .join(",")
    );
    return [header, ...lines].join("\n");
  }

  async update(
    id: string,
    data: Partial<{
      productName: string;
      description: string;
      brand: string;
      unit: string;
      basePrice: number;
      currency: string;
      defaultMarkup: number;
      isActive: boolean;
    }>
  ): Promise<ProductView> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);
    const updated = await this.prisma.product.update({ where: { id }, data });
    return serializeProduct(updated);
  }

  async updateMarkup(id: string, defaultMarkup: number): Promise<ProductView> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { defaultMarkup },
    });
    return serializeProduct(updated);
  }

  async deactivate(id: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}
