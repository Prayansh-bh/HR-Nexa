import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Document, Prisma } from '@prisma/client';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any): Promise<Document> {
    // @ts-ignore
    return this.prisma.document.create({
      data,
      include: {
        company: { select: { name: true } },
        employee: {
          include: {
            designation: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        uploadedBy: true,
        verifiedBy: true,
      } as any,
    });
  }

  async findMany(
    scope: TenantScope,
    category?: string,
    employeeId?: string,
    verificationStatus?: string,
    search?: string,
    page?: number,
    limit?: number,
    docType?: string,
    status?: string,
  ): Promise<PaginatedResponse<Document>> {
    const where: any = { deletedAt: null };

    if (!scope.isPlatformBypass) {
      where.companyId = scope.companyId;
    } else {
      where.company = { isDemo: false };
    }

    if (category) where.category = category;
    if (employeeId) where.employeeId = employeeId;
    if (verificationStatus) where.verificationStatus = verificationStatus;
    if (docType) where.docType = docType;
    if (status) where.status = status;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { docType: { contains: q, mode: 'insensitive' } },
        { fileName: { contains: q, mode: 'insensitive' } },
        { employee: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const safePage = page && Number(page) > 0 ? Math.floor(Number(page)) : 1;
    const safeLimit = Math.min(
      limit && Number(limit) > 0 ? Math.floor(Number(limit)) : 50,
      100,
    );
    const skip = (safePage - 1) * safeLimit;
    const take = safeLimit;

    const [total, data] = await Promise.all([
      this.prisma.document.count({ where }),
      // @ts-ignore
      this.prisma.document.findMany({
        where,
        include: {
          company: { select: { name: true } },
          employee: {
            include: {
              designation: { select: { name: true } },
              department: { select: { name: true } },
            },
          },
          uploadedBy: true,
          verifiedBy: true,
        } as any,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return createPaginatedResponse(data, total, safePage, safeLimit);
  }

  async findById(id: string, scope?: TenantScope): Promise<Document | null> {
    const where: any = { id, deletedAt: null };
    if (scope && !scope.isPlatformBypass) {
      where.companyId = scope.companyId;
    }

    // @ts-ignore
    return this.prisma.document.findFirst({
      where,
      include: {
        company: { select: { name: true } },
        employee: {
          include: {
            designation: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        uploadedBy: true,
        verifiedBy: true,
      } as any,
    });
  }

  async updateVerificationStatus(
    id: string,
    targetStatus: string,
    actorId: string,
    note?: string,
    scope?: TenantScope,
  ): Promise<boolean> {
    const where: any = {
      id,
      verificationStatus: 'PENDING',
      deletedAt: null,
    };
    if (scope && !scope.isPlatformBypass) {
      where.companyId = scope.companyId;
    }

    const res = await this.prisma.document.updateMany({
      where,
      data: {
        verificationStatus: targetStatus as any,
        verificationNote: note || null,
        verifiedById: actorId,
        verifiedAt: new Date(),
      },
    });

    return res.count > 0;
  }

  async delete(id: string, scope?: TenantScope): Promise<Document> {
    if (scope && !scope.isPlatformBypass) {
      const doc = await this.findById(id, scope);
      if (!doc) {
        throw new Error('Document not found or access denied');
      }
    }
    return this.prisma.document.delete({ where: { id } });
  }
}
