import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemConfigService } from '../../system/services/system-config.service';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const settings = await this.systemConfigService.getGlobalSettings();
    if (!settings.maintenanceMode) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const path = request.path || request.url || '';

    // Always allow system settings management, health checks, and essential admin routes
    if (
      path.includes('/system/settings') ||
      path.includes('/health') ||
      path.includes('/metrics')
    ) {
      return true;
    }

    // Allow authenticated SuperAdmin
    const user = request.user;
    if (user && user.role === 'SuperAdmin') {
      return true;
    }

    // Block non-SuperAdmin users during active maintenance
    throw new HttpException(
      {
        statusCode: 503,
        code: 'MAINTENANCE_MODE',
        message: 'HR NEXA is temporarily unavailable for maintenance.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
