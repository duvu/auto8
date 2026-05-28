import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { UserRole } from "@auto8/shared";
import { Roles } from "../rbac/roles.decorator";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { CatalogueService } from "./catalogue.service";

@Controller("catalogue")
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Roles("admin" as UserRole)
  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.catalogueService.upload(file);
  }

  @Get()
  async findAll(
    @Query("q") q?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    return this.catalogueService.findAll(q, pagination);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.catalogueService.findOne(id);
  }

  @Roles("admin" as UserRole)
  @Patch(":id")
  async update(@Param("id") id: string, @Body() data: Record<string, unknown>) {
    return this.catalogueService.update(id, data as Parameters<CatalogueService["update"]>[1]);
  }

  @Roles("admin" as UserRole)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Param("id") id: string) {
    return this.catalogueService.deactivate(id);
  }
}
