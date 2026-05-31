import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });
    if (!workspace) throw new NotFoundException("Workspace not found.");
    return workspace;
  }

  async update(id: string, data: { name?: string; slug?: string }) {
    return this.prisma.workspace.update({ where: { id }, data });
  }

  async create(data: { name: string; slug: string }) {
    return this.prisma.workspace.create({ data });
  }

  async findAll() {
    return this.prisma.workspace.findMany({ orderBy: { createdAt: "asc" } });
  }
}
