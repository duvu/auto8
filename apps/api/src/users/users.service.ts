import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: [
        { role: "asc" },
        { name: "asc" }
      ]
    });
  }
}
