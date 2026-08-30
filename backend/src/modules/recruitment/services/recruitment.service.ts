import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EMPLOYEE_EVENTS,
  EmployeeCreatedEvent,
} from '../../../common/events/employee.events';
import {
  RecruitmentRepository,
  PlatformRecruitmentOverview,
} from '../repositories/recruitment.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeesService } from '../../employees/services/employees.service';
import { SalaryComponentCalculatorService } from '../../payroll/services/salary-component-calculator.service';
import { StatutoryRulesService } from '../../payroll/services/statutory-rules.service';
import { StorageService } from '../../../common/storage/storage.service';
import { DocumentsRepository } from '../../documents/repositories/documents.repository';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';
import { getBusinessDateString } from '../../../common/utils/date.util';
import { PreviewOfferDto, GenerateOfferDto } from '../dto/offer.dto';
import { OfferLetterTemplateService } from '../../../common/documents/offer-letter-template.service';
import { SeatLimitService } from '../../subscriptions/services/seat-limit.service';
import { PasswordService } from '../../auth/services/password.service';
import { EmployeeUserLinkService } from '../../employees/services/employee-user-link.service';

@Injectable()
export class RecruitmentService {
  private readonly logger = new Logger(RecruitmentService.name);

  constructor(
    private readonly recruitmentRepository: RecruitmentRepository,
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
    private readonly salaryCalculator: SalaryComponentCalculatorService,
    private readonly statutoryRulesService: StatutoryRulesService,
    private readonly storageService: StorageService,
    private readonly documentsRepository: DocumentsRepository,
    private readonly offerLetterTemplateService: OfferLetterTemplateService,
    @Optional() private readonly seatLimitService?: SeatLimitService,
    @Optional() private readonly passwordService?: PasswordService,
    @Optional() private readonly employeeUserLinkService?: EmployeeUserLinkService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}


  async getPlatformOverview(): Promise<PlatformRecruitmentOverview> {
    return this.recruitmentRepository.getPlatformOverview();
  }

  async getJobPostings(scope: TenantScope, options?: { page?: number; limit?: number }) {
    return this.recruitmentRepository.getJobPostings(scope, options);
  }

  private async validateDepartmentDesignation(
    scope: TenantScope,
    departmentId?: string | null,
    designationId?: string | null,
  ) {
    let dept: any = null;
    let desig: any = null;

    if (departmentId) {
      const deptWhere: any = { id: departmentId };
      if (!scope.isPlatformBypass && scope.subscriptionId) {
        deptWhere.subscriptionId = scope.subscriptionId;
      }
      dept = await this.prisma.department.findFirst({ where: deptWhere });
      if (!dept) {
        throw new NotFoundException('Selected department not found or access denied.');
      }
    }

    if (designationId) {
      const desigWhere: any = { id: designationId };
      if (!scope.isPlatformBypass && scope.subscriptionId) {
        desigWhere.subscriptionId = scope.subscriptionId;
      }
      desig = await this.prisma.designation.findFirst({ where: desigWhere });
      if (!desig) {
        throw new NotFoundException('Selected designation not found or access denied.');
      }
    }

    if (departmentId && desig) {
      if (desig.departmentId !== null && desig.departmentId !== departmentId) {
        throw new BadRequestException(
          'Selected designation does not belong to the selected department.',
        );
      }
    }

    return { dept, desig };
  }

  async createJobPosting(scope: TenantScope, data: any) {
    await this.validateDepartmentDesignation(scope, data.departmentId, data.designationId);
    return this.recruitmentRepository.createJobPosting(scope, data);
  }

  async deleteJobPosting(id: string, scope: TenantScope) {
    return this.recruitmentRepository.deleteJobPosting(id, scope);
  }

  async updateJobPosting(id: string, scope: TenantScope, data: any) {
    const existingJob = await this.prisma.jobRequisition.findFirst({
      where: { id },
    });
    if (!existingJob) {
      throw new NotFoundException('Job posting not found or access denied');
    }

    const targetDeptId =
      data.departmentId !== undefined ? data.departmentId : existingJob.departmentId;
    let targetDesigId =
      data.designationId !== undefined ? data.designationId : existingJob.designationId;

    let desigCleared = false;
    if (
      data.departmentId !== undefined &&
      data.departmentId !== existingJob.departmentId &&
      data.designationId === undefined &&
      existingJob.designationId
    ) {
      const existingDesigWhere: any = { id: existingJob.designationId };
      if (!scope.isPlatformBypass && scope.subscriptionId) {
        existingDesigWhere.subscriptionId = scope.subscriptionId;
      }
      const existingDesig = await this.prisma.designation.findFirst({
        where: existingDesigWhere,
      });

      if (
        existingDesig &&
        existingDesig.departmentId !== null &&
        existingDesig.departmentId !== data.departmentId
      ) {
        targetDesigId = null;
        desigCleared = true;
      }
    }

    await this.validateDepartmentDesignation(scope, targetDeptId, targetDesigId);

    const payload = desigCleared ? { ...data, designationId: null } : data;
    return this.recruitmentRepository.updateJobPosting(id, scope, payload);
  }

  async getCandidates(scope: TenantScope, jobId?: string, options?: { page?: number; limit?: number }) {
    return this.recruitmentRepository.getCandidates(scope, jobId, options);
  }

  async createCandidate(scope: TenantScope, data: any) {
    return this.recruitmentRepository.createCandidate(scope, data);
  }

  async createEvaluation(candidateId: string, scope: TenantScope, data: any) {
    return this.recruitmentRepository.createEvaluation(candidateId, scope, data);
  }

  async getEvaluation(candidateId: string, scope: TenantScope) {
    return this.recruitmentRepository.getEvaluationByCandidateId(candidateId, scope);
  }

  /**
   * Authoritative calculation of salary compensation using HR NEXA's payroll engine.
   */
  async previewOfferCompensation(
    candidateId: string,
    scope: TenantScope,
    dto: PreviewOfferDto,
  ) {
    let candidate: any = null;
    let jobPosting: any = null;

    if (candidateId) {
      candidate = await this.recruitmentRepository.getCandidateById(candidateId, scope);
      if (candidate?.jobId && candidate.jobId !== 'GENERIC') {
        jobPosting = await this.prisma.jobRequisition.findFirst({
          where: { id: candidate.jobId },
        });
      }
    }

    const annualCTC = Number(dto.annualCTC);
    if (isNaN(annualCTC) || annualCTC <= 0) {
      throw new BadRequestException('Annual CTC must be a positive valid number.');
    }

    // Validate against Job Requisition salary bounds if configured
    if (jobPosting) {
      const minSalary = jobPosting.minSalary;
      const maxSalary = jobPosting.maxSalary;

      if (minSalary && annualCTC < minSalary) {
        throw new BadRequestException(
          `Proposed Annual CTC (₹${annualCTC.toLocaleString('en-IN')}) is below the minimum requisition budget (₹${minSalary.toLocaleString('en-IN')}).`,
        );
      }
      if (maxSalary && annualCTC > maxSalary) {
        throw new BadRequestException(
          `Proposed Annual CTC (₹${annualCTC.toLocaleString('en-IN')}) exceeds the maximum requisition budget (₹${maxSalary.toLocaleString('en-IN')}).`,
        );
      }
    }

    const statRules = await this.statutoryRulesService.getStatutoryRules();
    const salaryComponents = await this.prisma.salaryComponent.findMany({
      where: {
        companyId: scope.companyId,
        deletedAt: null,
      },
    });

    // Authoritative CTC Reconciliation
    const monthlyCTC = Math.round((annualCTC / 12) * 100) / 100;
    
    // Statutory EPF calculation: 12% of Basic capped at ₹1,800/mo
    // Basic is typically 50% of Gross
    // We compute the Gross base such that: Gross + Employer PF = CTC
    const estimatedBasicFromCTC = (monthlyCTC * (statRules.basicPercentage / 100));
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

    const breakdown = [
      {
        name: 'Basic Salary',
        category: 'EARNING',
        monthly: basicMonthly,
        annual: Math.round(basicMonthly * 12),
      },
      {
        name: 'House Rent Allowance (HRA)',
        category: 'EARNING',
        monthly: hraMonthly,
        annual: Math.round(hraMonthly * 12),
      },
      {
        name: 'Special Allowance',
        category: 'EARNING',
        monthly: specialAllowanceMonthly,
        annual: Math.round(specialAllowanceMonthly * 12),
      },
      {
        name: 'Employer Provident Fund (EPF)',
        category: 'BENEFIT',
        monthly: employerPfMonthly,
        annual: Math.round(employerPfMonthly * 12),
      },
      {
        name: 'Employee Provident Fund (EPF)',
        category: 'DEDUCTION',
        monthly: employeePfMonthly,
        annual: Math.round(employeePfMonthly * 12),
      },
      {
        name: 'Professional Tax (PT)',
        category: 'DEDUCTION',
        monthly: ptMonthly,
        annual: Math.round(ptMonthly * 12),
      },
    ];

    return {
      candidateId: candidate?.id || 'candidate_preview',
      candidateName: candidate?.name || 'Prospective Candidate',
      jobTitle: candidate?.jobTitle || jobPosting?.title || 'Role',
      annualCTC,
      monthlyCTC,
      annualGross,
      monthlyGross,
      netTakeHomeMonthly,
      netTakeHomeAnnual: Math.round(netTakeHomeMonthly * 12),
      breakdown,
      jobPosting: jobPosting
        ? {
            id: jobPosting.id,
            jobTitle: jobPosting.title,
            minSalary: jobPosting.minSalary,
            maxSalary: jobPosting.maxSalary,
          }
        : null,
    };
  }

  /**
   * Generates a professional Offer Letter document and creates the immutable Offer snapshot.
   * NOTE: Strictly does NOT email the offer letter.
   */
  async generateOfferLetter(
    candidateId: string,
    scope: TenantScope,
    dto: GenerateOfferDto,
  ) {
    const candidate = await this.recruitmentRepository.getCandidateById(candidateId, scope);
    if (!candidate) {
      throw new NotFoundException(`Candidate not found or access denied`);
    }

    const existingOffer = await this.recruitmentRepository.getOfferByCandidateId(candidateId, scope);
    if (existingOffer && existingOffer.status === 'ACCEPTED') {
      throw new BadRequestException(
        `Cannot regenerate offer letter for ${candidate.name} because the current offer is already ACCEPTED.`,
      );
    }

    const preview = await this.previewOfferCompensation(candidateId, scope, {
      annualCTC: dto.annualCTC,
      designation: dto.designation,
      joiningDate: dto.joiningDate,
      expiryDate: dto.expiryDate,
    });

    const companyRecord = await this.prisma.company.findFirst({
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
    const joiningDate = dto.joiningDate || 'Immediate';
    const designation = dto.designation || candidate.jobTitle || 'Software Professional';
    const offerRef = `OFF-${candidate.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const html = this.offerLetterTemplateService.compileOfferLetterHtml({
      recipientName: candidate.name,
      designation,
      companyName,
      companyAddress,
      issueDate,
      joiningDate,
      offerRef,
      expiryDate: dto.expiryDate,
      terms: dto.terms,
      preview,
    });

    const fileName = `offer_letter_${candidate.name.replace(/\s+/g, '_').toLowerCase()}.html`;
    const buffer = Buffer.from(html, 'utf-8');

    // Save Offer Letter to Document Storage
    const uploadResult = await this.storageService.saveFile(
      {
        originalname: fileName,
        mimetype: 'text/html',
        buffer,
        size: buffer.length,
      },
      'offer-letters',
      scope.companyId,
    );

    // Create Document record linked to Company
    const document = await this.documentsRepository.create({
      title: `Offer Letter - ${candidate.name}`,
      docType: 'Offer',
      category: 'HR_LETTER',
      fileName,
      filePath: uploadResult.path,
      size: `${Math.max(1, Math.round(buffer.length / 1024))} KB`,
      companyId: scope.companyId,
      status: 'VALID',
      verificationStatus: 'VERIFIED',
    });

    // Create or update Offer record with immutable snapshot
    const offer = await this.recruitmentRepository.upsertOffer(
      candidate.id,
      scope,
      {
        jobPostingId: candidate.jobId,
        annualCTC: preview.annualCTC,
        monthlyCTC: preview.monthlyCTC,
        annualGross: preview.annualGross,
        monthlyGross: preview.monthlyGross,
        designation,
        joiningDate,
        expiryDate: dto.expiryDate,
        status: 'GENERATED',
        compensationSnapshot: preview,
        documentId: document.id,
        generatedAt: new Date(),
      },
    );

    // Update candidate stage to 'Offer'
    await this.recruitmentRepository.updateCandidateStage(candidateId, scope, 'Offer');

    // F05 Remediation: Clean up previous superseded Document record & storage file on regeneration
    const previousDocId = existingOffer?.documentId;
    if (previousDocId && previousDocId !== document.id) {
      try {
        const oldDoc = await this.documentsRepository.findById(previousDocId, scope);
        if (oldDoc) {
          if (oldDoc.filePath) {
            await this.storageService.deleteFile(oldDoc.filePath).catch(() => {});
          }
          await this.documentsRepository.delete(oldDoc.id, scope).catch(() => {});
          this.logger.log(
            `Cleaned up superseded offer document ${oldDoc.id} for candidate ${candidate.name}`,
          );
        }
      } catch (cleanupErr: any) {
        this.logger.warn(
          `Non-critical cleanup failure for superseded offer document ${previousDocId}: ${cleanupErr.message}`,
        );
      }
    }

    this.logger.log(
      `Offer letter generated and stored for candidate ${candidate.name} (Offer ID: ${offer.id}, Document ID: ${document.id}) without emailing.`,
    );

    return {
      offer,
      document,
      preview,
    };
  }

  async getOfferByCandidateId(candidateId: string, scope: TenantScope) {
    return this.recruitmentRepository.getOfferByCandidateId(candidateId, scope);
  }

  async getOffers(scope: TenantScope, options?: { page?: number; limit?: number }) {
    return this.recruitmentRepository.getOffers(scope, options);
  }

  async updateCandidateStage(id: string, scope: TenantScope, stage: string) {
    const existing = await this.recruitmentRepository.getCandidateById(id, scope);

    // P2-1 Remediation: Candidate stage 'Hired' onboarding idempotency guard
    if (existing.stage === 'Hired' && stage === 'Hired') {
      return existing;
    }

    if (stage !== 'Hired') {
      return this.recruitmentRepository.updateCandidateStage(
        id,
        scope,
        stage,
      );
    }

    let isNewEmployeeCreated = false;

    // Atomic Candidate -> Employee onboarding transaction
    const updatedCandidate = await this.prisma.$transaction(async (tx) => {
      // Re-read candidate under transaction lock
      const candidate = await tx.candidate.findUnique({
        where: { id },
      });

      if (!candidate) {
        throw new NotFoundException(`Candidate not found or access denied`);
      }

      if (candidate.stage === 'Hired') {
        return candidate;
      }

      // 1. Mutate candidate stage to Hired inside transaction
      const hiredCandidate = await tx.candidate.update({
        where: { id },
        data: { stage: 'Hired' },
      });

      const candidateName = hiredCandidate.name || 'Hired Candidate';
      const email =
        hiredCandidate.email ||
        `${candidateName.toLowerCase().replace(/[^a-z0-9]/g, '')}@acmecorp.com`;

      const existingEmp = await tx.employee.findFirst({
        where: { OR: [{ email }, { name: candidateName }] },
      });

      if (!existingEmp) {
        isNewEmployeeCreated = true;
        const customId = await this.employeesService.generateNextEmployeeId(
          scope.companyId,
          tx,
        );

        // Check if candidate has an Offer with finalized compensation
        const offerWhere: any = { candidateId: id };
        if (!scope.isPlatformBypass) {
          offerWhere.companyId = scope.companyId;
          if (scope.subscriptionId) {
            offerWhere.subscriptionId = scope.subscriptionId;
          }
        }
        const offer = await tx.offer.findFirst({ where: offerWhere });
        // P8-01 Remediation: Convert Annual CTC to Monthly Base Salary (in HRMS / Payroll semantics)
        const annualCTC = offer?.annualCTC || 800000;
        const monthlySalary = Math.round(annualCTC / 12);
        const finalDesignation =
          offer?.designation || hiredCandidate.jobTitle || 'Software Engineer';
        const joinedDate = offer?.joiningDate || getBusinessDateString();

        // Mark offer as ACCEPTED if it was generated
        if (offer) {
          await tx.offer.update({
            where: { id: offer.id },
            data: { status: 'ACCEPTED', acceptedAt: new Date() },
          });
        }

        // Resolve Department inside transaction
        let dept = await tx.department.findFirst({
          where: { name: 'Engineering', companyId: scope.companyId },
        });
        if (!dept) {
          dept = await tx.department.create({
            data: {
              name: 'Engineering',
              companyId: scope.companyId,
              subscriptionId: scope.subscriptionId,
            },
          });
        }

        // Resolve Designation inside transaction
        let desig = await tx.designation.findFirst({
          where: { name: finalDesignation, companyId: scope.companyId },
        });
        if (!desig) {
          desig = await tx.designation.create({
            data: {
              name: finalDesignation,
              band: 'IC',
              companyId: scope.companyId,
              subscriptionId: scope.subscriptionId,
            },
          });
        }

        // Create User account inside transaction if missing
        let user = await tx.user.findUnique({ where: { email } });
        if (!user) {
          const randomDigits = Math.floor(1000 + Math.random() * 9000);
          const tempPassword = `EmpNexa#${randomDigits}`;
          const hashedPassword = this.passwordService
            ? await this.passwordService.hash(tempPassword)
            : `$2b$10$ep/Z1p/Z1p/Z1p/Z1p/Z1uO4k2f7e7r4`;
          const initials = candidateName
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

          user = await tx.user.create({
            data: {
              email,
              password: hashedPassword,
              name: candidateName,
              role: 'Employee',
              initials,
              companyId: scope.companyId,
              subscriptionId: scope.subscriptionId,
            },
          });
        }

        // Create Employee record inside transaction
        await tx.employee.create({
          data: {
            id: customId,
            name: candidateName,
            email,
            companyId: scope.companyId,
            subscriptionId: scope.subscriptionId,
            departmentId: dept.id,
            designationId: desig.id,
            status: 'Active',
            joined: joinedDate,
            salary: monthlySalary,
            avatar: candidateName
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .substring(0, 2),
            phone: '+91-9876543210',
            location: 'Headquarters',
            userId: user.id,
          },
        });

        this.logger.log(
          `Auto-created active Employee ${customId} and User record for hired candidate ${candidateName} with monthly salary ₹${monthlySalary.toLocaleString('en-IN')} (Annual CTC: ₹${annualCTC.toLocaleString('en-IN')})`,
        );
      }

      return hiredCandidate;
    });

    // Synchronize company subscription counters if a new employee was onboarded
    if (isNewEmployeeCreated && this.seatLimitService) {
      const subOrCompanyId = scope.subscriptionId || scope.companyId;
      if (subOrCompanyId) {
        await this.seatLimitService.syncEmployeeCounts(subOrCompanyId).catch((err) => {
          this.logger.warn(
            `[RecruitmentService] Post-hire employee count synchronization failed for ${subOrCompanyId}: ${err.message}`,
          );
        });
      }
    }

    return updatedCandidate;
  }
}

