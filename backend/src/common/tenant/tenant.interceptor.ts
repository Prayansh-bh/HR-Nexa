import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import {
  TenantContextService,
  PLATFORM_TENANT,
} from './tenant-context.service';
import { Role } from '../../modules/auth/role.enum';

interface AuthenticatedUser {
  id?: string;
  role?: string;
  subscriptionId?: string | null;
  companyId?: string | null;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser; companyId?: string }>();

    let companyId = PLATFORM_TENANT;
    let subscriptionId: string | null = null;
    let isSuperAdmin = false;

    if (req && req.user) {
      const user = req.user;
      isSuperAdmin = user.role === Role.SuperAdmin;

      if (isSuperAdmin) {
        companyId = PLATFORM_TENANT;
        subscriptionId = null;
      } else {
        if (!user.companyId || user.companyId === 'DEFAULT_COMPANY' || user.companyId === 'PLATFORM') {
          throw new ForbiddenException(
            'Tenant context (companyId) is required for this operation',
          );
        }
        companyId = user.companyId;
        subscriptionId = user.subscriptionId ?? null;
      }
      req.companyId = companyId;
    }

    return new Observable((observer) => {
      TenantContextService.run(
        { companyId, subscriptionId, isSuperAdmin },
        () => {
          this.tenantContextService.setContext(
            companyId,
            subscriptionId,
            isSuperAdmin,
          );
          next.handle().subscribe(observer);
        },
      );
    });
  }
}
