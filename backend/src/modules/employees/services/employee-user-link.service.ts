import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../../auth/repositories/user.repository';
import { PasswordService } from '../../auth/services/password.service';
import { EmailService } from '../../../email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmployeeUserLinkService {
  private readonly logger = new Logger(EmployeeUserLinkService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  async getOrCreateUserForEmployee(options: {
    email: string;
    name: string;
    companyName?: string;
    roleId?: string | null;
    companyId: string | null;
    subscriptionId: string | null;
    prismaClient?: any;
    deferWelcomeEmail?: boolean;
  }): Promise<string> {
    const {
      email,
      name,
      companyName = 'HR Nexa Partner',
      roleId,
      companyId,
      subscriptionId,
      prismaClient,
      deferWelcomeEmail,
    } = options;

    const client = prismaClient || this.prisma;

    const existingUser = prismaClient
      ? await client.user.findUnique({ where: { email } })
      : await this.userRepository.findByEmail(email);

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const tempPassword = `EmpNexa#${randomDigits}`;
    const hashedPassword = await this.passwordService.hash(tempPassword);

    let resolvedRoleId = roleId;
    let resolvedRoleName = 'Employee';
    if (resolvedRoleId) {
      const dbRole = await client.role.findUnique({
        where: { id: resolvedRoleId },
      });
      if (dbRole) {
        resolvedRoleName = dbRole.name;
      }
    } else {
      // Find the company's default 'Employee' role if roleId is omitted
      const defaultEmpRole = await client.role.findFirst({
        where: { name: 'Employee', companyId: companyId ?? null },
      });
      if (defaultEmpRole) {
        resolvedRoleId = defaultEmpRole.id;
      }
    }

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      const updateData: any = {
        password: hashedPassword,
      };
      if (resolvedRoleId) {
        updateData.roleId = resolvedRoleId;
        updateData.role = resolvedRoleName;
      }
      if (subscriptionId) {
        updateData.subscriptionId = subscriptionId;
      }
      if (companyId) {
        updateData.companyId = companyId;
      }

      if (prismaClient) {
        await client.user.update({
          where: { id: existingUser.id },
          data: updateData,
        });
      } else {
        await this.userRepository.updateUser(existingUser.id, updateData);
      }
    } else {
      const initials = name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);

      if (prismaClient) {
        const newUser = await client.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            role: resolvedRoleName,
            roleId: resolvedRoleId ?? null,
            initials,
            subscriptionId: subscriptionId ?? null,
            companyId: companyId ?? null,
          },
        });
        userId = newUser.id;
      } else {
        const newUser = await this.userRepository.createUser({
          email,
          password: hashedPassword,
          name,
          role: resolvedRoleName,
          roleId: resolvedRoleId ?? null,
          initials,
          subscriptionId: subscriptionId ?? null,
        });

        // Link companyId
        await this.prisma.user.update({
          where: { id: newUser.id },
          data: { companyId: companyId ?? null },
        });

        userId = newUser.id;
      }
    }

    // Always dispatch welcome email if not deferred
    if (!deferWelcomeEmail && !prismaClient) {
      this.emailService
        .sendWelcomeEmail(email, name, companyName, tempPassword, false)
        .then((sent) => {
          if (sent) {
            this.logger.log(
              `Employee welcome email successfully sent via SMTP to ${email}`,
            );
          } else {
            this.logger.warn(
              `Employee welcome email failed to send via SMTP to ${email}`,
            );
          }
        })
        .catch((err) => {
          this.logger.error(
            `Failed to send welcome email to ${email}: ${err.message}`,
          );
        });
    }

    return userId;
  }

  async updateLinkedUser(
    userId: string,
    data: { name?: string; email?: string },
    prismaClient?: any,
  ): Promise<void> {
    if (!userId) return;

    const updatePayload: Record<string, any> = {};
    if (data.name) {
      updatePayload.name = data.name;
      updatePayload.initials = data.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }

    if (data.email) {
      updatePayload.email = data.email;
    }

    if (Object.keys(updatePayload).length === 0) return;

    try {
      if (prismaClient) {
        await prismaClient.user.update({
          where: { id: userId },
          data: updatePayload,
        });
      } else {
        await this.userRepository.updateUser(userId, updatePayload);
      }
      this.logger.log(
        `Linked User ${userId} successfully updated: ${JSON.stringify(updatePayload)}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to update linked User ${userId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async removeLinkedUser(
    userId: string,
    prismaClient?: any,
  ): Promise<void> {
    const client = prismaClient || this.prisma;
    try {
      const user = await client.user.findUnique({ where: { id: userId } });
      if (user) {
        await client.user.delete({ where: { id: userId } });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to clean up user record ${userId}: ${error instanceof Error ? error.message : error}`,
      );
      if (prismaClient) {
        throw error;
      }
    }
  }
}
