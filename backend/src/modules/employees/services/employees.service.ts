import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import {
  BulkCreateEmployeeDto,
  BulkCreateResponseDto,
  BulkEmployeeError,
} from '../dto/bulk-create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { OrgChartEmployeeDto } from '../dto/org-chart-employee.dto';
import { EmployeesRepository } from '../repositories/employees.repository';
import { EmployeeUserLinkService } from './employee-user-link.service';
import { EmployeeDepartmentSyncService } from './employee-department-sync.service';
import { SeatLimitService } from '../../subscriptions/services/seat-limit.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import {
  EmployeeCreatedEvent,
  EmployeeUpdatedEvent,
  EmployeeDeletedEvent,
  EmployeeStatusChangedEvent,
  EMPLOYEE_EVENTS,
} from '../../../common/events/employee.events';
import {
  UserCreatedEvent,
  RoleAssignedEvent,
  RoleRemovedEvent,
  ManagerChangedEvent,
} from '../../../common/events/roles-users.events';

import { StorageService } from '../../../common/storage/storage.service';
import { Permission } from '../../auth/permissions.enum';
import { canUserDelegateRole } from '../../../common/tenant/tenant-validation.util';
import { EmailService } from '../../../email/email.service';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly employeeUserLinkService: EmployeeUserLinkService,
    private readonly employeeDepartmentSyncService: EmployeeDepartmentSyncService,
    private readonly seatLimitService: SeatLimitService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly tenantContextService?: TenantContextService,
    @Optional() private readonly storageService?: StorageService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  private getTenantId(currentUser: any): string | null {
    if (currentUser?.role === 'SuperAdmin') return null;
    return currentUser?.companyId || currentUser?.subscriptionId || null;
  }

  /**
   * Sanitizes sensitive compensation and financial PII (salary, bank details, PAN, Aadhaar)
   * unless the caller is SuperAdmin, CompanyOwner, HRAdmin, has explicit salary/payroll view permissions,
   * or is querying their own employee profile.
   */
  private sanitizeEmployeeData(employee: any, currentUser: any): any {
    if (!employee) return employee;

    const isSuperAdmin = currentUser?.role === 'SuperAdmin';
    const isCompanyAdmin =
      currentUser?.role === 'HRAdmin' || currentUser?.role === 'CompanyOwner';
    const hasSalaryPermission =
      currentUser?.permissions?.includes(Permission.EMPLOYEES_SALARY_VIEW) ||
      currentUser?.permissions?.includes('employees:salary:view') ||
      currentUser?.permissions?.includes(Permission.PAYROLL_PROCESS_VIEW) ||
      currentUser?.permissions?.includes('payroll:process:view');

    const userEmployeeId =
      currentUser?.employee?.id || (currentUser as any)?.employeeId;
    const isSelf = Boolean(userEmployeeId && userEmployeeId === employee.id);

    const canViewCompensation =
      isSuperAdmin || isCompanyAdmin || hasSalaryPermission || isSelf;

    if (canViewCompensation) {
      return employee;
    }

    return {
      ...employee,
      salary: null,
      accountNumber: null,
      panNumber: null,
      aadhaarNumber: null,
    };
  }

  async findAll(
    currentUserOrSearch?: any,
    search?: string,
    department?: string,
    status?: string,
    optionsParam?: { page?: number; limit?: number },
  ) {
    let currentUser: any = null;
    let s = search;
    let d = department;
    let st = status;

    if (typeof currentUserOrSearch === 'string' || currentUserOrSearch === undefined) {
      s = currentUserOrSearch;
    } else {
      currentUser = currentUserOrSearch;
    }

    const tenantId = this.getTenantId(currentUser);
    const page = optionsParam?.page && optionsParam.page > 0 ? optionsParam.page : 1;
    const limit = Math.min(
      optionsParam?.limit && optionsParam.limit > 0 ? optionsParam.limit : 50,
      100,
    );

    const results = await this.employeesRepository.findMany({
      tenantCompanyId: tenantId,
      page,
      limit,
      search: s,
      department: d,
      status: st,
    });

    if (results && typeof results === 'object' && 'data' in results && Array.isArray((results as any).data)) {
      return {
        ...results,
        data: (results as any).data.map((emp: any) =>
          this.sanitizeEmployeeData(emp, currentUser),
        ),
      };
    } else if (Array.isArray(results)) {
      return results.map((emp: any) => this.sanitizeEmployeeData(emp, currentUser));
    }

    return results;
  }

  async getOrgChartTree(currentUser: any): Promise<OrgChartEmployeeDto[]> {
    const tenantId = this.getTenantId(currentUser);
    const whereClause: any = {};
    if (tenantId) {
      whereClause.companyId = tenantId;
    }
    const employees = await this.prisma.employee.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        avatar: true,
        managerId: true,
        designation: {
          select: {
            name: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
      },
    });

    return employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      avatar: emp.avatar ?? null,
      managerId: emp.managerId ?? null,
      designation: emp.designation?.name ?? null,
      department: emp.department?.name ?? null,
    }));
  }

  async findOne(currentUserOrId: any, id?: string) {
    let currentUser: any = null;
    let targetId: string;

    if (typeof currentUserOrId === 'string' && !id) {
      targetId = currentUserOrId;
    } else {
      currentUser = currentUserOrId;
      targetId = id!;
    }

    const tenantId = this.getTenantId(currentUser);
    const employee = await this.employeesRepository.findByIdAndTenant(
      targetId,
      tenantId,
    );
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${targetId} not found`);
    }
    return this.sanitizeEmployeeData(employee, currentUser);
  }

  /**
   * Resolves the target subscriptionId without falling back to arbitrary DB ordering.
   */
  private async resolveTargetSubscriptionId(dto: any): Promise<string | null> {
    if (dto.subscriptionId) return dto.subscriptionId;

    if (this.tenantContextService && !this.tenantContextService.isPlatform()) {
      const tenantId = this.tenantContextService.getCompanyId();
      if (tenantId) return tenantId;
    }

    if (dto.companyName || dto.company) {
      const compName = dto.companyName || dto.company;
      const sub = await this.prisma.subscription.findFirst({
        where: { company: compName },
      });
      if (sub) return sub.id;
    }

    return null;
  }

  /**
   * Creates an Employee + User inside a single Prisma transaction.
   * Emits EmployeeCreatedEvent with explicit tenant context.
   */
  async create(currentUserOrDto: any, createDtoParam?: CreateEmployeeDto) {
    let currentUser: any = null;
    let createDto: CreateEmployeeDto;

    if (createDtoParam) {
      currentUser = currentUserOrDto;
      createDto = createDtoParam;
    } else {
      createDto = currentUserOrDto;
    }

    if (createDto.dob) {
      const dobDate = new Date(createDto.dob);
      if (dobDate > new Date()) {
        throw new BadRequestException('Future Date of Birth is not allowed');
      }
    }

    const companyId =
      currentUser?.companyId ||
      (this.tenantContextService ? this.tenantContextService.getCompanyId() : null) ||
      (createDto as any).companyId;
    const subscriptionId =
      currentUser?.subscriptionId ||
      (this.tenantContextService ? this.tenantContextService.getSubscriptionId() : null) ||
      (createDto as any).subscriptionId;

    if (!companyId || companyId === 'PLATFORM') {
      throw new BadRequestException(
        'Tenant context (companyId) is required to create an employee.',
      );
    }

    // Tenant boundary & role delegation checks: verify roleId and managerId belong to company and caller is authorized to delegate
    if (createDto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: createDto.roleId },
      });
      if (!role || !canUserDelegateRole(currentUser, role)) {
        throw new ForbiddenException(
          'Selected role is not available or you are not authorized to assign this role in your tenant.',
        );
      }
    }

    if (createDto.managerId) {
      const manager = await this.prisma.employee.findUnique({
        where: { id: createDto.managerId },
      });
      if (!manager || manager.companyId !== companyId) {
        throw new ForbiddenException(
          'Selected manager is not available in your company.',
        );
      }
    }

    // ── 1. Guard: seat limit check will happen inside transaction ───────────

    // ── 2. Guard: duplicate ID (if ID provided) ───────────────────────────
    if (createDto.id && String(createDto.id).trim() !== '') {
      const existing = await this.employeesRepository.findById(
        String(createDto.id).trim(),
      );
      if (existing) {
        throw new ConflictException(
          `Employee with ID ${createDto.id} already exists`,
        );
      }
    }

    // ── 3. Guard: duplicate email ───────────────────────────────────────────
    const existingEmail = await this.employeesRepository.findByEmail(
      createDto.email,
    );
    if (existingEmail) {
      throw new ConflictException(
        `Employee with email ${createDto.email} already exists`,
      );
    }

    // ── 4. Resolve Department (scoped strictly to target tenant) ───────────
    let departmentId: string | null = null;
    if ((createDto as any).departmentName) {
      const deptName = (createDto as any).departmentName as string;
      let dept = await this.prisma.department.findFirst({
        where: { name: deptName, companyId },
      });
      if (!dept) {
        dept = await this.prisma.department.create({
          data: { name: deptName, companyId, subscriptionId },
        });
        this.logger.log(
          `Auto-created Department "${deptName}" for company ${companyId}`,
        );
      }
      departmentId = dept.id;
    }

    // ── 5. Resolve Designation (scoped strictly to target tenant) ──────────
    let designationId: string | null = null;
    if ((createDto as any).designation) {
      const desigName = (createDto as any).designation as string;
      let desig = await this.prisma.designation.findFirst({
        where: { name: desigName, companyId },
      });
      if (!desig) {
        desig = await this.prisma.designation.create({
          data: {
            name: desigName,
            band: 'IC',
            companyId,
            subscriptionId,
          },
        });
        this.logger.log(
          `Auto-created Designation "${desigName}" for company ${companyId}`,
        );
      }
      designationId = desig.id;
    }

    // ── 6. Get subscription details ────────────────────────────────────────
    const subscription = subscriptionId
      ? await this.prisma.subscription.findUnique({
          where: { id: subscriptionId },
        })
      : null;

    // Strip legacy string fields, replace with IDs
    const {
      departmentName: _dn,
      designation: _d,
      createAccount: _ca,
      roleId: _ri,
      managerId: _mi,
      id: rawExplicitId,
      ...rest
    } = createDto as any;

    const isAutoGeneratedId =
      !rawExplicitId || String(rawExplicitId).trim() === '';
    const MAX_ID_RETRIES = 5;

    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_ID_RETRIES; attempt++) {
      try {
        let createdUserId: string | null = null;
        let generatedTempPassword: string | null = null;

        const created = await this.prisma.$transaction(async (tx) => {
          // 1. Authoritative seat limit check inside transaction
          if (subscriptionId) {
            await this.seatLimitService.verifyCanAddEmployee(
              subscriptionId,
              tx,
            );
          }

          // 2. Resolve employee ID: use supplied ID or generate next sequential EMP ID
          const resolvedEmployeeId = !isAutoGeneratedId
            ? String(rawExplicitId).trim()
            : await this.generateNextEmployeeId(companyId, tx);

          // 3. Create or update User INSIDE the transaction (Fix #2: eliminates orphan user records on rollback)
          if (createDto.createAccount !== false) {
            const userLinkResult =
              await this.employeeUserLinkService.getOrCreateUserForEmployee({
                email: createDto.email,
                name: createDto.name,
                companyName: subscription?.company || 'HR Nexa Partner',
                roleId: createDto.roleId,
                companyId,
                subscriptionId,
                prismaClient: tx,
                deferWelcomeEmail: true,
              });

            createdUserId =
              typeof userLinkResult === 'object' && userLinkResult !== null
                ? userLinkResult.userId
                : (userLinkResult as any);
            generatedTempPassword =
              typeof userLinkResult === 'object' && userLinkResult !== null
                ? userLinkResult.tempPassword || null
                : null;
          }

          // 4. Create the employee record
          const employee = await tx.employee.create({
            data: {
              ...rest,
              id: resolvedEmployeeId,
              departmentId,
              designationId,
              userId: createdUserId,
              companyId,
              subscriptionId,
              managerId: createDto.managerId || null,
            },
          });

          return employee;
        });

        // ── 8. Post-transaction operations ─────────────────────────────────────
        if (subscriptionId) {
          await this.seatLimitService.syncEmployeeCounts(subscriptionId);
        }

        // Domain events (dispatched ONLY after successful transaction commit)
        this.eventEmitter.emit(
          EMPLOYEE_EVENTS.CREATED,
          new EmployeeCreatedEvent(
            created.id,
            created.name,
            created.email,
            companyId,
          ),
        );

        // Post-transaction welcome email dispatch (non-blocking, failure will not roll back employee creation)
        if (createdUserId && generatedTempPassword && this.emailService) {
          void this.emailService
            .sendWelcomeEmail(
              createDto.email,
              createDto.name,
              subscription?.company || 'HR Nexa Partner',
              generatedTempPassword,
              false,
              companyId || undefined,
            )
            .then((sent) => {
              if (sent) {
                this.logger.log(
                  `Employee welcome email successfully dispatched via SMTP to ${createDto.email}`,
                );
              } else {
                this.logger.warn(
                  `Employee welcome email dispatch returned false for ${createDto.email}`,
                );
              }
            })
            .catch((err) => {
              this.logger.error(
                `Failed to dispatch employee welcome email to ${createDto.email}: ${err.message}`,
              );
            });
        }

        if (createdUserId) {
          const resolvedRole = createDto.roleId
            ? (
                await this.prisma.role.findUnique({
                  where: { id: createDto.roleId },
                })
              )?.name || 'Employee'
            : 'Employee';

          this.eventEmitter.emit(
            'user.created',
            new UserCreatedEvent(
              createdUserId,
              createDto.email,
              resolvedRole,
              companyId,
            ),
          );

          if (createDto.roleId) {
            this.eventEmitter.emit(
              'role.assigned',
              new RoleAssignedEvent(
                createdUserId,
                createDto.roleId,
                resolvedRole,
                companyId,
              ),
            );
          }
        }

        if (createDto.managerId) {
          this.eventEmitter.emit(
            'manager.changed',
            new ManagerChangedEvent(
              created.id,
              null,
              createDto.managerId,
              companyId,
            ),
          );
        }

        this.logger.log(
          `Employee ${created.id} (${created.name}) created for company ${companyId}.`,
        );
        return created;
      } catch (err: any) {
        lastError = err;

        // Inspect Prisma P2002 unique constraint violations
        const isPrismaP2002 = err?.code === 'P2002';
        const targetFields: string[] = Array.isArray(err?.meta?.target)
          ? err.meta.target
          : typeof err?.meta?.target === 'string'
          ? [err.meta.target]
          : [];

        const isIdCollision =
          isPrismaP2002 &&
          (targetFields.includes('id') ||
            targetFields.includes('PRIMARY') ||
            targetFields.some((t) => t.toLowerCase().includes('pkey')));

        const isEmailCollision =
          isPrismaP2002 &&
          (targetFields.includes('email') ||
            targetFields.some((t) => t.toLowerCase().includes('email')));

        if (isEmailCollision) {
          throw new ConflictException(
            `Employee with email ${createDto.email} already exists`,
          );
        }

        // Retry only if this was an auto-generated ID race collision
        if (isAutoGeneratedId && isIdCollision && attempt < MAX_ID_RETRIES) {
          this.logger.warn(
            `[EmployeesService] Concurrent ID collision detected on attempt ${attempt} for company ${companyId}. Retrying with next sequential ID...`,
          );
          continue;
        }

        if (isAutoGeneratedId && isIdCollision) {
          throw new ConflictException(
            'Failed to allocate unique employee ID after multiple concurrent attempts. Please retry.',
          );
        }

        throw err;
      }
    }

    throw lastError;
  }

  /**
   * Generates a deterministic SHA256 fingerprint for a batch payload.
   */
  private generatePayloadFingerprint(
    companyId: string,
    employees: any[],
  ): string {
    const simplified = employees.map((e) => ({
      email: e.email?.toLowerCase()?.trim(),
      name: e.name?.trim(),
      id: e.id?.trim() || '',
      department: (e.departmentName || e.department || '').trim(),
      designation: (e.designation || '').trim(),
      salary: e.salary,
    }));
    const raw = `${companyId}:${JSON.stringify(simplified)}`;
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Best-effort / non-atomic bulk creation of employees with Idempotency & Concurrency Hardening.
   * Processes each record independently via the canonical this.create() method.
   */
  async bulkCreate(
    currentUser: any,
    bulkDto: BulkCreateEmployeeDto,
    idempotencyKeyParam?: string,
  ): Promise<BulkCreateResponseDto> {
    const companyId =
      currentUser?.companyId ||
      (this.tenantContextService
        ? this.tenantContextService.getCompanyId()
        : null) ||
      'UNKNOWN_TENANT';

    const employees = bulkDto?.employees || [];
    const clientKey = idempotencyKeyParam?.trim();
    const hash = this.generatePayloadFingerprint(companyId, employees);
    const idempotencyKey = `${companyId}:bulk_onboard:${clientKey || hash}`;

    // ── 1. Idempotency Check & Claim ──────────────────────────────────────────
    let idempotencyClaimed = false;
    try {
      if (this.prisma.idempotencyKey) {
        const existingKeyRecord = await this.prisma.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        });

        if (existingKeyRecord) {
          if (
            existingKeyRecord.status === 'COMPLETED' &&
            existingKeyRecord.result
          ) {
            this.logger.log(
              `[bulkCreate] Idempotency cache hit: returning previous result for key ${idempotencyKey}`,
            );
            return existingKeyRecord.result as unknown as BulkCreateResponseDto;
          }

          if (existingKeyRecord.status === 'PENDING') {
            const ageMs =
              Date.now() - new Date(existingKeyRecord.createdAt).getTime();
            // 2 minute active threshold
            if (ageMs < 2 * 60 * 1000) {
              throw new ConflictException(
                'A bulk onboarding import with this idempotency key is already in progress. Please wait.',
              );
            }
          }
        }

        // Claim or refresh PENDING key
        await this.prisma.idempotencyKey.upsert({
          where: { key: idempotencyKey },
          create: {
            key: idempotencyKey,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          update: {
            status: 'PENDING',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        idempotencyClaimed = true;
      }
    } catch (err: any) {
      if (err instanceof ConflictException) {
        throw err;
      }
      this.logger.warn(
        `[bulkCreate] Idempotency check bypassed: ${err?.message}`,
      );
    }

    // ── 2. Best-Effort Row-by-Row Execution ───────────────────────────────────
    const createdEmployees: any[] = [];
    const errors: BulkEmployeeError[] = [];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      try {
        const created = await this.create(currentUser, emp);
        createdEmployees.push(created);
      } catch (err: any) {
        let reason = 'Failed to create employee';
        let code = 'CREATION_FAILED';

        if (err?.response && typeof err.response === 'object') {
          const rawMessage = err.response.message || err.response.error;
          if (Array.isArray(rawMessage)) {
            reason = rawMessage.join(', ');
          } else if (typeof rawMessage === 'string') {
            reason = rawMessage;
          }
          code =
            err.response.errorCode ||
            err.response.code ||
            (err.status === 409 ? 'DUPLICATE_RECORD' : 'VALIDATION_ERROR');
        } else if (err?.message) {
          reason = err.message;
        }

        errors.push({
          row: i + 1,
          index: i,
          id: emp?.id,
          email: emp?.email,
          name: emp?.name,
          reason,
          code,
        });
      }
    }

    const response: BulkCreateResponseDto = {
      total: employees.length,
      successful: createdEmployees.length,
      failed: errors.length,
      createdEmployees,
      errors,
    };

    // ── 3. Mark Idempotency Key COMPLETED ─────────────────────────────────────
    if (idempotencyClaimed && this.prisma.idempotencyKey) {
      try {
        await this.prisma.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: {
            status: 'COMPLETED',
            result: response as any,
            completedAt: new Date(),
          },
        });
      } catch (err: any) {
        this.logger.warn(
          `[bulkCreate] Failed to resolve idempotency key: ${err?.message}`,
        );
      }
    }

    return response;
  }

  async update(
    currentUserOrId: any,
    idOrDto: any,
    updateDtoParam?: UpdateEmployeeDto,
  ) {
    let currentUser: any = null;
    let id: string;
    let updateDto: UpdateEmployeeDto;

    if (updateDtoParam) {
      currentUser = currentUserOrId;
      id = idOrDto;
      updateDto = updateDtoParam;
    } else {
      id = currentUserOrId;
      updateDto = idOrDto;
    }

    // Non-admin restricted field protection
    if (
      currentUser &&
      currentUser.role !== 'SuperAdmin' &&
      currentUser.role !== 'HRAdmin'
    ) {
      delete (updateDto as any).salary;
      delete (updateDto as any).status;
      delete (updateDto as any).roleId;
      delete (updateDto as any).subscriptionId;
      delete (updateDto as any).companyId;
    }

    if (updateDto.dob) {
      const dobDate = new Date(updateDto.dob);
      if (dobDate > new Date()) {
        throw new BadRequestException('Future Date of Birth is not allowed');
      }
    }

    const employee = await this.findOne(currentUser, id);
    const targetCompanyId =
      employee.companyId ||
      currentUser?.companyId ||
      (this.tenantContextService ? this.tenantContextService.getCompanyId() : null);
    const targetSubscriptionId =
      employee.subscriptionId ||
      currentUser?.subscriptionId ||
      (this.tenantContextService ? this.tenantContextService.getSubscriptionId() : null);

    // Tenant boundary & role delegation checks: verify roleId and managerId belong to company and caller is authorized to delegate
    if (updateDto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: updateDto.roleId },
      });
      if (!role || !canUserDelegateRole(currentUser, role)) {
        throw new ForbiddenException(
          'Selected role is not available or you are not authorized to assign this role in your tenant.',
        );
      }
    }

    if (updateDto.managerId) {
      if (updateDto.managerId === id) {
        throw new BadRequestException(
          'An employee cannot report to themselves.',
        );
      }
      const manager = await this.prisma.employee.findUnique({
        where: { id: updateDto.managerId },
      });
      if (
        !manager ||
        (manager.companyId !== targetCompanyId && manager.subscriptionId !== targetSubscriptionId)
      ) {
        throw new ForbiddenException(
          'Selected manager is not available in your tenant.',
        );
      }
    }

    // Role deletion/demotion protection for manager
    const currentRoleName = employee.user?.role || 'Employee';
    if (currentRoleName === 'Manager' && updateDto.roleId) {
      const targetRole = await this.prisma.role.findUnique({
        where: { id: updateDto.roleId },
      });
      if (targetRole && targetRole.name !== 'Manager') {
        const subordinatesCount = await this.prisma.employee.count({
          where: { managerId: id },
        });
        if (subordinatesCount > 0) {
          throw new BadRequestException(
            `This employee still manages ${subordinatesCount} employees. Choose another manager first.`,
          );
        }
      }
    }

    // Resolve department/designation strings to IDs if provided (scoped strictly to target tenant)
    const updateData: any = { ...updateDto };

    if ((updateDto as any).departmentName) {
      const deptName = (updateDto as any).departmentName as string;
      let dept = targetSubscriptionId
        ? await this.prisma.department.findFirst({
            where: { name: deptName, subscriptionId: targetSubscriptionId },
          })
        : null;

      if (!dept) {
        dept = await this.prisma.department.create({
          data: { name: deptName, subscriptionId: targetSubscriptionId },
        });
      }
      updateData.departmentId = dept.id;
      delete updateData.departmentName;
    }

    if ((updateDto as any).designation) {
      const desigName = (updateDto as any).designation as string;
      let desig = targetSubscriptionId
        ? await this.prisma.designation.findFirst({
            where: { name: desigName, subscriptionId: targetSubscriptionId },
          })
        : null;

      if (!desig) {
        desig = await this.prisma.designation.create({
          data: {
            name: desigName,
            band: 'IC',
            subscriptionId: targetSubscriptionId,
          },
        });
      }
      updateData.designationId = desig.id;
      delete updateData.designation;
    }

    // Strip dynamic user parameters from updateData to prevent Prisma validation error
    delete updateData.createAccount;
    delete updateData.roleId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id },
        data: updateData,
        include: { department: true, designation: true },
      });

      // Synchronize linked User account if employee name or email changed
      if (employee.userId && (updateDto.name || updateDto.email)) {
        await this.employeeUserLinkService.updateLinkedUser(
          employee.userId,
          { name: updateDto.name, email: updateDto.email },
          tx,
        );
      }

      // Synchronize user role links if roleId changed
      if (employee.userId && updateDto.roleId) {
        const roleObj = await tx.role.findUnique({
          where: { id: updateDto.roleId },
        });
        if (roleObj) {
          const oldRoleName = employee.user?.role || 'Employee';
          const oldRoleId = employee.user?.roleId || null;

          await tx.user.update({
            where: { id: employee.userId },
            data: {
              roleId: updateDto.roleId,
              role: roleObj.name,
              permissionVersion: { increment: 1 },
            },
          });

          if (oldRoleId) {
            this.eventEmitter.emit(
              'role.removed',
              new RoleRemovedEvent(
                employee.userId,
                oldRoleId,
                oldRoleName,
                targetSubscriptionId,
              ),
            );
          }
          this.eventEmitter.emit(
            'role.assigned',
            new RoleAssignedEvent(
              employee.userId,
              roleObj.id,
              roleObj.name,
              targetSubscriptionId,
            ),
          );
        }
      }

      return emp;
    });

    if (updateDto.name && updateDto.name !== employee.name) {
      await this.employeeDepartmentSyncService.syncDepartmentHeadName(
        employee.name,
        updateDto.name,
      );
    }

    const oldManagerId = employee.managerId || null;
    const newManagerId = updateDto.managerId || null;
    if (oldManagerId !== newManagerId) {
      this.eventEmitter.emit(
        'manager.changed',
        new ManagerChangedEvent(
          id,
          oldManagerId,
          newManagerId,
          targetSubscriptionId,
        ),
      );
    }

    this.eventEmitter.emit(
      EMPLOYEE_EVENTS.UPDATED,
      new EmployeeUpdatedEvent(id, updateData, targetSubscriptionId),
    );

    // If status changed, emit status event too
    if (updateDto.status && updateDto.status !== employee.status) {
      await this.seatLimitService.syncEmployeeCounts(targetSubscriptionId);
      this.eventEmitter.emit(
        EMPLOYEE_EVENTS.STATUS_CHANGED,
        new EmployeeStatusChangedEvent(
          id,
          updateDto.status,
          targetSubscriptionId,
        ),
      );
    }

    return updated;
  }

  async remove(currentUserOrId: any, id?: string) {
    let currentUser: any = null;
    let targetId: string;

    if (id) {
      currentUser = currentUserOrId;
      targetId = id;
    } else {
      targetId = currentUserOrId;
    }

    const employee = await this.findOne(currentUser, targetId);
    const targetSubscriptionId = (employee as any).subscriptionId;

    // Subordinate protection
    const subordinatesCount = await this.prisma.employee.count({
      where: { managerId: targetId },
    });
    if (subordinatesCount > 0) {
      throw new BadRequestException(
        `Cannot delete manager. This employee still manages ${subordinatesCount} employees. Reassign them first.`,
      );
    }

    // Atomic deletion of linked User and Employee record
    const result = await this.prisma.$transaction(async (tx) => {
      if (employee.userId) {
        await this.employeeUserLinkService.removeLinkedUser(
          employee.userId,
          tx,
        );
      }
      return tx.employee.delete({
        where: { id: targetId },
      });
    });

    if (targetSubscriptionId) {
      await this.seatLimitService.syncEmployeeCounts(targetSubscriptionId);
    }

    this.eventEmitter.emit(
      EMPLOYEE_EVENTS.DELETED,
      new EmployeeDeletedEvent(targetId, targetSubscriptionId),
    );

    return result;
  }

  async uploadAvatar(
    currentUser: any,
    id: string,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  ) {
    if (!file) {
      throw new BadRequestException('No avatar image file provided');
    }

    if (!this.storageService) {
      throw new BadRequestException('Storage service is not available');
    }

    // RBAC check: user can only upload for themselves unless they are SuperAdmin or have EMPLOYEES_LIST_EDIT permission
    const isSuperAdmin = currentUser?.role === 'SuperAdmin';
    const hasFullEdit = currentUser?.permissions?.includes('EMPLOYEES_LIST_EDIT');
    const userEmpId = currentUser?.employee?.id || (currentUser as any)?.employeeId;

    if (!isSuperAdmin && !hasFullEdit) {
      if (!userEmpId || userEmpId !== id) {
        throw new ForbiddenException('You can only update your own avatar photo');
      }
    }

    const employee = await this.findOne(currentUser, id);
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    const targetCompanyId =
      (employee as any).companyId ||
      (employee as any).subscriptionId ||
      currentUser?.companyId ||
      'default';

    // Validate using storageService's centralized mime & size rules
    this.storageService.validateFile(file, 'employee-photos');

    // Save file via StorageService (S3 in production / local fallback)
    const uploadResult = await this.storageService.saveFile(
      file,
      'employee-photos',
      targetCompanyId,
    );

    const oldAvatar = employee.avatar;

    try {
      // Update employee record with storage key reference and clear raw photoData
      const updated = await this.prisma.employee.update({
        where: { id },
        data: {
          avatar: uploadResult.path,
          photoData: null, // Ensure base64 is cleared from database
          photoRotation: 0,
        },
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      });

      // Cleanup old avatar if it was an uploaded storage file (not a seed URL or initials)
      if (
        oldAvatar &&
        oldAvatar !== uploadResult.path &&
        (oldAvatar.includes('employee-photos') || oldAvatar.startsWith('tenants/'))
      ) {
        try {
          await this.storageService.deleteFile(oldAvatar);
        } catch (e) {
          this.logger.warn(`Failed to clean up old avatar ${oldAvatar}: ${e}`);
        }
      }

      return {
        id: updated.id,
        avatar: updated.avatar,
        url: `/api/employees/${updated.id}/avatar`,
      };
    } catch (dbError) {
      // Rollback newly uploaded file on DB update failure to prevent orphaned files
      try {
        await this.storageService.deleteFile(uploadResult.path);
      } catch (cleanupErr) {
        this.logger.error(`Failed to rollback avatar upload ${uploadResult.path}: ${cleanupErr}`);
      }
      throw dbError;
    }
  }

  async getAvatarStream(
    id: string,
  ): Promise<{ streamOrBuffer: Buffer | NodeJS.ReadableStream; mimeType: string } | null> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
      },
      select: {
        id: true,
        avatar: true,
        photoData: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    const avatarKey = employee.avatar || employee.photoData;
    if (!avatarKey) {
      return null;
    }

    // If it's a storage reference path
    if (
      this.storageService &&
      (avatarKey.includes('employee-photos') || avatarKey.startsWith('tenants/') || avatarKey.startsWith('uploads/'))
    ) {
      const ext = avatarKey.slice(avatarKey.lastIndexOf('.')).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.gif': 'image/gif',
      };
      const mimeType = mimeMap[ext] || 'image/jpeg';
      const streamOrBuffer = await this.storageService.getFileStream(avatarKey);
      return { streamOrBuffer, mimeType };
    }

    // If it's a legacy base64 data URL
    if (avatarKey.startsWith('data:image/')) {
      const parts = avatarKey.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const buffer = Buffer.from(parts[1], 'base64');
      return { streamOrBuffer: buffer, mimeType };
    }

    return null;
  }

  /**
   * Concurrency-safe, tenant-aware employee ID generator.
   * Finds the current highest numerical EMP suffix and generates the next sequential ID.
   */
  async generateNextEmployeeId(companyId: string, tx?: any): Promise<string> {
    const client = tx || this.prisma;

    const existingEmployees = await client.employee.findMany({
      where: {
        id: { startsWith: 'EMP' },
      },
      select: { id: true },
    });

    let maxNum = 0;
    for (const emp of existingEmployees) {
      const match = emp.id.match(/^EMP(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }

    let nextNum = maxNum + 1;
    let candidateId = `EMP${String(nextNum).padStart(3, '0')}`;

    while (await client.employee.findUnique({ where: { id: candidateId } })) {
      nextNum++;
      candidateId = `EMP${String(nextNum).padStart(3, '0')}`;
    }

    return candidateId;
  }
}
