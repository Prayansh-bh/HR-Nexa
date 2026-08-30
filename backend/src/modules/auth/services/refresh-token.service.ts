import {
  Injectable,
  UnauthorizedException,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  assertSubscriptionActive,
  SubscriptionStatusCheck,
  getEffectivePermissions,
} from '../../../common/tenant/tenant-validation.util';
import { assertUserCanAuthenticate } from '../utils/account-eligibility.util';
import { randomUUID } from 'crypto';
import { TokenService } from './token.service';
import { UserRepository } from '../repositories/user.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenHashService } from './token-hash.service';
import { UserAgentParserService } from './user-agent.parser';

import { SystemConfigService } from '../../system/services/system-config.service';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private tokenService: TokenService,
    private userRepository: UserRepository,
    private prisma: PrismaService,
    private tokenHashService: TokenHashService,
    private userAgentParserService: UserAgentParserService,
    @Optional() private systemConfigService?: SystemConfigService,
  ) {}

  /**
   * Creates a new UserSession record in PostgreSQL (1 Login = 1 Session = 1 Token Family)
   */
  async createSession(
    userId: string,
    rawRefreshToken: string,
    userAgent?: string,
    ip?: string,
    existingFamilyId?: string,
  ): Promise<{ token: string; familyId: string; expiresAt: Date }> {
    const tokenHash = this.tokenHashService.hash(rawRefreshToken);
    const familyId = existingFamilyId || randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days TTL
    const metadata = this.userAgentParserService.parse(userAgent);

    const maxSessions = parseInt(process.env.MAX_ACTIVE_SESSIONS || '5', 10);

    // Enforce MAX_ACTIVE_SESSIONS inside transaction
    await this.prisma.$transaction(async (tx) => {
      const activeSessions = await tx.userSession.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (activeSessions.length >= maxSessions) {
        const overflowCount = activeSessions.length - maxSessions + 1;
        const sessionsToRevoke = activeSessions.slice(0, overflowCount);
        const idsToRevoke = sessionsToRevoke.map((s) => s.id);

        if (idsToRevoke.length > 0) {
          await tx.userSession.updateMany({
            where: { id: { in: idsToRevoke } },
            data: {
              revokedAt: new Date(),
              revokedReason: 'MAX_SESSIONS_EXCEEDED',
            },
          });
        }
      }

      await tx.userSession.create({
        data: {
          userId,
          familyId,
          tokenHash,
          sessionVersion: 1,
          ip: ip || null,
          userAgent: userAgent || null,
          browser: metadata.browser,
          os: metadata.os,
          deviceType: metadata.deviceType,
          expiresAt,
        },
      });
    });

    return { token: rawRefreshToken, familyId, expiresAt };
  }

  /**
   * Generates a raw refresh token and creates a session
   */
  async generateRefreshToken(
    userId: string,
    userAgent?: string,
    ip?: string,
  ): Promise<string> {
    const rawRefreshToken = randomUUID();
    await this.createSession(userId, rawRefreshToken, userAgent, ip);
    return rawRefreshToken;
  }

  /**
   * Rotates a refresh token inside an atomic Prisma transaction
   */
  async rotateRefreshToken(
    oldRefreshToken: string,
    userAgent?: string,
    ip?: string,
  ): Promise<{ access_token: string; refresh_token: string; user: Record<string, any> }> {
    const oldTokenHash = this.tokenHashService.hash(oldRefreshToken);

    // 1. Look up existing session record by tokenHash
    const existingSession = await this.prisma.userSession.findUnique({
      where: { tokenHash: oldTokenHash },
      include: { user: true },
    });

    // 2. Replay Attack Handling: If token missing or revoked
    if (!existingSession || existingSession.revokedAt || existingSession.expiresAt < new Date()) {
      if (existingSession?.familyId) {
        const policy = process.env.AUTH_REUSE_POLICY || 'FAMILY';
        this.logger.warn(
          `SECURITY ALERT: Replay attack detected for familyId: ${existingSession.familyId}, policy: ${policy}`,
        );

        await this.prisma.$transaction(async (tx) => {
          if (policy === 'ALL') {
            await tx.userSession.updateMany({
              where: { userId: existingSession.userId, revokedAt: null },
              data: { revokedAt: new Date(), revokedReason: 'REPLAY_ATTACK_DETECTED' },
            });
            await tx.user.update({
              where: { id: existingSession.userId },
              data: { sessionVersion: { increment: 1 } },
            });
          } else {
            // Default 'FAMILY' policy: Revoke only the compromised family lineage
            await tx.userSession.updateMany({
              where: { familyId: existingSession.familyId, revokedAt: null },
              data: { revokedAt: new Date(), revokedReason: 'REPLAY_ATTACK_DETECTED' },
            });
          }
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findById(existingSession.userId);
    assertUserCanAuthenticate(user);

    if (user.role !== 'SuperAdmin') {
      try {
        assertSubscriptionActive(
          user.role,
          user.subscription as SubscriptionStatusCheck,
        );
      } catch (err: any) {
        this.logger.warn(
          `Token rotation blocked: tenant is suspended/inactive for user ID ${user.id}`,
        );
        throw err;
      }
    }

    // Generate new token pair
    const newRawRefreshToken = randomUUID();
    const newTokenHash = this.tokenHashService.hash(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const metadata = this.userAgentParserService.parse(userAgent || existingSession.userAgent || undefined);

    // 3. Atomic Transaction: Revoke old token & insert rotated token in same family
    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.update({
        where: { id: existingSession.id },
        data: {
          revokedAt: new Date(),
          revokedReason: 'ROTATED',
        },
      });

      await tx.userSession.create({
        data: {
          userId: user.id,
          familyId: existingSession.familyId,
          tokenHash: newTokenHash,
          sessionVersion: user.sessionVersion,
          ip: ip || existingSession.ip || null,
          userAgent: userAgent || existingSession.userAgent || null,
          browser: metadata.browser,
          os: metadata.os,
          deviceType: metadata.deviceType,
          expiresAt: newExpiresAt,
          refreshCount: existingSession.refreshCount + 1,
        },
      });
    });

    // Permissions & Preferences resolution
    const rolePermissions = JSON.parse((user as any).roleRelation?.permissions || '[]');
    const permissions = await getEffectivePermissions(
      this.prisma,
      user.role,
      rolePermissions,
      user.subscription as any,
    );

    let notificationPrefs = {};
    try {
      notificationPrefs = JSON.parse((user as any).notificationPrefs || '{}');
    } catch {
      // ignore
    }

    const companyId =
      user.role === 'SuperAdmin'
        ? 'PLATFORM'
        : user.companyId || user.subscriptionId || null;

    const payload = {
      sub: user.id,
      companyId,
      role: user.role,
      pv: user.permissionVersion,
      sv: user.sessionVersion,
      jti: randomUUID(),
    };
    const sessionTimeoutMins = this.systemConfigService
      ? await this.systemConfigService.getConfiguredSessionTimeoutMins()
      : 30;
    const newAccessToken = this.tokenService.sign(payload as any, { expiresIn: `${sessionTimeoutMins}m` });

    return {
      access_token: newAccessToken,
      refresh_token: newRawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        initials: user.initials,
        subscriptionId: user.subscriptionId ?? null,
        companyId: user.companyId ?? null,
        status: user.status,
        permissions,
        notificationPrefs,
      },
    };
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.tokenHashService.hash(rawRefreshToken);
    await this.prisma.userSession
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
      })
      .catch(() => {});
  }

  async revokeAllUserSessions(userId: string, reason = 'REVOKED_BY_ADMIN'): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      });
      await tx.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
      });
    });
  }

  async getUserActiveSessions(userId: string, currentRefreshToken?: string) {
    const currentHash = currentRefreshToken ? this.tokenHashService.hash(currentRefreshToken) : null;
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      browser: s.browser || 'Unknown Browser',
      os: s.os || 'Unknown OS',
      deviceType: s.deviceType || 'Desktop',
      ip: s.ip || 'Unknown IP',
      isCurrentDevice: currentHash ? s.tokenHash === currentHash : false,
      issuedAt: s.issuedAt,
      lastActive: s.lastUsedAt,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
    });
    if (!session) return false;

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokedReason: 'REVOKED_BY_USER' },
    });
    return true;
  }

  async revokeOtherUserSessions(userId: string, currentRefreshToken?: string): Promise<number> {
    const currentHash = currentRefreshToken ? this.tokenHashService.hash(currentRefreshToken) : null;
    const whereCondition: any = {
      userId,
      revokedAt: null,
    };
    if (currentHash) {
      whereCondition.tokenHash = { not: currentHash };
    }

    const res = await this.prisma.userSession.updateMany({
      where: whereCondition,
      data: { revokedAt: new Date(), revokedReason: 'REVOKED_OTHER_DEVICES' },
    });
    return res.count;
  }
}
