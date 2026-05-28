import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../rbac/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuditService } from './audit.service';
import { AuditLogQueryParams } from '@auto8/shared';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('sales_approver')
  listLogs(
    @Query('resourceType') resourceType?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const query: AuditLogQueryParams = { resourceType, actorId, from, to };
    return this.auditService.listLogs(query, pagination);
  }

  @Get(':resourceType/:resourceId')
  @Roles('sales_approver')
  getResourceLogs(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.auditService.getResourceLogs(resourceType, resourceId);
  }
}
