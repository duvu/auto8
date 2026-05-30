import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { CreateQuoteTemplateDto } from "./dto/create-quote-template.dto";
import { UpdateQuoteTemplateDto } from "./dto/update-quote-template.dto";
import { TemplateQueryDto } from "./dto/template-query.dto";

@Injectable()
export class QuoteTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateQuoteTemplateDto, createdById: string) {
    const { lineItems, ...rest } = dto;
    return this.prisma.quoteTemplate.create({
      data: {
        ...rest,
        createdById,
        lineItems: lineItems
          ? {
              create: lineItems.map((item, idx) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice ?? 0,
                sortOrder: item.sortOrder ?? idx,
                productId: item.productId,
              })),
            }
          : undefined,
      },
      include: { lineItems: true },
    });
  }

  async findAll(query: TemplateQueryDto) {
    const { q, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.quoteTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
      }),
      this.prisma.quoteTemplate.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const template = await this.prisma.quoteTemplate.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } }, createdBy: true },
    });
    if (!template) throw new NotFoundException(`QuoteTemplate ${id} not found`);
    return template;
  }

  async update(id: string, dto: UpdateQuoteTemplateDto) {
    await this.findOne(id);
    const { lineItems, ...rest } = dto;
    return this.prisma.quoteTemplate.update({
      where: { id },
      data: {
        ...rest,
        ...(lineItems !== undefined && {
          lineItems: {
            deleteMany: {},
            create: lineItems.map((item, idx) => ({
              description: item.description ?? "",
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice ?? 0,
              sortOrder: item.sortOrder ?? idx,
              productId: item.productId,
            })),
          },
        }),
      },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.quoteTemplateLineItem.deleteMany({ where: { templateId: id } });
    return this.prisma.quoteTemplate.delete({ where: { id } });
  }
}
