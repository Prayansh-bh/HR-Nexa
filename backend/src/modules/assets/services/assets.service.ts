import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssetsRepository } from '../repositories/assets.repository';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { CreateAssetDto } from '../dto/create-asset.dto';
import { UpdateAssetDto } from '../dto/update-asset.dto';
import { AssignAssetDto } from '../dto/assign-asset.dto';
import { ReturnAssetDto } from '../dto/return-asset.dto';
import { MaintenanceAssetDto, RepairAssetDto } from '../dto/maintenance-asset.dto';
import { RetireAssetDto } from '../dto/retire-asset.dto';

export interface UserContext {
  id: string;
  name?: string;
  email?: string;
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assetsRepository: AssetsRepository,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getAssets(companyId?: string | null, options?: { page?: number; limit?: number }) {
    return this.assetsRepository.getAssets(companyId, options);
  }

  async getDevices(companyId?: string | null, options?: { page?: number; limit?: number }) {
    return this.assetsRepository.getDevices(companyId, options);
  }

  async getAssetById(tenantId: string, assetId: string) {
    const asset = await this.assetsRepository.getAssetById(assetId, tenantId);
    if (!asset) {
      throw new NotFoundException(`Asset with ID "${assetId}" not found`);
    }
    return asset;
  }

  async getAssetHistory(tenantId: string, assetId: string) {
    await this.getAssetById(tenantId, assetId);
    return this.assetsRepository.getHistory(assetId, tenantId);
  }

  async getEmployeeAssets(tenantId: string, employeeId: string) {
    return this.assetsRepository.getEmployeeAssets(employeeId, tenantId);
  }

  async createAsset(tenantId: string, dto: CreateAssetDto, user: UserContext) {
    if (dto.assetTag) {
      const existing = await this.assetsRepository.findAssetByTag(dto.assetTag, tenantId);
      if (existing) {
        throw new ConflictException(`Asset with tag "${dto.assetTag}" already exists in this organization`);
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.companyAsset.create({
        data: {
          companyId: tenantId,
          name: dto.name,
          type: dto.type,
          assetTag: dto.assetTag || null,
          brand: dto.brand || null,
          modelNumber: dto.modelNumber || null,
          serialNumber: dto.serialNumber || null,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
          purchaseCost: dto.purchaseCost !== undefined ? new Prisma.Decimal(dto.purchaseCost) : null,
          currency: dto.currency || 'USD',
          warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null,
          vendor: dto.vendor || null,
          condition: dto.condition || 'New',
          status: 'Available',
          notes: dto.notes || null,
          invoiceUrl: dto.invoiceUrl || null,
        },
        include: { assignedTo: true },
      });

      await tx.assetHistory.create({
        data: {
          assetId: asset.id,
          companyId: tenantId,
          action: 'CREATED',
          condition: dto.condition || 'New',
          remarks: `Asset created in inventory (${dto.name})`,
          actorId: user.id,
          actorName: user.name || 'Admin',
        },
      });

      return this.assetsRepository.mapAsset(asset);
    });

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: tenantId,
      action: 'ASSET_CREATED',
      details: `Created asset "${created.name}" (Tag: ${created.assetTag || 'N/A'}, Category: ${created.type})`,
    });

    return created;
  }

  async updateAsset(tenantId: string, assetId: string, dto: UpdateAssetDto, user: UserContext) {
    const existing = await this.getAssetById(tenantId, assetId);

    if (dto.assetTag && dto.assetTag !== existing.assetTag) {
      const duplicateTag = await this.assetsRepository.findAssetByTag(dto.assetTag, tenantId);
      if (duplicateTag && duplicateTag.id !== assetId) {
        throw new ConflictException(`Asset with tag "${dto.assetTag}" already exists in this organization`);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.companyAsset.update({
        where: { id: assetId },
        data: {
          name: dto.name !== undefined ? dto.name : undefined,
          type: dto.type !== undefined ? dto.type : undefined,
          assetTag: dto.assetTag !== undefined ? dto.assetTag : undefined,
          brand: dto.brand !== undefined ? dto.brand : undefined,
          modelNumber: dto.modelNumber !== undefined ? dto.modelNumber : undefined,
          serialNumber: dto.serialNumber !== undefined ? dto.serialNumber : undefined,
          purchaseDate: dto.purchaseDate !== undefined ? (dto.purchaseDate ? new Date(dto.purchaseDate) : null) : undefined,
          purchaseCost: dto.purchaseCost !== undefined ? (dto.purchaseCost !== null ? new Prisma.Decimal(dto.purchaseCost) : null) : undefined,
          currency: dto.currency !== undefined ? dto.currency : undefined,
          warrantyExpiry: dto.warrantyExpiry !== undefined ? (dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null) : undefined,
          vendor: dto.vendor !== undefined ? dto.vendor : undefined,
          condition: dto.condition !== undefined ? dto.condition : undefined,
          notes: dto.notes !== undefined ? dto.notes : undefined,
          invoiceUrl: dto.invoiceUrl !== undefined ? dto.invoiceUrl : undefined,
        },
        include: { assignedTo: true },
      });

      await tx.assetHistory.create({
        data: {
          assetId: asset.id,
          companyId: tenantId,
          action: 'UPDATED',
          condition: asset.condition,
          remarks: 'Asset specifications and details updated',
          actorId: user.id,
          actorName: user.name || 'Admin',
        },
      });

      return this.assetsRepository.mapAsset(asset);
    });

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: tenantId,
      action: 'ASSET_UPDATED',
      details: `Updated asset "${updated.name}" (ID: ${assetId})`,
    });

    return updated;
  }

  async assignAsset(tenantId: string, assetId: string, dto: AssignAssetDto, user: UserContext) {
    const result = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.companyAsset.findUnique({
        where: { id: assetId },
      });

      if (!asset || asset.companyId !== tenantId) {
        throw new NotFoundException(`Asset with ID "${assetId}" not found`);
      }

      if (asset.status !== 'Available') {
        throw new BadRequestException(
          `Asset cannot be assigned because its current status is "${asset.status}". Only "Available" assets can be assigned.`,
        );
      }

      const employee = await tx.employee.findUnique({
        where: { id: dto.employeeId },
      });

      if (!employee || employee.companyId !== tenantId) {
        throw new NotFoundException(`Employee with ID "${dto.employeeId}" not found in this company`);
      }

      if (employee.status === 'Inactive' || employee.deletedAt) {
        throw new BadRequestException(`Cannot assign asset to an inactive or deleted employee`);
      }

      const assignedDate = dto.assignedDate || new Date().toISOString().slice(0, 10);

      // Concurrency lock: update status atomically conditioned on status === 'Available'
      const updateResult = await tx.companyAsset.updateMany({
        where: {
          id: assetId,
          companyId: tenantId,
          status: 'Available',
        },
        data: {
          status: 'Assigned',
          assignedToId: employee.id,
          assignedDate,
          condition: dto.condition || asset.condition,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          `Asset assignment conflict: asset is no longer available or was concurrently modified by another request.`,
        );
      }

      await tx.assetHistory.create({
        data: {
          assetId,
          companyId: tenantId,
          employeeId: employee.id,
          action: 'ASSIGNED',
          condition: dto.condition || asset.condition,
          remarks: dto.remarks || `Assigned to employee ${employee.name}`,
          actorId: user.id,
          actorName: user.name || 'Admin',
        },
      });

      const updated = await tx.companyAsset.findUnique({
        where: { id: assetId },
        include: { assignedTo: true },
      });

      return {
        asset: this.assetsRepository.mapAsset(updated),
        employee,
      };
    });

    // Non-blocking notification dispatch
    this.sendAssignmentNotificationSafe(tenantId, result.asset, result.employee);

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: tenantId,
      action: 'ASSET_ASSIGNED',
      details: `Asset "${result.asset.name}" assigned to ${result.employee.name} (${result.employee.email})`,
    });

    return result.asset;
  }

  async returnAsset(tenantId: string, assetId: string, dto: ReturnAssetDto, user: UserContext) {
    const result = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.companyAsset.findUnique({
        where: { id: assetId },
        include: { assignedTo: true },
      });

      if (!asset || asset.companyId !== tenantId) {
        throw new NotFoundException(`Asset with ID "${assetId}" not found`);
      }

      if (asset.status !== 'Assigned') {
        throw new BadRequestException(
          `Cannot return asset with status "${asset.status}". Only "Assigned" assets can be returned to inventory.`,
        );
      }

      const previousEmployee = asset.assignedTo;
      const destinationStatus =
        dto.destinationStatus || (dto.condition === 'Damaged' ? 'Maintenance' : 'Available');

      const updateResult = await tx.companyAsset.updateMany({
        where: {
          id: assetId,
          companyId: tenantId,
          status: 'Assigned',
        },
        data: {
          status: destinationStatus,
          assignedToId: null,
          assignedDate: null,
          condition: dto.condition || asset.condition,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          `Asset return conflict: asset was concurrently returned or modified.`,
        );
      }

      await tx.assetHistory.create({
        data: {
          assetId,
          companyId: tenantId,
          employeeId: previousEmployee ? previousEmployee.id : null,
          action: 'RETURNED',
          condition: dto.condition,
          remarks: dto.remarks || `Returned from ${previousEmployee?.name || 'employee'} with condition "${dto.condition}"`,
          actorId: user.id,
          actorName: user.name || 'Admin',
        },
      });

      const updated = await tx.companyAsset.findUnique({
        where: { id: assetId },
        include: { assignedTo: true },
      });

      return {
        asset: this.assetsRepository.mapAsset(updated),
        previousEmployee,
      };
    });

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: tenantId,
      action: 'ASSET_RETURNED',
      details: `Asset "${result.asset.name}" returned by ${result.previousEmployee?.name || 'Unassigned'} (Condition: ${dto.condition}, New Status: ${result.asset.status})`,
    });

    return result.asset;
  }

  async sendToMaintenance(tenantId: string, assetId: string, dto: MaintenanceAssetDto, user: UserContext) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.companyAsset.findUnique({
        where: { id: assetId },
        include: { assignedTo: true },
      });

      if (!asset || asset.companyId !== tenantId) {
        throw new NotFoundException(`Asset with ID "${assetId}" not found`);
      }

      if (asset.status === 'Retired') {
        throw new BadRequestException(`Cannot send a "Retired" asset to maintenance. Reactivate or create new asset.`);
      }

      if (asset.status === 'Maintenance') {
        throw new BadRequestException(`Asset is already under maintenance.`);
      }

      const previousEmployee = asset.assignedTo;

      const updateResult = await tx.companyAsset.updateMany({
        where: {
          id: assetId,
          companyId: tenantId,
        },
        data: {
          status: 'Maintenance',
          assignedToId: null,
          assignedDate: null,
          condition: dto.condition || asset.condition,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(`Failed to update asset status.`);
      }

      await tx.assetHistory.create({
        data: {
          assetId,
          companyId: tenantId,
          employeeId: previousEmployee ? previousEmployee.id : null,
          action: 'MAINTENANCE',
          condition: dto.condition || asset.condition,
          remarks: dto.reason || 'Sent for inspection, maintenance, or repair',
          actorId: user.id,
          actorName: user.name || 'Admin',
        },
      });

      const updatedAsset = await tx.companyAsset.findUnique({
        where: { id: assetId },
        include: { assignedTo: true },
      });

      return this.assetsRepository.mapAsset(updatedAsset);
    });

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: tenantId,
      action: 'ASSET_MAINTENANCE',
      details: `Asset "${updated.name}" placed in Maintenance. Reason: ${dto.reason || 'N/A'}`,
    });

    return updated;
  }

  async completeRepair(tenantId: string, assetId: string, dto: RepairAssetDto, user: UserContext) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.companyAsset.findUnique({
        where: { id: assetId },
      });

      if (!asset || asset.companyId !== tenantId) {
        throw new NotFoundException(`Asset with ID "${assetId}" not found`);
      }

      if (asset.status !== 'Maintenance') {
        throw new BadRequestException(
          `Cannot mark repair completed for asset with status "${asset.status}". Asset must be in "Maintenance".`,
        );
      }

      const condition = dto.condition || 'Good';

      const updateResult = await tx.companyAsset.updateMany({
        where: {
          id: assetId,
          companyId: tenantId,
          status: 'Maintenance',
        },
        data: {
          status: 'Available',
          condition,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(`Failed to complete repair: asset was concurrently modified.`);
      }

      await tx.assetHistory.create({
        data: {
          assetId,
          companyId: tenantId,
          action: 'REPAIRED',
          condition,
          remarks: dto.remarks || 'Maintenance and repair completed. Asset returned to Available inventory.',
          actorId: user.id,
          actorName: user.name || 'Admin',
        },
      });

      const updatedAsset = await tx.companyAsset.findUnique({
        where: { id: assetId },
        include: { assignedTo: true },
      });

      return this.assetsRepository.mapAsset(updatedAsset);
    });

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: tenantId,
      action: 'ASSET_REPAIRED',
      details: `Repairs completed for asset "${updated.name}". Returned to inventory as "Available" (Condition: ${dto.condition || 'Good'})`,
    });

    return updated;
  }

  async retireAsset(tenantId: string, assetId: string, dto: RetireAssetDto, user: UserContext) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.companyAsset.findUnique({
        where: { id: assetId },
      });

      if (!asset || asset.companyId !== tenantId) {
        throw new NotFoundException(`Asset with ID "${assetId}" not found`);
      }

      if (asset.status === 'Assigned') {
        throw new BadRequestException(
          `Cannot retire an asset that is currently assigned to an employee. Return the asset first.`,
        );
      }

      if (asset.status === 'Retired') {
        throw new BadRequestException(`Asset is already retired.`);
      }

      const updateResult = await tx.companyAsset.updateMany({
        where: {
          id: assetId,
          companyId: tenantId,
        },
        data: {
          status: 'Retired',
          assignedToId: null,
          assignedDate: null,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(`Failed to retire asset.`);
      }

      await tx.assetHistory.create({
        data: {
          assetId,
          companyId: tenantId,
          action: 'RETIRED',
          remarks: dto.reason || 'Asset permanently decommissioned and retired',
          actorId: user.id,
          actorName: user.name || 'Admin',
        },
      });

      const updatedAsset = await tx.companyAsset.findUnique({
        where: { id: assetId },
        include: { assignedTo: true },
      });

      return this.assetsRepository.mapAsset(updatedAsset);
    });

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: tenantId,
      action: 'ASSET_RETIRED',
      details: `Asset "${updated.name}" decommissioned/retired. Reason: ${dto.reason || 'N/A'}`,
    });

    return updated;
  }

  async deleteAsset(tenantId: string, assetId: string, user: UserContext) {
    const asset = await this.prisma.companyAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset || asset.companyId !== tenantId) {
      throw new NotFoundException(`Asset with ID "${assetId}" not found`);
    }

    if (asset.status === 'Assigned') {
      throw new BadRequestException(
        `Cannot delete an asset that is currently assigned to an employee. Return the asset before deleting.`,
      );
    }

    // Controlled deletion policy: block hard delete if asset has historical assignment/custody records
    const assignmentHistoryCount = await this.prisma.assetHistory.count({
      where: {
        assetId,
        companyId: tenantId,
        action: { in: ['ASSIGNED', 'RETURNED'] },
      },
    });

    if (assignmentHistoryCount > 0) {
      throw new BadRequestException(
        `Cannot hard-delete asset "${asset.name}" because it has ${assignmentHistoryCount} historical assignment record(s). Please retire the asset instead to preserve compliance and audit trails.`,
      );
    }

    await this.prisma.companyAsset.delete({
      where: { id: assetId },
    });

    await this.auditLogger.logAction({
      userId: user.id,
      userName: user.name,
      companyId: tenantId,
      action: 'ASSET_DELETED',
      details: `Hard-deleted unused asset "${asset.name}" (Tag: ${asset.assetTag || 'N/A'}, Serial: ${asset.serialNumber || 'N/A'})`,
    });

    return { success: true, message: `Asset "${asset.name}" was successfully deleted.` };
  }

  private async sendAssignmentNotificationSafe(
    tenantId: string,
    asset: any,
    employee: any,
  ): Promise<void> {
    try {
      if (!employee?.userId) return;

      const serialStr = asset.serialNumber ? `, S/N: ${asset.serialNumber}` : '';
      const tagStr = asset.assetTag ? ` [${asset.assetTag}]` : '';

      await this.prisma.systemNotification.create({
        data: {
          company: tenantId,
          recipientId: employee.userId,
          category: 'assets',
          severity: 'info',
          title: `Asset Allocated: ${asset.name}`,
          message: `Company asset "${asset.name}"${tagStr} (${asset.type || asset.category}${serialStr}) has been assigned to you.`,
          linkUrl: '/assets',
          readBy: '[]',
          dedupKey: `ASSET_ASSIGN:${asset.id}:${employee.id}:${Date.now()}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(
        `Failed to dispatch non-blocking asset allocation notification: ${err.message}`,
      );
    }
  }
}
