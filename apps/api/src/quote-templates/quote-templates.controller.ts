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
import type { User } from "@prisma/client";
import { CreateQuoteTemplateDto } from "./dto/create-quote-template.dto";
import { UpdateQuoteTemplateDto } from "./dto/update-quote-template.dto";
import { TemplateQueryDto } from "./dto/template-query.dto";
import { QuoteTemplatesService } from "./quote-templates.service";

@Controller("quote-templates")
export class QuoteTemplatesController {
  constructor(private readonly quoteTemplatesService: QuoteTemplatesService) {}

  @Post()
  create(@Body() dto: CreateQuoteTemplateDto, @CurrentUser() user: User) {
    return this.quoteTemplatesService.create(dto, user.id);
  }

  @Get()
  findAll(@Query() query: TemplateQueryDto) {
    return this.quoteTemplatesService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.quoteTemplatesService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateQuoteTemplateDto) {
    return this.quoteTemplatesService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.quoteTemplatesService.remove(id);
  }
}
