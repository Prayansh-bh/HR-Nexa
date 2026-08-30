import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UserRepository } from '../repositories/user.repository';
import { PasswordService } from './password.service';
import { EmailService } from '../../../email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenHashService } from './token-hash.service';
import { SystemConfigService } from '../../system/services/system-config.service';
import { OutboxPublisherService } from '../../../common/queue/outbox-publisher.service';
import { getPasswordResetTemplate } from '../../../email/email.templates/password-reset.template';
import { User } from '@prisma/client';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private userRepository: UserRepository,
    private passwordService: PasswordService,
    private emailService: EmailService,
    private prisma: PrismaService,
    private tokenHashService: TokenHashService,
    private systemConfigService: SystemConfigService,
    @Optional() private outboxPublisher?: OutboxPublisherService,
  ) {}

  /**
   * Public Password Reset Request with Enumeration Protection.
   * Always returns a generic success response without exposing user existence,
   * plaintext reset tokens, or URLs.
   */
  async requestPasswordReset(
    email: string,
  ): Promise<{ message: string }> {
    const genericMessage =
      'If an account with that email exists, a password reset link has been sent.';

    if (!email || typeof email !== 'string' || !email.trim()) {
      return { message: genericMessage };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      // Return generic message to prevent account enumeration
      return { message: genericMessage };
    }

    await this.createAndPublishResetToken(user as User);
    return { message: genericMessage };
  }

  /**
   * Internal / Authorized Password Reset Request for a known, verified User.
   * Reuses all token generation, hashing, HTML templating, and Outbox publication logic.
   */
  async requestPasswordResetForUser(
    userOrUserId: User | string,
  ): Promise<{ success: boolean; message: string }> {
    let targetUser: User | null = null;
    if (typeof userOrUserId === 'string') {
      const found = await this.userRepository.findById(userOrUserId);
      if (!found) {
        throw new NotFoundException('Target user not found');
      }
      targetUser = found as User;
    } else {
      targetUser = userOrUserId;
    }

    await this.createAndPublishResetToken(targetUser);
    return {
      success: true,
      message: 'Password reset link queued successfully.',
    };
  }

  /**
   * Core Cryptographic Token Generator and Outbox Publisher.
   * Generates CSPRNG token, SHA-256 hash, 15-minute TTL, role-aware portal link,
   * and dispatches branded HTML email through transactional Outbox.
   */
  private async createAndPublishResetToken(user: User): Promise<void> {
    const resetToken = randomUUID();
    const tokenHash = this.tokenHashService.hash(resetToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    const isSuperAdmin = user.role === 'SuperAdmin';
    const baseUrl = isSuperAdmin
      ? process.env.OWNER_APP_URL || 'http://localhost:5174'
      : process.env.TENANT_APP_URL ||
        process.env.FRONTEND_URL ||
        'http://localhost:5173';

    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const resetLink = isSuperAdmin
      ? `${normalizedBaseUrl}/login?resetToken=${resetToken}`
      : `${normalizedBaseUrl}/reset-password?resetToken=${resetToken}`;
    const htmlBody = getPasswordResetTemplate(user.name, resetLink);

    // Execute token creation + Outbox event creation inside atomic transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      if (this.outboxPublisher) {
        await this.outboxPublisher.publishEmail(tx, {
          to: user.email,
          subject: 'Reset Your Password - HR NEXA',
          body: htmlBody,
          companyId: user.companyId || 'PLATFORM',
          actor: { id: user.id, role: user.role || 'Employee' },
        });
      }
    });

    this.logger.log(
      `Password reset token generated and queued for user ID: ${user.id} [Tenant: ${user.companyId || 'PLATFORM'}]`,
    );

    // If outbox publisher is not present in mock test env, fall back to direct email service
    if (!this.outboxPublisher) {
      await this.emailService.sendEmail({
        to: user.email,
        toName: user.name,
        subject: 'Reset Your Password - HR NEXA',
        html: htmlBody,
        companyId: user.companyId || undefined,
      });
    }
  }

  async resetPassword(
    resetToken: string,
    newPass: string,
  ): Promise<{ message: string }> {
    const tokenHash = this.tokenHashService.hash(resetToken);

    // Look up token record in PostgreSQL
    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !tokenRecord ||
      tokenRecord.usedAt !== null ||
      tokenRecord.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const user = tokenRecord.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const settings = await this.systemConfigService.getGlobalSettings();
    this.passwordService.validatePasswordPolicy(newPass, settings.strictPasswordPolicy);

    const hashedPassword = await this.passwordService.hash(newPass);

    // Execute password update, session revocation, and version increment in a single atomic transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Update user password and bump sessionVersion
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          sessionVersion: { increment: 1 },
        },
      });

      // 2. Revoke all active UserSessions for the user
      await tx.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: 'PASSWORD_RESET',
        },
      });

      // 3. Mark PasswordResetToken as used
      await tx.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });
    });

    this.logger.log(`Password reset completed for user ${user.id} (${user.email})`);
    return { message: 'Password reset successfully' };
  }
}
