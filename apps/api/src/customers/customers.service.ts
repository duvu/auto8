import { Injectable, NotFoundException } from "@nestjs/common";

import type { PaginatedResponse } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";
import { buildPaginatedResponse } from "../common/utils/paginate";
import type { CreateCustomerDto } from "./dto/create-customer.dto";
import type { UpdateCustomerDto } from "./dto/update-customer.dto";
import type { CustomerQueryDto } from "./dto/customer-query.dto";

export interface CustomerView {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  quoteCount?: number;
}

function serialize(c: {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { quotes: number };
}): CustomerView {
  return {
    id: c.id,
    companyName: c.companyName,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    address: c.address,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    quoteCount: c._count?.quotes,
  };
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto): Promise<CustomerView> {
    const customer = await this.prisma.customer.create({ data: dto });
    return serialize(customer);
  }

  async findAll(query: CustomerQueryDto): Promise<PaginatedResponse<CustomerView>> {
    const skip = (query.page - 1) * query.limit;
    const where = query.q
      ? {
          OR: [
            { companyName: { contains: query.q, mode: "insensitive" as const } },
            { contactName: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { companyName: "asc" },
        skip,
        take: query.limit,
        include: { _count: { select: { quotes: true } } },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return buildPaginatedResponse(customers.map(serialize), total, { page: query.page, limit: query.limit });
  }

  async findOne(id: string): Promise<CustomerView & { quotes: unknown[]; rfqs: unknown[] }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { quotes: true } },
        quotes: {
          select: {
            id: true,
            customerName: true,
            status: true,
            createdAt: true,
            grandTotal: true,
            currency: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        extractedCustomers: {
          select: {
            id: true,
            rfq: { select: { id: true, reference: true, createdAt: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!customer) throw new NotFoundException(`Customer ${id} not found.`);

    return {
      ...serialize(customer),
      quotes: customer.quotes,
      rfqs: customer.extractedCustomers.map((ec) => ec.rfq),
    };
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerView> {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Customer ${id} not found.`);
    const updated = await this.prisma.customer.update({ where: { id }, data: dto });
    return serialize(updated);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Customer ${id} not found.`);
    // Null out FKs on quotes, then delete
    await this.prisma.quote.updateMany({ where: { customerId: id }, data: { customerId: null } });
    await this.prisma.rfqExtractedCustomer.updateMany({ where: { customerId: id }, data: { customerId: null } });
    await this.prisma.customer.delete({ where: { id } });
  }

  async merge(primaryId: string, mergeIds: string[]): Promise<CustomerView> {
    const primary = await this.prisma.customer.findUnique({ where: { id: primaryId } });
    if (!primary) throw new NotFoundException(`Primary customer ${primaryId} not found.`);

    for (const id of mergeIds) {
      const existing = await this.prisma.customer.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException(`Customer ${id} not found.`);
      await this.prisma.quote.updateMany({ where: { customerId: id }, data: { customerId: primaryId } });
      await this.prisma.rfqExtractedCustomer.updateMany({ where: { customerId: id }, data: { customerId: primaryId } });
      await this.prisma.customer.delete({ where: { id } });
    }

    return this.findOne(primaryId);
  }
}
