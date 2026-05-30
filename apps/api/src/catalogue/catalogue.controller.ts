import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { IsNumber, Min } from "class-validator";
import type { ConfirmEnrichmentInput, UserRole } from "@auto8/shared";
import { Roles } from "../rbac/roles.decorator";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { CatalogueService } from "./catalogue.service";
import { CatalogueEnrichmentService } from "./catalogue-enrichment.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

class UpdateMarkupDto {
  @IsNumber()
  @Min(0)
  defaultMarkup!: number;
}

@Controller("catalogue")
export class CatalogueController {
  constructor(
    private readonly catalogueService: CatalogueService,
    private readonly enrichmentService: CatalogueEnrichmentService,
  ) {}

  // ── Upload preview (must be BEFORE upload to avoid :id conflict) ──────────

  @Roles("admin" as UserRole)
  @Post("upload/preview")
  @UseInterceptors(FileInterceptor("file"))
  async uploadPreview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("A file is required.");
    return this.catalogueService.dryRunUpload(file);
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  @Roles("admin" as UserRole)
  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("A file is required.");
    return this.catalogueService.upload(file);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  @Roles("admin" as UserRole)
  @Get("export")
  async exportCsv(@Res() res: Response) {
    const csv = await this.catalogueService.exportCsv();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="catalogue.csv"');
    res.send(csv);
  }

  // ── List / Create ─────────────────────────────────────────────────────────

  @Get()
  async findAll(
    @Query("q") q?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    return this.catalogueService.findAll(q, pagination);
  }

  @Roles("admin" as UserRole)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto) {
    return this.catalogueService.create(dto);
  }

  // ── Single product ────────────────────────────────────────────────────────

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.catalogueService.findOne(id);
  }

  @Roles("admin" as UserRole)
  @Put(":id")
  async fullUpdate(@Param("id") id: string, @Body() dto: CreateProductDto) {
    return this.catalogueService.fullUpdate(id, dto);
  }

  @Roles("admin" as UserRole)
  @Patch(":id")
  async update(@Param("id") id: string, @Body() data: UpdateProductDto) {
    return this.catalogueService.update(id, data);
  }

  @Roles("admin" as UserRole)
  @Patch(":id/markup")
  async updateMarkup(@Param("id") id: string, @Body() dto: UpdateMarkupDto) {
    return this.catalogueService.updateMarkup(id, dto.defaultMarkup);
  }

  @Roles("admin" as UserRole)
  @Post(":id/reactivate")
  async reactivate(@Param("id") id: string) {
    return this.catalogueService.reactivate(id);
  }

  @Roles("admin" as UserRole)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Param("id") id: string) {
    return this.catalogueService.deactivate(id);
  }

  // ── Backfill embeddings ────────────────────────────────────────────────────

  @Roles("admin" as UserRole)
  @Post("backfill-embeddings")
  async backfillEmbeddings() {
    await this.catalogueService.enqueueEmbeddingJob();
    return { ok: true, message: "Embedding job enqueued for all products" };
  }

  // ── Enrichment ────────────────────────────────────────────────────────────

  @Roles("admin" as UserRole)
  @Post(":catalogueId/enrich")
  async triggerEnrichment(@Param("catalogueId") catalogueId: string) {
    return this.enrichmentService.triggerEnrichment(catalogueId);
  }

  @Roles("admin" as UserRole)
  @Get(":catalogueId/enrichment-preview")
  async getEnrichmentPreview(@Param("catalogueId") catalogueId: string) {
    return this.enrichmentService.getPreview(catalogueId);
  }

  @Roles("admin" as UserRole)
  @Post(":catalogueId/enrichment-confirm")
  async confirmEnrichment(
    @Param("catalogueId") catalogueId: string,
    @Body() input: ConfirmEnrichmentInput,
  ) {
    return this.enrichmentService.confirmEnrichment(catalogueId, input);
  }
}
