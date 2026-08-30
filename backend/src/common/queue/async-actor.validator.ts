import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CanonicalJobContext } from './canonical-job-context.interface';
import { Role } from '../../modules/auth/role.enum';

export class AsyncActorRevokedException extends Error {
  constructor(message: string) {
    super(`[AsyncActorRevokedException] ${message}`);
    this.name = 'AsyncActorRevokedException';
  }
}

@Injectable()
export class AsyncActorValidatorService {
  private readonly logger = new Logger(AsyncActorValidatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates actor status before background job execution.
   * Rejects revoked, disabled, inactive, or non-existent actors.
   */
  async validateActor(context: CanonicalJobContext): Promise<void> {
    // 1. System Execution Exemption
    if (
      context.executionScope === 'PLATFORM' &&
      (context.actorUserId === 'SYSTEM' || context.actorUserId === 'system')
    ) {
      return;
    }

    // 2. Validate actorUserId presence
    if (!context.actorUserId || context.actorUserId.trim().length === 0) {
      throw new AsyncActorRevokedException('Actor user ID is missing');
    }

    // 3. Query actor from database
    const user = await this.prisma.user.findUnique({
      where: { id: context.actorUserId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        companyId: true,
        subscriptionId: true,
      },
    });

    if (!user) {
      throw new AsyncActorRevokedException(
        `Actor user with ID "${context.actorUserId}" does not exist in system`,
      );
    }

    // 4. Validate Account Status (Active / Eligible)
    const status = (user.status || '').trim();
    if (
      status === 'Locked' ||
      status === 'Disabled' ||
      status === 'Inactive' ||
      status === 'Suspended'
    ) {
      throw new AsyncActorRevokedException(
        `Actor account "${user.email}" is ${status || 'unavailable'}. Execution revoked.`,
      );
    }

    // 5. Validate Role Consistency
    const validRoles = Object.values(Role) as string[];
    if (context.actorRole && !validRoles.includes(context.actorRole)) {
      throw new AsyncActorRevokedException(
        `Actor role "${context.actorRole}" is not a recognized system role`,
      );
    }

    // 6. Validate Tenant Ownership (for TENANT jobs)
    if (context.executionScope === 'TENANT') {
      const userCompany = user.companyId || user.subscriptionId;
      if (
        user.role !== Role.SuperAdmin &&
        userCompany &&
        userCompany !== context.companyId
      ) {
        throw new AsyncActorRevokedException(
          `Actor "${user.email}" belongs to tenant "${userCompany}" which differs from target job tenant "${context.companyId}"`,
        );
      }
    }

    // 7. Validate Platform Scope Authorization (for PLATFORM jobs)
    if (context.executionScope === 'PLATFORM') {
      if (user.role !== Role.SuperAdmin) {
        throw new AsyncActorRevokedException(
          `Actor "${user.email}" with role "${user.role}" is not authorized for PLATFORM scope execution. Required: SuperAdmin or SYSTEM actor.`,
        );
      }
    }
  }
}
