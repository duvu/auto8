import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { ApiRequestLogInterceptor } from './api-request-log.interceptor';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  providers: [
    AuditService,
    ApiRequestLogInterceptor,
  ],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
