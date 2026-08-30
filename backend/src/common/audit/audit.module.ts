import { Module, Global } from '@nestjs/common';
import { AuditLoggerService } from './audit-logger.service';
import { AuditInterceptor } from './audit.interceptor';
import { SystemModule } from '../../modules/system/system.module';

@Global()
@Module({
  imports: [SystemModule],
  providers: [AuditLoggerService, AuditInterceptor],
  exports: [AuditLoggerService, AuditInterceptor],
})
export class AuditModule {}
