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
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CustomerQueryDto } from "./dto/customer-query.dto";
import { MergeCustomersDto } from "./dto/merge-customers.dto";
import { CustomersService } from "./customers.service";

@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto, @CurrentWorkspaceId() workspaceId?: string) {
    return this.customersService.create(dto, workspaceId ?? "default");
  }

  @Get()
  findAll(@Query() query: CustomerQueryDto, @CurrentWorkspaceId() workspaceId?: string) {
    return this.customersService.findAll(query, workspaceId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Roles("admin" as UserRole)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.customersService.remove(id);
  }

  @Post(":primaryId/merge")
  merge(@Param("primaryId") primaryId: string, @Body() dto: MergeCustomersDto) {
    return this.customersService.merge(primaryId, dto.mergeIds);
  }
}
