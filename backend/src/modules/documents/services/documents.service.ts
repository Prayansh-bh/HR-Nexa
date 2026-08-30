import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DocumentsRepository } from '../repositories/documents.repository';
import { EmployeesRepository } from '../../employees/repositories/employees.repository';
import { AuditLogsRepository } from '../../system/repositories/audit-logs.repository';
import { StorageService, UploadCategory } from '../../../common/storage/storage.service';
import { normalizeUploadCategory } from '../../../common/storage/storage.constants';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';
import * as fs from 'fs';

import { SalaryComponentCalculatorService } from '../../payroll/services/salary-component-calculator.service';
import { StatutoryRulesService } from '../../payroll/services/statutory-rules.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OfferLetterTemplateService } from '../../../common/documents/offer-letter-template.service';
import { GenerateEmployeeOfferDto } from '../dto/generate-employee-offer.dto';
import { PreviewEmployeeOfferDto } from '../dto/preview-employee-offer.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly employeesRepository: EmployeesRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
    private readonly storageService: StorageService,
    private readonly salaryCalculator: SalaryComponentCalculatorService,
    private readonly statutoryRulesService: StatutoryRulesService,
    private readonly prisma: PrismaService,
    private readonly offerLetterTemplateService: OfferLetterTemplateService,
  ) {}

  async uploadFile(file: any, data: any) {
    if (data.employeeId) {
      const emp = await this.employeesRepository.findById(data.employeeId);
      if (!emp) {
        throw new NotFoundException(`Employee with ID ${data.employeeId} not found`);
      }
    }

    if (file) {
      const category: UploadCategory = normalizeUploadCategory(data.category);
      const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : Buffer.from(''));

      const uploadResult = await this.storageService.saveFile(
        {
          originalname: file.originalname,
          mimetype: file.mimetype,
          buffer: fileBuffer,
          size: file.size,
        },
        category,
        data.companyId,
      );

      data.filePath = uploadResult.path;
    }

    return this.documentsRepository.create(data);
  }

  async upload(data: any) {
    if (data.employeeId) {
      const emp = await this.employeesRepository.findById(data.employeeId);
      if (!emp) {
        throw new NotFoundException(`Employee with ID ${data.employeeId} not found`);
      }
    }

    return this.documentsRepository.create(data);
  }

  async download(id: string, scope?: TenantScope) {
    const doc = await this.findOne(id, scope);

    // 1. If physical filePath exists in storage, stream from storage
    if (doc.filePath) {
      const fileExists = await this.storageService.exists(doc.filePath);
      if (fileExists) {
        const streamOrBuffer = await this.storageService.getFileStream(doc.filePath);
        return { doc, streamOrBuffer };
      }
    }

    // 2. If legacy fileData (Base64) exists
    if ((doc as any).fileData) {
      const buffer = Buffer.from((doc as any).fileData, 'base64');
      return { doc, streamOrBuffer: buffer };
    }

    // 3. Fail-proof Fallback: Generate a clean text document summary with verification record details
    const empName = (doc as any).employee?.name || 'Employee';
    const docTitle = doc.title || doc.docType || 'Document';
    const fileName = doc.fileName || `${docTitle.toLowerCase().replace(/\s+/g, '_')}.txt`;

    const fallbackContent = `================================================
HR NEXA — DOCUMENT VERIFICATION RECORD
================================================
Document ID          : ${doc.id}
Title / Type         : ${docTitle} (${doc.docType})
File Name            : ${fileName}
Employee             : ${empName}
Size                 : ${doc.size || 'N/A'}
Category             : ${doc.category}
Verification Status  : ${(doc as any).verificationStatus || 'PENDING'}
Expiry Status        : ${doc.status}
Created At           : ${doc.createdAt}
================================================
Note: This document record summary was generated automatically by HR Nexa.
`;

    const buffer = Buffer.from(fallbackContent, 'utf-8');
    return { doc: { ...doc, fileName }, streamOrBuffer: buffer };
  }

  async findAll(
    scope: TenantScope,
    category?: string,
    employeeId?: string,
    verificationStatus?: string,
    search?: string,
    page?: number,
    limit?: number,
    docType?: string,
    status?: string,
  ) {
    return this.documentsRepository.findMany(
      scope,
      category,
      employeeId,
      verificationStatus,
      search,
      page,
      limit,
      docType,
      status,
    );
  }

  async findOne(id: string, scope?: TenantScope) {
    const doc = await this.documentsRepository.findById(id, scope);
    if (!doc) {
      throw new NotFoundException(`Document not found`);
    }
    return doc;
  }

  async verifyDocument(
    id: string,
    note: string | undefined,
    scope: TenantScope,
    actor: { id: string; role: string; employee?: { id: string } | null },
  ) {
    const doc = await this.findOne(id, scope);

    // P2-1 Remediation: A user MUST NOT verify their own uploaded document
    if (doc.employeeId && actor.employee?.id && actor.employee.id === doc.employeeId) {
      throw new ForbiddenException('You cannot verify your own uploaded document.');
    }
    const updated = await this.documentsRepository.updateVerificationStatus(
      id,
      'VERIFIED',
      actor.id,
      note,
      scope,
    );

    if (!updated) {
      throw new ConflictException('Document is no longer pending verification or access denied');
    }

    await this.auditLogsRepository.create({
      actorId: actor.id,
      actorRole: actor.role,
      companyId: scope.companyId,
      entityType: 'COMPANY_SETTINGS' as any,
      action: 'DOCUMENT_VERIFIED' as any,
      details: JSON.stringify({
        documentId: doc.id,
        employeeId: doc.employeeId,
        companyId: scope.companyId,
        actorId: actor.id,
        actorRole: actor.role,
        oldVerificationStatus: (doc as any).verificationStatus || 'PENDING',
        newVerificationStatus: 'VERIFIED',
        verifiedAt: new Date().toISOString(),
        note: note || null,
      }),
    });

    return this.findOne(id, scope);
  }

  async rejectDocument(
    id: string,
    reason: string,
    scope: TenantScope,
    actor: { id: string; role: string; employee?: { id: string } | null },
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('A valid rejection reason (min 5 characters) is required');
    }

    const doc = await this.findOne(id, scope);
    const updated = await this.documentsRepository.updateVerificationStatus(
      id,
      'REJECTED',
      actor.id,
      reason,
      scope,
    );

    if (!updated) {
      throw new ConflictException('Document is no longer pending verification or access denied');
    }

    await this.auditLogsRepository.create({
      actorId: actor.id,
      actorRole: actor.role,
      companyId: scope.companyId,
      entityType: 'COMPANY_SETTINGS' as any,
      action: 'DOCUMENT_REJECTED' as any,
      details: JSON.stringify({
        documentId: doc.id,
        employeeId: doc.employeeId,
        companyId: scope.companyId,
        actorId: actor.id,
        actorRole: actor.role,
        oldVerificationStatus: (doc as any).verificationStatus || 'PENDING',
        newVerificationStatus: 'REJECTED',
        verifiedAt: new Date().toISOString(),
        reason,
      }),
    });

    return this.findOne(id, scope);
  }

  async remove(id: string, scope?: TenantScope) {
    const doc = await this.findOne(id, scope);

    if (doc.filePath) {
      await this.storageService.deleteFile(doc.filePath);
    }
    return this.documentsRepository.delete(id, scope);
  }

  async generateEmployeeOffer(scope: TenantScope, dto: GenerateEmployeeOfferDto) {
    const emp = await this.employeesRepository.findById(dto.employeeId);
    if (!emp) {
      throw new NotFoundException(`Employee with ID ${dto.employeeId} not found`);
    }

    if (emp.companyId && scope.companyId && emp.companyId !== scope.companyId) {
      throw new ForbiddenException(`Access denied to employee in another tenant`);
    }

    // 1. Calculate compensation breakdown
    const annualCTC = Number(dto.annualCTC);
    const statRules = await this.statutoryRulesService.getStatutoryRules();
    const salaryComponents = await (this.prisma as any).salaryComponent.findMany({
      where: { companyId: scope.companyId, deletedAt: null },
    });

    const monthlyCTC = Math.round((annualCTC / 12) * 100) / 100;
    const estimatedBasicFromCTC = monthlyCTC * (statRules.basicPercentage / 100);
    const employerPfMonthly = Math.min(1800, Math.round(estimatedBasicFromCTC * (statRules.pfRate / 100)));
    const monthlyGross = Math.round((monthlyCTC - employerPfMonthly) * 100) / 100;
    const annualGross = Math.round(monthlyGross * 12 * 100) / 100;

    const { components } = this.salaryCalculator.calculateComponents(
      monthlyGross,
      0,
      statRules,
      salaryComponents,
    );

    const basicMonthly = Math.round(monthlyGross * (statRules.basicPercentage / 100));
    const hraMonthly = Math.round(monthlyGross * (statRules.hraPercentage / 100));
    const specialAllowanceMonthly = Math.max(0, monthlyGross - basicMonthly - hraMonthly);
    const employeePfMonthly = Math.min(1800, Math.round(basicMonthly * (statRules.pfRate / 100)));
    const ptMonthly = components.find((c) => c.name.toLowerCase().includes('professional tax'))?.amount || statRules.ptAmount;
    const netTakeHomeMonthly = Math.max(0, monthlyGross - employeePfMonthly - ptMonthly);

    const preview = {
      annualCTC,
      monthlyCTC,
      annualGross,
      monthlyGross,
      netTakeHomeMonthly,
      breakdown: [
        { name: 'Basic Salary', category: 'EARNING', monthly: basicMonthly, annual: Math.round(basicMonthly * 12) },
        { name: 'House Rent Allowance (HRA)', category: 'EARNING', monthly: hraMonthly, annual: Math.round(hraMonthly * 12) },
        { name: 'Special Allowance', category: 'EARNING', monthly: specialAllowanceMonthly, annual: Math.round(specialAllowanceMonthly * 12) },
        { name: 'Employer Provident Fund (EPF)', category: 'BENEFIT', monthly: employerPfMonthly, annual: Math.round(employerPfMonthly * 12) },
        { name: 'Employee Provident Fund (EPF)', category: 'DEDUCTION', monthly: employeePfMonthly, annual: Math.round(employeePfMonthly * 12) },
        { name: 'Professional Tax (PT)', category: 'DEDUCTION', monthly: ptMonthly, annual: Math.round(ptMonthly * 12) },
      ],
    };

    // 2. Load Company info
    const companyRecord = await (this.prisma as any).company.findFirst({
      where: { id: scope.companyId },
      include: { settings: true },
    });
    const companyName = companyRecord?.name || 'HR Nexa Enterprise';
    const companyAddress = companyRecord?.settings?.address || 'Bangalore, India';
    const issueDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const offerRef = `OFF-EMP-${emp.id.slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const designationString =
      typeof emp.designation === 'string'
        ? emp.designation
        : (emp.designation as any)?.name || 'Employee';

    // 3. Compile HTML using canonical template service
    const html = this.offerLetterTemplateService.compileOfferLetterHtml({
      recipientName: emp.name,
      designation: dto.designation || designationString,
      companyName,
      companyAddress,
      issueDate,
      joiningDate: dto.joiningDate || emp.joined || 'Immediate',
      offerRef,
      expiryDate: dto.expiryDate,
      terms: dto.terms,
      preview,
    });

    // 4. Save file in storage
    const fileName = `offer_letter_employee_${emp.name.replace(/\s+/g, '_').toLowerCase()}.html`;
    const buffer = Buffer.from(html, 'utf-8');
    const uploadResult = await this.storageService.saveFile(
      {
        originalname: fileName,
        mimetype: 'text/html',
        buffer,
        size: buffer.length,
      },
      'hr_letter' as UploadCategory,
      scope.companyId,
    );

    // 5. Create Document record tied to Employee
    const document = await this.documentsRepository.create({
      companyId: scope.companyId,
      employeeId: emp.id,
      title: `Offer Letter - ${emp.name}`,
      docType: 'Offer',
      category: 'HR_LETTER',
      filePath: uploadResult.path,
      fileName,
      size: `${Math.max(1, Math.round(buffer.length / 1024))} KB`,
      status: 'VALID',
      verificationStatus: 'VERIFIED',
    });

    return {
      document,
      preview,
    };
  }

  async previewEmployeeOffer(scope: TenantScope, dto: PreviewEmployeeOfferDto) {
    const emp = await this.employeesRepository.findById(dto.employeeId);
    if (!emp) {
      throw new NotFoundException(`Employee with ID ${dto.employeeId} not found`);
    }

    if (!scope.isPlatformBypass && emp.companyId && scope.companyId && emp.companyId !== scope.companyId) {
      throw new ForbiddenException(`Access denied to employee in another tenant`);
    }

    const annualCTC = Number(dto.annualCTC);
    if (isNaN(annualCTC) || annualCTC <= 0) {
      throw new BadRequestException('Annual CTC must be a positive valid number.');
    }

    const statRules = await this.statutoryRulesService.getStatutoryRules();
    const salaryComponents = await (this.prisma as any).salaryComponent.findMany({
      where: { companyId: scope.companyId, deletedAt: null },
    });

    const monthlyCTC = Math.round((annualCTC / 12) * 100) / 100;
    const estimatedBasicFromCTC = monthlyCTC * (statRules.basicPercentage / 100);
    const employerPfMonthly = Math.min(1800, Math.round(estimatedBasicFromCTC * (statRules.pfRate / 100)));
    const monthlyGross = Math.round((monthlyCTC - employerPfMonthly) * 100) / 100;
    const annualGross = Math.round(monthlyGross * 12 * 100) / 100;

    const { components } = this.salaryCalculator.calculateComponents(
      monthlyGross,
      0,
      statRules,
      salaryComponents,
    );

    const basicMonthly = Math.round(monthlyGross * (statRules.basicPercentage / 100));
    const hraMonthly = Math.round(monthlyGross * (statRules.hraPercentage / 100));
    const specialAllowanceMonthly = Math.max(0, monthlyGross - basicMonthly - hraMonthly);
    const employeePfMonthly = Math.min(1800, Math.round(basicMonthly * (statRules.pfRate / 100)));
    const ptMonthly = components.find((c) => c.name.toLowerCase().includes('professional tax'))?.amount || statRules.ptAmount;
    const netTakeHomeMonthly = Math.max(0, monthlyGross - employeePfMonthly - ptMonthly);

    const designationString =
      dto.designation ||
      (typeof emp.designation === 'string'
        ? emp.designation
        : (emp.designation as any)?.name) ||
      'Employee';

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      candidateName: emp.name,
      jobTitle: designationString,
      annualCTC,
      monthlyCTC,
      annualGross,
      monthlyGross,
      netTakeHomeMonthly,
      netTakeHomeAnnual: Math.round(netTakeHomeMonthly * 12),
      breakdown: [
        { name: 'Basic Salary', category: 'EARNING', monthly: basicMonthly, annual: Math.round(basicMonthly * 12) },
        { name: 'House Rent Allowance (HRA)', category: 'EARNING', monthly: hraMonthly, annual: Math.round(hraMonthly * 12) },
        { name: 'Special Allowance', category: 'EARNING', monthly: specialAllowanceMonthly, annual: Math.round(specialAllowanceMonthly * 12) },
        { name: 'Employer Provident Fund (EPF)', category: 'BENEFIT', monthly: employerPfMonthly, annual: Math.round(employerPfMonthly * 12) },
        { name: 'Employee Provident Fund (EPF)', category: 'DEDUCTION', monthly: employeePfMonthly, annual: Math.round(employeePfMonthly * 12) },
        { name: 'Professional Tax (PT)', category: 'DEDUCTION', monthly: ptMonthly, annual: Math.round(ptMonthly * 12) },
      ],
      jobPosting: null,
    };
  }
}
