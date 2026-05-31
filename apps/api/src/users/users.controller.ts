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

import type { UserRole } from "@auto8/shared";

import { Roles } from "../rbac/roles.decorator";
import { CurrentWorkspaceId } from "../rbac/current-workspace-id.decorator";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(
    @Query() pagination?: PaginationQueryDto,
    @CurrentWorkspaceId() workspaceId?: string,
  ) {
    return this.usersService.findAll(pagination, workspaceId);
  }

  @Roles("admin" as UserRole)
  @Post()
  async createUser(@Body() dto: CreateUserDto, @CurrentWorkspaceId() workspaceId?: string) {
    return this.usersService.create(dto, workspaceId ?? "default");
  }

  @Roles("admin" as UserRole)
  @Patch(":id")
  async updateUser(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Roles("admin" as UserRole)
  @Delete(":id")
  async deactivateUser(@Param("id") id: string) {
    return this.usersService.deactivate(id);
  }
}
