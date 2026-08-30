import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

export type TaxRegime = 'OLD' | 'NEW';
export type TaxDeclarationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CORRECTION_REQUIRED';

@Injectable()
export class TaxDeclarationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get taxDeclaration() {
    return (this.prisma as any).taxDeclaration;
  }

  private get taxDeclarationItem() {
    return (this.prisma as any).taxDeclarationItem;
  }

  async findByEmployeeAndFiscalYear(companyId: string, employeeId: string, fiscalYearId: string) {
    return this.taxDeclaration.findFirst({
      where: {
        companyId,
        employeeId,
        fiscalYearId,
      },
      include: {
        items: {
          include: {
            proofDocument: true,
          },
        },
        fiscalYear: true,
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            pan: true,
            department: true,
          },
        },
      },
    });
  }

  async findByIdAndTenant(id: string, companyId: string) {
    return this.taxDeclaration.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        items: {
          include: {
            proofDocument: true,
          },
        },
        fiscalYear: true,
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            pan: true,
            department: true,
          },
        },
      },
    });
  }

  async findTenantDeclarations(
    companyId: string,
    options?: { fiscalYearId?: string; status?: TaxDeclarationStatus; page?: number; limit?: number },
  ): Promise<PaginatedResponse<any>> {
    const rawPage = Number(options?.page);
    const page = !isNaN(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const rawLimit = Number(options?.limit);
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (options?.fiscalYearId) where.fiscalYearId = options.fiscalYearId;
    if (options?.status) where.status = options.status;

    const [total, data] = await Promise.all([
      this.taxDeclaration.count({ where }),
      this.taxDeclaration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          items: {
            include: {
              proofDocument: true,
            },
          },
          fiscalYear: true,
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              pan: true,
              department: true,
            },
          },
        },
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async create(data: {
    companyId: string;
    employeeId: string;
    fiscalYearId: string;
    regime: TaxRegime;
    items: Array<{ section: string; category: string; declaredAmount: number; proofDocumentId?: string; remarks?: string }>;
  }) {
    const totalDeclared = data.items.reduce((sum, item) => sum + (item.declaredAmount || 0), 0);

    return this.prisma.$transaction(async (tx) => {
      const declDelegate = (tx as any).taxDeclaration;
      const decl = await declDelegate.create({
        data: {
          companyId: data.companyId,
          employeeId: data.employeeId,
          fiscalYearId: data.fiscalYearId,
          regime: data.regime,
          status: 'DRAFT',
          totalDeclared,
          totalApproved: 0,
          items: {
            create: data.items.map((item) => ({
              section: item.section.toUpperCase(),
              category: item.category,
              declaredAmount: item.declaredAmount,
              approvedAmount: 0,
              proofDocumentId: item.proofDocumentId || null,
              remarks: item.remarks || null,
            })),
          },
        },
        include: {
          items: {
            include: {
              proofDocument: true,
            },
          },
          fiscalYear: true,
        },
      });
      return decl;
    });
  }

  async updateDraft(
    id: string,
    companyId: string,
    data: {
      regime?: TaxRegime;
      items?: Array<{ section: string; category: string; declaredAmount: number; proofDocumentId?: string; remarks?: string }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const declDelegate = (tx as any).taxDeclaration;
      const itemDelegate = (tx as any).taxDeclarationItem;

      if (data.items) {
        // Delete existing items and recreate
        await itemDelegate.deleteMany({
          where: { taxDeclarationId: id },
        });

        const totalDeclared = data.items.reduce((sum, item) => sum + (item.declaredAmount || 0), 0);

        await declDelegate.update({
          where: { id },
          data: {
            regime: data.regime,
            totalDeclared,
            items: {
              create: data.items.map((item) => ({
                section: item.section.toUpperCase(),
                category: item.category,
                declaredAmount: item.declaredAmount,
                approvedAmount: 0,
                proofDocumentId: item.proofDocumentId || null,
                remarks: item.remarks || null,
              })),
            },
          },
        });
      } else if (data.regime) {
        await declDelegate.update({
          where: { id },
          data: { regime: data.regime },
        });
      }

      return this.findByIdAndTenant(id, companyId);
    });
  }

  async submit(id: string, companyId: string) {
    return this.taxDeclaration.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      include: {
        items: true,
        fiscalYear: true,
      },
    });
  }

  async auditDecision(
    id: string,
    companyId: string,
    reviewerId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED',
    remarks?: string,
    itemApprovals?: Array<{ itemId: string; approvedAmount: number; remarks?: string }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const declDelegate = (tx as any).taxDeclaration;
      const itemDelegate = (tx as any).taxDeclarationItem;

      let totalApproved = 0;

      if (decision === 'APPROVED' && itemApprovals && itemApprovals.length > 0) {
        for (const itemApp of itemApprovals) {
          await itemDelegate.update({
            where: { id: itemApp.itemId },
            data: {
              approvedAmount: itemApp.approvedAmount,
              remarks: itemApp.remarks || null,
            },
          });
          totalApproved += itemApp.approvedAmount;
        }
      } else if (decision === 'APPROVED') {
        // Default: approve full declared amounts if itemApprovals not explicitly specified
        const existingItems = await itemDelegate.findMany({ where: { taxDeclarationId: id } });
        for (const item of existingItems) {
          await itemDelegate.update({
            where: { id: item.id },
            data: { approvedAmount: item.declaredAmount },
          });
          totalApproved += item.declaredAmount;
        }
      } else {
        // REJECTED or CORRECTION_REQUIRED resets approved amounts to 0
        await itemDelegate.updateMany({
          where: { taxDeclarationId: id },
          data: { approvedAmount: 0 },
        });
        totalApproved = 0;
      }

      const updated = await declDelegate.update({
        where: { id },
        data: {
          status: decision,
          totalApproved,
          remarks: remarks || null,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: {
          items: {
            include: {
              proofDocument: true,
            },
          },
          fiscalYear: true,
          employee: true,
        },
      });

      return updated;
    });
  }
}
