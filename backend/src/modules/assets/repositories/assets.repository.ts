import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

@Injectable()
export class AssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAssets(
    companyId?: string | null,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<any>> {
    const where: Prisma.CompanyAssetWhereInput = {};
    if (companyId) where.companyId = companyId;

    const rawPage = Number(options?.page);
    const page = !isNaN(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const rawLimit = Number(options?.limit);
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;

    const [total, rawData] = await Promise.all([
      this.prisma.companyAsset.count({ where }),
      this.prisma.companyAsset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          assignedTo: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const data = rawData.map((a) => this.mapAsset(a));
    return createPaginatedResponse(data, total, page, limit);
  }

  async getAssetById(id: string, companyId?: string | null, client?: Prisma.TransactionClient) {
    const db = client || this.prisma;
    const where: Prisma.CompanyAssetWhereInput = { id };
    if (companyId) where.companyId = companyId;

    const raw = await db.companyAsset.findFirst({
      where,
      include: {
        assignedTo: true,
      },
    });
    return raw ? this.mapAsset(raw) : null;
  }

  async findAssetByTag(assetTag: string, companyId: string, client?: Prisma.TransactionClient) {
    const db = client || this.prisma;
    const raw = await db.companyAsset.findFirst({
      where: { assetTag, companyId },
    });
    return raw ? this.mapAsset(raw) : null;
  }

  async getEmployeeAssets(employeeId: string, companyId: string) {
    const rawData = await this.prisma.companyAsset.findMany({
      where: { companyId, assignedToId: employeeId },
      include: {
        assignedTo: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rawData.map((a) => this.mapAsset(a));
  }

  async createAsset(data: Prisma.CompanyAssetCreateInput, client?: Prisma.TransactionClient) {
    const db = client || this.prisma;
    const created = await db.companyAsset.create({
      data,
      include: {
        assignedTo: true,
      },
    });
    return this.mapAsset(created);
  }

  async updateAsset(id: string, data: Prisma.CompanyAssetUpdateInput, client?: Prisma.TransactionClient) {
    const db = client || this.prisma;
    const updated = await db.companyAsset.update({
      where: { id },
      data,
      include: {
        assignedTo: true,
      },
    });
    return this.mapAsset(updated);
  }

  async deleteAsset(id: string, client?: Prisma.TransactionClient) {
    const db = client || this.prisma;
    return db.companyAsset.delete({
      where: { id },
    });
  }

  async createHistory(data: Prisma.AssetHistoryCreateInput, client?: Prisma.TransactionClient) {
    const db = client || this.prisma;
    return db.assetHistory.create({
      data,
      include: {
        employee: true,
      },
    });
  }

  async getHistory(assetId: string, companyId: string) {
    return this.prisma.assetHistory.findMany({
      where: { assetId, companyId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async countHistory(where: Prisma.AssetHistoryWhereInput) {
    return this.prisma.assetHistory.count({ where });
  }

  async getDevices(
    companyId?: string | null,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<any>> {
    const where: Prisma.CompanyDeviceWhereInput = {};
    if (companyId) where.companyId = companyId;

    const rawPage = Number(options?.page);
    const page = !isNaN(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const rawLimit = Number(options?.limit);
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;

    const [total, rawData] = await Promise.all([
      this.prisma.companyDevice.count({ where }),
      this.prisma.companyDevice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const data = rawData.map((d) => this.mapDevice(d));
    return createPaginatedResponse(data, total, page, limit);
  }

  mapAsset(raw: any) {
    return {
      ...raw,
      category: raw.type || 'General Asset',
      purchaseCost: raw.purchaseCost ? Number(raw.purchaseCost) : null,
      assignedToUser: raw.assignedTo
        ? {
            id: raw.assignedTo.id,
            name: raw.assignedTo.name,
            email: raw.assignedTo.email,
          }
        : null,
    };
  }

  mapDevice(raw: any) {
    return {
      ...raw,
      deviceName: raw.name,
      ipAddress: raw.ip,
      location: raw.location || null,
      lastSyncAt: raw.lastSeen,
    };
  }
}
