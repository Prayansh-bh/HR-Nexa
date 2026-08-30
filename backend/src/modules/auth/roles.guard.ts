import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './role.enum';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ user?: { role?: Role } }>();
    const user = req.user;
    if (!user || !user.role) {
      return false;
    }
    const normUserRole = (user.role as string)
      .replace(/\s+/g, '')
      .toLowerCase();
    return requiredRoles.some(
      (r) => r.toString().replace(/\s+/g, '').toLowerCase() === normUserRole,
    );
  }
}
