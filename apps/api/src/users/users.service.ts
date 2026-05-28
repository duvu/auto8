import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import * as bcrypt from "bcrypt";

import type { PaginatedResponse, UserRole } from "@auto8/shared";
import type { UserView } from "@auto8/shared";

import { PrismaService } from "../prisma/prisma.service";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { buildPaginatedResponse } from "../common/utils/paginate";

interface CreateUserDto {
  email: string;
  name: string;
  role: UserRole;
  password: string;
}

interface UpdateUserDto {
  name?: string;
  role?: UserRole;
  password?: string;
  isActive?: boolean;
}

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}): UserView {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<UserView>> {
    const skip = (pagination.page - 1) * pagination.limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: [{ role: "asc" }, { name: "asc" }],
        skip,
        take: pagination.limit,
      }),
      this.prisma.user.count(),
    ]);
    return buildPaginatedResponse(users.map(serializeUser), total, pagination);
  }

  async create(dto: CreateUserDto): Promise<UserView> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`A user with email '${dto.email}' already exists.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        passwordHash,
        isActive: true,
      },
    });
    return serializeUser(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserView> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found.`);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.user.update({ where: { id }, data });
    return serializeUser(updated);
  }

  async deactivate(id: string): Promise<UserView> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found.`);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return serializeUser(updated);
  }

  // Legacy method kept for backward compatibility
  async listUsers(): Promise<UserView[]> {
    const result = await this.findAll();
    return result.data;
  }
}
