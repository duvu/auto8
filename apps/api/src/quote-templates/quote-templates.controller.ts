import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";

import { CurrentUser } from "../rbac/current-user.decorator";
import { CurrentWorkspaceId } from "../rbac/current-workspace-id.decorator";
import { Roles } from "../rbac/roles.decorator";
import type { User } from "@prisma/client";
import { CreateQuoteTemplateDto } from "./dto/create-quote-template.dto";
import { UpdateQuoteTemplateDto } from "./dto/update-quote-template.dto";
import { TemplateQueryDto } from "./dto/template-query.dto";
import { QuoteTemplatesService } from "./quote-templates.service";

@Controller("quote-templates")
export class QuoteTemplatesController {
  constructor(private readonly quoteTemplatesService: QuoteTemplatesService) {}

  @Post()
  @Roles("admin")
  create(
    @Body() dto: CreateQuoteTemplateDto,
    @CurrentUser() user: User,
    @CurrentWorkspaceId() workspaceId: string,
  ) {
    return this.quoteTemplatesService.create(dto, user.id, workspaceId);
  }

  @Get()
  findAll(@Query() query: TemplateQueryDto, @CurrentWorkspaceId() workspaceId: string) {
    return this.quoteTemplatesService.findAll(query, workspaceId);
  }

  @Post(":id/duplicate")
  @Roles("admin")
  duplicate(@Param("id") id: string, @CurrentWorkspaceId() workspaceId: string) {
    return this.quoteTemplatesService.duplicate(id, workspaceId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentWorkspaceId() workspaceId: string) {
    return this.quoteTemplatesService.findOne(id, workspaceId);
  }

  @Patch(":id")
  @Roles("admin")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateQuoteTemplateDto,
    @CurrentWorkspaceId() workspaceId: string,
  ) {
    return this.quoteTemplatesService.update(id, dto, workspaceId);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@Param("id") id: string, @CurrentWorkspaceId() workspaceId: string) {
    return this.quoteTemplatesService.remove(id, workspaceId);
  }
}
