import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { FiscalYearRepository, FiscalYearStatus } from '../repositories/fiscal-year.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';
import { CreateFiscalYearDto } from '../dto/create-fiscal-year.dto';
import { UpdateFiscalYearDto } from '../dto/update-fiscal-year.dto';

@Injectable()
export class FiscalYearService {
  constructor(
    private readonly fiscalYearRepository: FiscalYearRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(scope: TenantScope) {
    const companyId = scope.companyId;
    let list = await this.fiscalYearRepository.findAll(companyId);

    // Seed default current fiscal year (e.g. FY 2026-27) if empty for onboarded company
    if (list.length === 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const startYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
      const endYear = startYear + 1;

      await this.fiscalYearRepository.create({
        companyId,
        name: `FY ${startYear}-${endYear.toString().slice(-2)}`,
        startDate: new Date(`${startYear}-04-01T00:00:00.000Z`),
        endDate: new Date(`${endYear}-03-31T23:59:59.999Z`),
        status: 'ACTIVE',
      }).catch(() => null);

      list = await this.fiscalYearRepository.findAll(companyId);
    }
    return list;
  }

  async findById(id: string, scope: TenantScope) {
    const companyId = scope.companyId;
    const item = await this.fiscalYearRepository.findById(id, companyId);
    if (!item) {
      throw new NotFoundException(`Fiscal year record not found or access denied`);
    }
    return item;
  }

  async create(scope: TenantScope, user: any, dto: CreateFiscalYearDto) {
    const companyId = scope.companyId;
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end date format');
    }

    if (end <= start) {
      throw new BadRequestException('Fiscal year end date must be strictly after start date');
    }

    // Check duplicate name
    const existingName = await this.fiscalYearRepository.findByName(dto.name.trim(), companyId);
    if (existingName) {
      throw new ConflictException('A fiscal year with this name already exists for your company.');
    }

    // Check overlapping periods
    const overlap = await this.fiscalYearRepository.findOverlapping(companyId, start, end);
    if (overlap) {
      throw new ConflictException(`Fiscal year date range overlaps with existing period '${overlap.name}'`);
    }

    const created = await this.fiscalYearRepository.create({
      companyId,
      name: dto.name.trim(),
      startDate: start,
      endDate: end,
      status: 'DRAFT',
    });

    // Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'System',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'HRAdmin',
          entityType: 'COMPANY_SETTINGS' as any,
          action: 'FISCAL_YEAR_CREATED',
          details: `[FISCAL_YEAR_CREATED] Created draft fiscal year '${created.name}' (${dto.startDate} to ${dto.endDate})`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return created;
  }

  async update(id: string, scope: TenantScope, user: any, dto: UpdateFiscalYearDto) {
    const companyId = scope.companyId;
    const existing = await this.findById(id, scope);

    if (existing.isLocked) {
      throw new BadRequestException('This fiscal year is locked and cannot be modified');
    }
    if (existing.status === 'CLOSED') {
      throw new BadRequestException('A CLOSED fiscal year cannot be modified');
    }

    let start = existing.startDate;
    let end = existing.endDate;

    if (dto.startDate) start = new Date(dto.startDate);
    if (dto.endDate) end = new Date(dto.endDate);

    if (end <= start) {
      throw new BadRequestException('Fiscal year end date must be strictly after start date');
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const dup = await this.fiscalYearRepository.findByName(dto.name.trim(), companyId);
      if (dup && dup.id !== id) {
        throw new ConflictException('A fiscal year with this name already exists for your company.');
      }
    }

    const overlap = await this.fiscalYearRepository.findOverlapping(companyId, start, end, id);
    if (overlap) {
      throw new ConflictException(`Fiscal year date range overlaps with existing period '${overlap.name}'`);
    }

    await this.fiscalYearRepository.update(id, companyId, {
      name: dto.name ? dto.name.trim() : undefined,
      startDate: dto.startDate ? start : undefined,
      endDate: dto.endDate ? end : undefined,
    });

    const updated = await this.findById(id, scope);

    // Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'System',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'HRAdmin',
          entityType: 'COMPANY_SETTINGS' as any,
          action: 'FISCAL_YEAR_UPDATED',
          details: `[FISCAL_YEAR_UPDATED] Updated fiscal year '${existing.name}' (ID: ${id})`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return updated;
  }

  async activate(id: string, scope: TenantScope, user: any) {
    const companyId = scope.companyId;
    const existing = await this.findById(id, scope);

    if (existing.status === 'CLOSED') {
      throw new BadRequestException('Cannot activate a CLOSED fiscal year');
    }

    const activated = await this.fiscalYearRepository.activate(id, companyId);

    // Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'System',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'HRAdmin',
          entityType: 'COMPANY_SETTINGS' as any,
          action: 'FISCAL_YEAR_ACTIVATED',
          details: `[FISCAL_YEAR_ACTIVATED] Activated fiscal year '${existing.name}' as current operational period`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return activated;
  }

  async close(id: string, scope: TenantScope, user: any) {
    const companyId = scope.companyId;
    const existing = await this.findById(id, scope);

    const closed = await this.fiscalYearRepository.close(id, companyId);

    // Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'System',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'HRAdmin',
          entityType: 'COMPANY_SETTINGS' as any,
          action: 'FISCAL_YEAR_CLOSED',
          details: `[FISCAL_YEAR_CLOSED] Finalized and closed fiscal year '${existing.name}'`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return closed;
  }

  async lock(id: string, scope: TenantScope, user: any) {
    const companyId = scope.companyId;
    const existing = await this.findById(id, scope);

    const locked = await this.fiscalYearRepository.lock(id, companyId);

    // Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'System',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'HRAdmin',
          entityType: 'COMPANY_SETTINGS' as any,
          action: 'FISCAL_YEAR_LOCKED',
          details: `[FISCAL_YEAR_LOCKED] Admin-locked fiscal year '${existing.name}'`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return locked;
  }

  async delete(id: string, scope: TenantScope, user: any) {
    const companyId = scope.companyId;
    const existing = await this.findById(id, scope);

    if (existing.status === 'ACTIVE' || existing.status === 'CLOSED') {
      throw new BadRequestException(`Cannot delete ${existing.status} fiscal year. Only DRAFT records can be deleted.`);
    }

    await this.fiscalYearRepository.softDelete(id, companyId, user?.id || 'system');

    return { success: true, message: `Draft fiscal year '${existing.name}' deleted successfully` };
  }
}
