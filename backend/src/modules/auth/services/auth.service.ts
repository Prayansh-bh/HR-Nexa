import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  Logger,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { assertSubscriptionActive, getEffectivePermissions } from '../../../common/tenant/tenant-validation.util';
import { assertUserCanAuthenticate, assertUserCanImpersonate } from '../utils/account-eligibility.util';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { UserRepository } from '../repositories/user.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

import { User, Employee, Role } from '@prisma/client';

export type UserWithoutPassword = Omit<User, 'password'> & {
  employee?: Employee | null;
  roleRelation?: Role | null;
};

import { RefreshTokenService } from './refresh-token.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import * as crypto from 'crypto';
import { RbacService } from './rbac.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SystemConfigService } from '../../system/services/system-config.service';
import { EmailService } from '../../../email/email.service';
import { VerifyOtpDto, ResendOtpDto } from '../dto/otp.dto';
import {
  RequestSuperAdminEmailChangeDto,
  VerifySuperAdminEmailChangeDto,
} from '../dto/superadmin-email-change.dto';
import { TokenHashService } from './token-hash.service';
import { OutboxPublisherService } from '../../../common/queue/outbox-publisher.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userRepository: UserRepository,
    private passwordService: PasswordService,
    private tokenService: TokenService,
    private refreshTokenService: RefreshTokenService,
    private tokenBlacklistService: TokenBlacklistService,
    private passwordResetService: PasswordResetService,
    private emailVerificationService: EmailVerificationService,
    private rbacService: RbacService,
    private prisma: PrismaService,
    private systemConfigService: SystemConfigService,
    private emailService: EmailService,
    @Optional() private tokenHashService?: TokenHashService,
    @Optional() private outboxPublisher?: OutboxPublisherService,
    @Optional() private auditLogger?: AuditLoggerService,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<UserWithoutPassword | null> {
    const user = await this.userRepository.findByEmail(email);
    if (user && (await this.passwordService.compare(pass, user.password))) {
      const result: Partial<User & { employee?: Employee | null }> = {
        ...user,
      };
      delete result.password;
      return result as UserWithoutPassword;
    }
    return null;
  }

  async login(loginDto: LoginDto, userAgent?: string, ip?: string) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      this.logger.warn(`LOGIN_FAILED for email: ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const settings = await this.systemConfigService.getGlobalSettings();
    if (settings.maintenanceMode && user.role !== 'SuperAdmin') {
      this.logger.warn(`MAINTENANCE_MODE login blocked for user ID: ${user.id}`);
      throw new HttpException(
        {
          statusCode: 503,
          code: 'MAINTENANCE_MODE',
          message: 'HR NEXA is temporarily unavailable for maintenance.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    assertUserCanAuthenticate(user);

    // Tenant Isolation Guard: Verify company subscription status for non-SuperAdmin users
    let subscription: any = null;
    if (user.role !== 'SuperAdmin') {
      if (!user.subscriptionId) {
        throw new UnauthorizedException(
          'User account is not linked to any active company subscription.',
        );
      }

      subscription = await this.prisma.subscription.findUnique({
        where: { id: user.subscriptionId },
      });

      try {
        assertSubscriptionActive(user.role, subscription);
      } catch (err: any) {
        this.logger.warn(
          `Suspended/inactive tenant access attempt denied for email: ${loginDto.email}`,
        );
        throw err;
      }
    }

    // 2FA / OTP Challenge Check
    if (settings.requireOtpLogin === true) {
      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const challengeToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await this.prisma.$transaction(async (tx) => {
        await tx.otpChallenge.create({
          data: {
            challengeToken,
            userId: user.id,
            otpHash,
            expiresAt,
            status: 'PENDING',
            ip: ip || null,
            userAgent: userAgent || null,
          },
        });

        if (this.outboxPublisher) {
          await this.outboxPublisher.publishEmail(tx, {
            to: user.email,
            subject: 'HR NEXA — Verification OTP',
            body: `Verification OTP: ${otp}`,
            companyId: user.companyId || 'PLATFORM',
            actor: { id: user.id, role: user.role || 'Employee' },
          });
        }
      });

      if (!this.outboxPublisher) {
        this.emailService.sendOtpEmail(user.email, otp).catch((err) => {
          this.logger.warn(`Failed to send OTP email to ${user.email}: ${err.message}`);
        });
      }

      this.logger.log(`OTP_CHALLENGE_CREATED for user ID: ${user.id} (${user.email})`);

      return {
        requiresOtp: true,
        challengeToken,
        expiresAt: expiresAt.toISOString(),
      };
    }

    return this.generateAuthResponse(user, subscription, userAgent, ip);
  }

  private async generateAuthResponse(
    user: any,
    subscription: any,
    userAgent?: string,
    ip?: string,
  ) {
    // Update user status to Active on successful login (non-blocking fire-and-forget)
    void this.userRepository
      .updateUser(user.id, { status: 'Active' })
      .catch((err) =>
        this.logger.warn(
          `Asynchronous status update failed for user ID ${user.id}: ${err.message}`,
        ),
      );

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
    };
    const sessionTimeoutMins = await this.systemConfigService.getConfiguredSessionTimeoutMins();
    const accessToken = this.tokenService.sign(payload, { expiresIn: `${sessionTimeoutMins}m` });
    const refreshToken = await this.refreshTokenService.generateRefreshToken(
      user.id,
      userAgent,
      ip,
    );

    // Dynamically retrieve permissions from the user's roleRelation
    const rolePermissions = JSON.parse(user.roleRelation?.permissions || '[]');
    const permissions = await getEffectivePermissions(
      this.prisma,
      user.role,
      rolePermissions,
      subscription,
    );

    let notificationPrefs = {};
    try {
      notificationPrefs = JSON.parse(user.notificationPrefs || '{}');
    } catch {
      // ignore malformed JSON
    }

    this.logger.log(`LOGIN_SUCCESS for user ID: ${user.id} (${user.email})`);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        initials: user.initials,
        employeeId: user.employee?.id || null,
        avatar: user.employee?.avatar || null,
        subscriptionId: user.subscriptionId ?? null,
        companyId: user.companyId ?? null,
        companyName: user.company?.name || subscription?.company || user.subscription?.company || null,
        status: 'Active',
        permissions,
        notificationPrefs,
      },
    };
  }

  async verifyOtp(dto: VerifyOtpDto, userAgent?: string, ip?: string) {
    return this.prisma.$transaction(async (tx) => {
      const challenge = await tx.otpChallenge.findUnique({
        where: { challengeToken: dto.challengeToken },
      });

      if (!challenge) {
        throw new UnauthorizedException('Invalid or expired OTP challenge.');
      }

      if (challenge.status === 'LOCKED') {
        throw new UnauthorizedException(
          'OTP challenge is locked due to too many failed attempts. Please request a new code.',
        );
      }

      if (challenge.status === 'VERIFIED') {
        throw new UnauthorizedException('OTP has already been verified.');
      }

      if (challenge.status === 'EXPIRED' || challenge.expiresAt < new Date()) {
        if (challenge.status !== 'EXPIRED') {
          await tx.otpChallenge.update({
            where: { id: challenge.id },
            data: { status: 'EXPIRED' },
          });
        }
        throw new UnauthorizedException('OTP has expired. Please request a new code.');
      }

      const inputHash = crypto.createHash('sha256').update(dto.otp).digest('hex');
      if (inputHash !== challenge.otpHash) {
        const nextAttempts = challenge.attempts + 1;
        const isLocked = nextAttempts >= challenge.maxAttempts;
        await tx.otpChallenge.update({
          where: { id: challenge.id },
          data: {
            attempts: nextAttempts,
            status: isLocked ? 'LOCKED' : 'PENDING',
          },
        });
        if (isLocked) {
          throw new UnauthorizedException(
            'OTP challenge is locked due to too many failed attempts. Please request a new code.',
          );
        }
        throw new UnauthorizedException('Invalid OTP. Please check the code and try again.');
      }

      // Mark verified atomically
      await tx.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
        },
      });

      const user = await tx.user.findUnique({
        where: { id: challenge.userId },
        include: { employee: true, roleRelation: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      let subscription: any = null;
      if (user.role !== 'SuperAdmin' && user.subscriptionId) {
        subscription = await tx.subscription.findUnique({
          where: { id: user.subscriptionId },
        });
      }

      this.logger.log(`OTP_VERIFIED for user ID: ${user.id} (${user.email})`);
      return this.generateAuthResponse(user, subscription, userAgent, ip);
    });
  }

  async resendOtp(dto: ResendOtpDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.otpChallenge.findUnique({
        where: { challengeToken: dto.challengeToken },
      });

      if (!existing) {
        throw new UnauthorizedException('Invalid challenge token.');
      }

      if (existing.status === 'VERIFIED') {
        throw new BadRequestException('Challenge has already been verified.');
      }

      // Invalidate old challenge
      await tx.otpChallenge.update({
        where: { id: existing.id },
        data: { status: 'EXPIRED' },
      });

      const user = await tx.user.findUnique({
        where: { id: existing.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const newChallengeToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await tx.otpChallenge.create({
        data: {
          challengeToken: newChallengeToken,
          userId: user.id,
          otpHash,
          expiresAt,
          status: 'PENDING',
          ip: existing.ip,
          userAgent: existing.userAgent,
        },
      });

      this.emailService.sendOtpEmail(user.email, otp).catch((err) => {
        this.logger.warn(`Failed to resend OTP email to ${user.email}: ${err.message}`);
      });

      this.logger.log(`OTP_RESENT for user ID: ${user.id} (${user.email})`);

      return {
        requiresOtp: true,
        challengeToken: newChallengeToken,
        expiresAt: expiresAt.toISOString(),
      };
    });
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findByEmail(
      registerDto.email,
    );
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Enforce: only ONE SuperAdmin is allowed on the entire platform
    if (registerDto.role === 'SuperAdmin') {
      const superAdminCount =
        await this.userRepository.countByRole('SuperAdmin');
      if (superAdminCount >= 1) {
        throw new ForbiddenException(
          'Only one Super Admin is allowed on the platform.',
        );
      }
    }

    const settings = await this.systemConfigService.getGlobalSettings();
    this.passwordService.validatePasswordPolicy(
      registerDto.password,
      settings.strictPasswordPolicy,
    );

    const hashedPassword = await this.passwordService.hash(
      registerDto.password,
    );

    // Resolve db roleId for the assigned role
    const dbRole = await this.prisma.role.findFirst({
      where: { name: registerDto.role },
    });

    const user = await this.userRepository.createUser({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
      role: registerDto.role,
      roleId: dbRole?.id || null,
      initials:
        registerDto.initials ||
        registerDto.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .substring(0, 2),
    });

    const result: Partial<User> = { ...user };
    delete result.password;
    return result as UserWithoutPassword;
  }

  async refresh(refreshToken: string, userAgent?: string, ip?: string) {
    return this.refreshTokenService.rotateRefreshToken(refreshToken, userAgent, ip);
  }

  async logout(accessToken?: string, refreshToken?: string, userId?: string) {
    if (accessToken) {
      await this.tokenBlacklistService.blacklistToken(accessToken);
    }
    if (refreshToken) {
      await this.refreshTokenService.revokeRefreshToken(refreshToken);
    }
    if (userId) {
      const user = await this.userRepository.findById(userId);
      if (user && user.status === 'Active') {
        await this.userRepository.updateUser(userId, { status: 'Logged Out' });
      }
    }
    this.logger.log(`LOGOUT completed for user ID: ${userId || 'unknown'}`);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    return this.passwordResetService.requestPasswordReset(email);
  }

  async resetPassword(resetToken: string, newPass: string) {
    return this.passwordResetService.resetPassword(resetToken, newPass);
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await this.passwordService.compare(
      currentPass,
      user.password,
    );
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const settings = await this.systemConfigService.getGlobalSettings();
    this.passwordService.validatePasswordPolicy(
      newPass,
      settings.strictPasswordPolicy,
    );

    const hashedPassword = await this.passwordService.hash(newPass);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          sessionVersion: { increment: 1 },
        },
      });
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_CHANGED' },
      });
    });

    this.logger.log(`PASSWORD_CHANGED for user ID: ${userId}`);
    return { message: 'Password changed successfully' };
  }

  /**
   * SuperAdmin Email Change — Step 1: Request Email Change
   * Strictly verifies caller is SuperAdmin, verifies current password, normalizes new email,
   * checks uniqueness across all accounts, creates an OtpChallenge bound to the new email,
   * and sends a 6-digit OTP code to the new email address.
   */
  async requestSuperAdminEmailChange(
    superAdminUser: any,
    dto: RequestSuperAdminEmailChangeDto,
    ip?: string,
    userAgent?: string,
  ): Promise<{ message: string; challengeToken: string; newEmail: string }> {
    if (!superAdminUser || superAdminUser.role !== 'SuperAdmin') {
      throw new ForbiddenException('Access Denied: Only platform SuperAdmin can perform this operation.');
    }

    const currentUserId = superAdminUser.id;
    const user = await this.userRepository.findById(currentUserId);
    if (!user || user.role !== 'SuperAdmin') {
      throw new ForbiddenException('Access Denied: SuperAdmin account not found.');
    }

    // 1. Verify current password
    const isPasswordValid = await this.passwordService.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect.');
    }

    // 2. Normalize and validate requested new email
    const normalizedNewEmail = dto.newEmail.trim().toLowerCase();
    if (normalizedNewEmail === user.email.trim().toLowerCase()) {
      throw new BadRequestException('New email address must be different from current email address.');
    }

    // 3. Check uniqueness across all users
    const existingUser = await this.userRepository.findByEmail(normalizedNewEmail);
    if (existingUser && existingUser.id !== currentUserId) {
      throw new ConflictException('An account with this email address already exists.');
    }

    // 4. Invalidate any existing pending email change challenges for this user
    await this.prisma.otpChallenge.updateMany({
      where: {
        userId: currentUserId,
        status: { startsWith: 'PENDING_EMAIL_CHANGE' },
      },
      data: { status: 'EXPIRED' },
    });

    // 5. Generate secure random OTP (6 digits) and cryptographic challenge token
    const otp = crypto.randomInt(100000, 1000000).toString();
    const tokenHashService = this.tokenHashService || new TokenHashService();
    const otpHash = tokenHashService.hash(normalizedNewEmail + ':' + otp);
    const challengeToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

    // 6. Create OtpChallenge bound to user and target email
    await this.prisma.otpChallenge.create({
      data: {
        challengeToken,
        userId: currentUserId,
        otpHash,
        expiresAt,
        status: `PENDING_EMAIL_CHANGE:${normalizedNewEmail}`,
        attempts: 0,
        maxAttempts: 5,
        ip: ip || null,
        userAgent: userAgent || null,
      },
    });

    // 7. Dispatch verification email to NEW email address via existing EmailService
    try {
      await this.emailService.sendEmailChangeVerificationEmail(
        normalizedNewEmail,
        otp,
        15,
      );
    } catch (emailErr: any) {
      this.logger.error(
        `Failed to send email change verification code to ${normalizedNewEmail}: ${emailErr.message}`,
        emailErr.stack,
      );
    }

    this.logger.log(`SuperAdmin email change OTP challenge created for user ID: ${currentUserId} -> ${normalizedNewEmail}`);

    return {
      message: 'Verification code sent to your new email address. Please check your inbox to complete the change.',
      challengeToken,
      newEmail: normalizedNewEmail,
    };
  }

  /**
   * SuperAdmin Email Change — Step 2: Verify OTP & Execute Atomic Update
   * Re-verifies SuperAdmin caller, verifies challenge token and OTP against stored target email,
   * re-checks email uniqueness, atomically updates User.email in a Prisma transaction,
   * consumes the challenge, increments sessionVersion, revokes all active sessions,
   * and records an audit log.
   */
  async verifySuperAdminEmailChange(
    superAdminUser: any,
    dto: VerifySuperAdminEmailChangeDto,
  ): Promise<{ success: boolean; message: string; newEmail: string }> {
    if (!superAdminUser || superAdminUser.role !== 'SuperAdmin') {
      throw new ForbiddenException('Access Denied: Only platform SuperAdmin can perform this operation.');
    }

    const currentUserId = superAdminUser.id;
    const requestedEmail = dto.newEmail.trim().toLowerCase();
    const tokenHashService = this.tokenHashService || new TokenHashService();

    let oldEmail = superAdminUser.email;
    let targetVerifiedEmail = '';

    // Atomic transaction for challenge validation, uniqueness re-check, email update, session bump, and token revocation
    await this.prisma.$transaction(async (tx) => {
      // 1. Fetch locked challenge record
      const challenge = await tx.otpChallenge.findUnique({
        where: { challengeToken: dto.challengeToken },
      });

      if (!challenge) {
        throw new BadRequestException('Invalid or expired email change verification challenge.');
      }

      // 2. Security Check: Challenge must belong to currently authenticated SuperAdmin (Anti-IDOR)
      if (challenge.userId !== currentUserId) {
        throw new ForbiddenException('Access Denied: This verification challenge does not belong to your account.');
      }

      // 3. Security Check: Lockout after max attempts
      if (
        challenge.status === 'LOCKED' ||
        challenge.status.startsWith('LOCKED') ||
        challenge.attempts >= challenge.maxAttempts
      ) {
        throw new BadRequestException('Verification challenge is locked due to too many failed attempts. Please request a new code.');
      }

      // 4. Security Check: Challenge status must be PENDING_EMAIL_CHANGE and bound to target email
      if (!challenge.status.startsWith('PENDING_EMAIL_CHANGE:')) {
        throw new BadRequestException('Invalid verification challenge type or purpose.');
      }

      const storedTargetEmail = challenge.status.replace('PENDING_EMAIL_CHANGE:', '').trim().toLowerCase();
      if (!storedTargetEmail || storedTargetEmail !== requestedEmail) {
        throw new BadRequestException('Verification failed: Requested email does not match the target email on file.');
      }
      targetVerifiedEmail = storedTargetEmail;

      // 5. Security Check: Expiration
      if (challenge.expiresAt < new Date()) {
        await tx.otpChallenge.update({
          where: { id: challenge.id },
          data: { status: 'EXPIRED' },
        });
        throw new BadRequestException('Verification code has expired. Please request a new code.');
      }

      // 6. Security Check: Constant-time hash comparison
      const expectedHash = tokenHashService.hash(storedTargetEmail + ':' + dto.otp);
      if (expectedHash !== challenge.otpHash) {
        const nextAttempts = challenge.attempts + 1;
        const isLocked = nextAttempts >= challenge.maxAttempts;
        await tx.otpChallenge.update({
          where: { id: challenge.id },
          data: {
            attempts: nextAttempts,
            status: isLocked ? 'LOCKED' : challenge.status,
          },
        });

        if (isLocked) {
          throw new BadRequestException('Verification challenge is locked due to too many failed attempts. Please request a new code.');
        }
        throw new BadRequestException('Invalid 6-digit verification code. Please check the code and try again.');
      }

      // 7. Security Check: Re-verify email uniqueness inside transaction (Anti-Race Condition)
      const duplicateUser = await tx.user.findUnique({
        where: { email: storedTargetEmail },
      });
      if (duplicateUser && duplicateUser.id !== currentUserId) {
        throw new ConflictException('An account with this email address already exists.');
      }

      // 8. Mark challenge as consumed (Anti-Replay)
      await tx.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
        },
      });

      // 9. Fetch current user to record old email
      const currentUser = await tx.user.findUnique({ where: { id: currentUserId } });
      if (currentUser) {
        oldEmail = currentUser.email;
      }

      // 10. Atomically update SuperAdmin User email and bump sessionVersion
      await tx.user.update({
        where: { id: currentUserId },
        data: {
          email: storedTargetEmail,
          sessionVersion: { increment: 1 },
        },
      });

      // 11. Revoke all active UserSessions for the SuperAdmin
      await tx.userSession.updateMany({
        where: { userId: currentUserId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: 'SUPERADMIN_EMAIL_CHANGED',
        },
      });
    });

    // 12. Record Audit Log (outside DB transaction)
    if (this.auditLogger) {
      await this.auditLogger.logAction({
        userId: currentUserId,
        userName: superAdminUser.name || 'SuperAdmin',
        companyId: 'PLATFORM',
        action: 'SUPERADMIN_EMAIL_CHANGED',
        oldValue: oldEmail,
        newValue: targetVerifiedEmail,
        details: 'Platform SuperAdmin email address changed successfully',
      });
    }

    this.logger.log(`SUPERADMIN_EMAIL_CHANGED successfully for user ID ${currentUserId}: ${oldEmail} -> ${targetVerifiedEmail}`);

    return {
      success: true,
      message: 'SuperAdmin email address updated successfully. For security, all active sessions have been revoked. Please log in with your new email address.',
      newEmail: targetVerifiedEmail,
    };
  }

  verifyEmail(token: string) {
    return this.emailVerificationService.verifyEmail(token);
  }

  async revokeUserSessions(userId: string) {
    await this.refreshTokenService.revokeAllUserSessions(userId, 'REVOKED_BY_ADMIN');
    this.logger.log(`ADMIN_SESSION_REVOKED for user ID: ${userId}`);
    return { message: 'All user sessions revoked successfully' };
  }

  async getActiveSessions(userId: string, currentRefreshToken?: string) {
    return this.refreshTokenService.getUserActiveSessions(userId, currentRefreshToken);
  }

  async revokeSession(userId: string, sessionId: string) {
    const success = await this.refreshTokenService.revokeSessionById(userId, sessionId);
    if (!success) {
      throw new NotFoundException('Session not found or already revoked');
    }
    return { message: 'Session terminated successfully' };
  }

  async revokeOtherSessions(userId: string, currentRefreshToken?: string) {
    const revokedCount = await this.refreshTokenService.revokeOtherUserSessions(
      userId,
      currentRefreshToken,
    );
    this.logger.log(`LOGOUT_ALL other devices for user ID: ${userId} (${revokedCount} sessions)`);
    return { message: `Terminated ${revokedCount} other active sessions` };
  }

  async updatePreferences(userId: string, prefs: any) {
    await this.userRepository.updateUser(userId, {
      notificationPrefs: JSON.stringify(prefs),
    });
    return { message: 'Preferences updated successfully', prefs };
  }

  private readonly impersonationTickets = new Map<
    string,
    {
      superAdminId: string;
      superAdminName: string;
      targetCompanyId: string;
      expiresAt: number;
      used: boolean;
    }
  >();

  async createImpersonationTicket(companyId: string, superAdminUser: any) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    const ticketId = crypto.randomUUID();
    const expiresAt = Date.now() + 30 * 1000; // 30s TTL

    this.impersonationTickets.set(ticketId, {
      superAdminId: superAdminUser?.id || 'SUPER_ADMIN',
      superAdminName: superAdminUser?.name || 'SuperAdmin',
      targetCompanyId: companyId,
      expiresAt,
      used: false,
    });

    const ticket = this.tokenService.sign(
      {
        sub: superAdminUser?.id || 'SUPER_ADMIN',
        targetCompanyId: companyId,
        jti: ticketId,
        type: 'IMPERSONATION_TICKET',
      },
      { expiresIn: '30s' },
    );

    if (this.auditLogger) {
      await this.auditLogger
        .logAction({
          userId: superAdminUser?.id || 'SUPER_ADMIN',
          userName: superAdminUser?.name || 'SuperAdmin',
          companyId,
          action: 'Impersonation Ticket Generated',
          details: `SuperAdmin generated single-use impersonation ticket for Company "${company.name}" (TTL: 30s)`,
        })
        .catch(() => null);
    }

    const tenantAppUrl = process.env.TENANT_APP_URL || 'http://localhost:5173';
    return {
      ticket,
      ticketId,
      expiresAt: new Date(expiresAt).toISOString(),
      redirectUrl: `${tenantAppUrl}/impersonate?ticket=${encodeURIComponent(ticket)}`,
    };
  }

  async exchangeImpersonationTicket(ticket: string) {
    let payload: any;
    try {
      payload = this.tokenService.verify(ticket);
    } catch (err) {
      throw new UnauthorizedException('Impersonation ticket is invalid or expired');
    }

    if (!payload || payload.type !== 'IMPERSONATION_TICKET' || !payload.jti) {
      throw new UnauthorizedException('Invalid impersonation ticket format');
    }

    const ticketRecord = this.impersonationTickets.get(payload.jti);
    if (!ticketRecord) {
      throw new UnauthorizedException('Impersonation ticket not recognized or expired');
    }

    if (ticketRecord.used) {
      this.logger.warn(`Replay attempt detected for impersonation ticket ${payload.jti}`);
      throw new UnauthorizedException('Impersonation ticket has already been used');
    }

    if (Date.now() > ticketRecord.expiresAt) {
      this.impersonationTickets.delete(payload.jti);
      throw new UnauthorizedException('Impersonation ticket has expired');
    }

    // Mark as used (single-use guarantee)
    ticketRecord.used = true;

    const companyId = ticketRecord.targetCompanyId;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    let user = await this.prisma.user.findFirst({
      where: {
        companyId,
        role: 'HRAdmin',
      },
      include: {
        roleRelation: true,
        subscription: true,
      },
    });

    if (!user) {
      const sub = await this.prisma.subscription.findFirst({
        where: { companyId },
      });
      if (sub) {
        user = await this.prisma.user.findFirst({
          where: {
            subscriptionId: sub.id,
            role: 'HRAdmin',
          },
          include: {
            roleRelation: true,
            subscription: true,
          },
        });
      }
    }

    assertUserCanImpersonate(user, company.name);

    if (this.auditLogger) {
      await this.auditLogger
        .logAction({
          userId: user.id,
          userName: user.name,
          companyId,
          action: 'Impersonation Ticket Exchanged',
          details: `Impersonation session established for [${user.email}] on "${company.name}" (SuperAdmin: ${ticketRecord.superAdminName})`,
        })
        .catch(() => null);
    }

    const tenantPayload = {
      sub: user.id,
      companyId: user.companyId || companyId,
      role: user.role,
      pv: user.permissionVersion,
      sv: user.sessionVersion,
    };

    const rolePermissions = JSON.parse(user.roleRelation?.permissions || '[]');
    const permissions = await getEffectivePermissions(
      this.prisma,
      user.role,
      rolePermissions,
      user.subscription,
    );

    const refreshToken = await this.refreshTokenService.generateRefreshToken(user.id);

    return {
      access_token: this.tokenService.sign(tenantPayload),
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        initials: user.initials,
        permissions,
        companyId: user.companyId || companyId,
        companyName: company.name,
        subscriptionId: user.subscriptionId,
      },
      impersonator: {
        name: ticketRecord.superAdminName,
        role: 'SuperAdmin',
        ownerAppUrl: process.env.OWNER_APP_URL || 'http://localhost:5174',
      },
    };
  }

  async impersonateCompany(companyId: string, superAdminUser?: any) {
    const ticketInfo = await this.createImpersonationTicket(companyId, superAdminUser);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    let user = await this.prisma.user.findFirst({
      where: {
        companyId,
        role: 'HRAdmin',
      },
      include: {
        roleRelation: true,
        subscription: true,
      },
    });

    if (!user) {
      const sub = await this.prisma.subscription.findFirst({
        where: { companyId },
      });
      if (sub) {
        user = await this.prisma.user.findFirst({
          where: {
            subscriptionId: sub.id,
            role: 'HRAdmin',
          },
          include: {
            roleRelation: true,
            subscription: true,
          },
        });
      }
    }

    assertUserCanImpersonate(user, company?.name || 'Company');

    const payload = {
      sub: user.id,
      companyId: user.companyId || companyId,
      role: user.role,
      pv: user.permissionVersion,
      sv: user.sessionVersion,
    };

    const rolePermissions = JSON.parse(user.roleRelation?.permissions || '[]');
    const permissions = await getEffectivePermissions(
      this.prisma,
      user.role,
      rolePermissions,
      user.subscription,
    );

    const refreshToken = await this.refreshTokenService.generateRefreshToken(user.id);

    return {
      ticket: ticketInfo.ticket,
      ticketId: ticketInfo.ticketId,
      redirectUrl: ticketInfo.redirectUrl,
      access_token: this.tokenService.sign(payload),
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        initials: user.initials,
        permissions,
        companyId: user.companyId || companyId,
        subscriptionId: user.subscriptionId,
      },
    };
  }
}
