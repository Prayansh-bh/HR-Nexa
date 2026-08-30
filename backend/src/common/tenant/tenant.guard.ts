import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../../modules/auth/role.enum';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantContextService: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: { role?: string; companyId?: string };
      headers?: Record<string, string>;
    }>();

    const user = req.user;
    if (!user) {
      return true; // Allow unauthenticated/public routes (AuthGuard handles authentication)
    }

    // SuperAdmin has platform-level multi-tenant privileges
    if (user.role === Role.SuperAdmin) {
      return true;
    }

    const userCompany = user.companyId;

    // Reject non-SuperAdmin requests missing a valid companyId
    if (!userCompany || userCompany === 'DEFAULT_COMPANY' || userCompany === 'PLATFORM') {
      throw new ForbiddenException(
        'Tenant context (companyId) is required for this operation',
      );
    }

    const currentTenant = this.tenantContextService.getCompanyId();

    // Block cross-company context manipulation
    if (
      currentTenant &&
      currentTenant !== 'PLATFORM' &&
      currentTenant !== userCompany
    ) {
      throw new ForbiddenException(
        'Cross-company data access strictly prohibited',
      );
    }

    return true;
  }
}
