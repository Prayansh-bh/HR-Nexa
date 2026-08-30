import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantInterceptor } from './tenant.interceptor';
import { TenantGuard } from './tenant.guard';

@Global()
@Module({
  providers: [TenantContextService, TenantInterceptor, TenantGuard],
  exports: [TenantContextService, TenantInterceptor, TenantGuard],
})
export class TenantModule {}
