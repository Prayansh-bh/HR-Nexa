import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { assertSubscriptionActive } from '../../common/tenant/tenant-validation.util';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { PermissionResolver } from './services/permission-resolver.service';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  companyId?: string;
  subscriptionId?: string;
  role: string;
  pv?: number;
  sv?: number;
  jti?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private prisma: PrismaService,
    private tokenBlacklistService: TokenBlacklistService,
    private permissionResolver: PermissionResolver,
  ) {
    const jwtSecret =
      process.env.JWT_SECRET || 'hrms_super_secret_jwt_key_2026_go_deepmind';

    if (
      !process.env.JWT_SECRET &&
      process.env.NODE_ENV === 'production'
    ) {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is mandatory in production mode.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      passReqToCallback: true,
    });
    this.logger.log('JwtStrategy initialized with Bearer token authentication');
  }

  async validate(req: Request, payload: JwtPayload) {
    const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    if (payload.jti && (await this.tokenBlacklistService.isBlacklisted(payload.jti))) {
      throw new UnauthorizedException('Token has been revoked');
    }
    if (rawToken && (await this.tokenBlacklistService.isBlacklisted(rawToken))) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { employee: true, company: { select: { name: true } }, subscription: true, roleRelation: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (
      user.status === 'Locked' ||
      user.status === 'Disabled' ||
      user.status === 'Inactive'
    ) {
      throw new UnauthorizedException('Account is locked or disabled');
    }

    if (user.role !== 'SuperAdmin') {
      try {
        assertSubscriptionActive(user.role, user.subscription);
      } catch (err: any) {
        this.logger.warn(
          `API request blocked: tenant is suspended/inactive for user ID ${user.id}`,
        );
        throw err;
      }
    }

    if (payload.pv !== undefined && user.permissionVersion !== payload.pv) {
      throw new UnauthorizedException(
        'Session expired due to role or permission updates.',
      );
    }

    if (payload.sv !== undefined && user.sessionVersion !== payload.sv) {
      throw new UnauthorizedException(
        'Session expired due to password reset or security revocation.',
      );
    }

    const permissions = await this.permissionResolver.resolve(user);

    let notificationPrefs = {};
    try {
      notificationPrefs = JSON.parse(user.notificationPrefs || '{}');
    } catch {
      // ignore
    }

    const companyId =
      user.role === 'SuperAdmin' ? 'PLATFORM' : user.companyId || null;
    const subscriptionId =
      user.role === 'SuperAdmin' ? null : user.subscriptionId || null;
    const companyName =
      user.company?.name || user.subscription?.company || null;

    return {
      ...user,
      companyId,
      subscriptionId,
      companyName,
      permissions,
      notificationPrefs,
      jti: payload.jti,
    };
  }
}
