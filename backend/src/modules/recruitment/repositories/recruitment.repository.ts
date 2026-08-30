import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

export interface PlatformRecruitmentOverview {
  totalOpenJobs: number;
  totalCandidates: number;
  interviewsScheduled: number;
  offersSent: number;
  hiredCount: number;
  offerAcceptanceRate: number;
  jobsPostedThisMonth: number;
  candidatesHiredThisMonth: number;
  companiesCurrentlyHiring: number;
  pipelineStageDistribution: Array<{ stage: string; count: number }>;
  topHiringDepartments: Array<{ department: string; openJobs: number }>;
  topHiringCompanies: Array<{ companyName: string; openJobs: number; candidates: number }>;
  hiringTrends: Array<{ month: string; jobsPosted: number; candidatesApplied: number }>;
}

@Injectable()
export class RecruitmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getJobPostings(
    scope: TenantScope,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<any>> {
    const where: any = {};
    if (!scope.isPlatformBypass) {
      where.subscriptionId = scope.subscriptionId;
    }

    const rawPage = Number(options?.page);
    const page = !isNaN(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const rawLimit = Number(options?.limit);
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;

    const [total, data] = await Promise.all([
      this.prisma.jobRequisition.count({ where }),
      this.prisma.jobRequisition.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: { departmentRel: true, designationRel: true },
      }),
    ]);
    return createPaginatedResponse(data, total, page, limit);
  }

  async createJobPosting(
    scope: TenantScope,
    data: {
      title: string;
      department: string;
      departmentId?: string;
      designationId?: string;
      hiringManager?: string;
      location?: string;
      type?: string;
      priority?: string;
      openings?: number;
      minSalary?: number;
      maxSalary?: number;
      currency?: string;
      budgetJustification?: string;
      jobDescription?: string;
      skillsRequired?: string[] | string;
      experienceRequired?: string;
      minExperience?: number;
      educationRequired?: string;
      expectedJoiningDate?: string;
      status?: string;
    },
  ) {
    const subId = scope.isPlatformBypass ? 'SYSTEM' : scope.subscriptionId;
    const openings = data.openings !== undefined ? Number(data.openings) : 1;
    const skills = Array.isArray(data.skillsRequired)
      ? data.skillsRequired.join(', ')
      : (data.skillsRequired || undefined);
    const exp =
      data.experienceRequired ||
      (data.minExperience !== undefined ? `${data.minExperience} Yrs` : undefined);

    return this.prisma.jobRequisition.create({
      data: {
        title: data.title,
        department: data.department,
        departmentId: data.departmentId || null,
        designationId: data.designationId || null,
        hiringManager: data.hiringManager || null,
        location: data.location || 'Remote',
        type: data.type || 'Full-Time',
        priority: data.priority || 'Medium',
        openings,
        minSalary: data.minSalary !== undefined ? Number(data.minSalary) : null,
        maxSalary: data.maxSalary !== undefined ? Number(data.maxSalary) : null,
        currency: data.currency || 'INR',
        budgetJustification: data.budgetJustification || null,
        jobDescription: data.jobDescription || null,
        skillsRequired: skills || null,
        experienceRequired: exp || null,
        educationRequired: data.educationRequired || null,
        expectedJoiningDate: data.expectedJoiningDate || null,
        status: data.status || 'Open',
        subscriptionId: subId,
      },
    });
  }

  async deleteJobPosting(id: string, scope: TenantScope) {
    if (!scope.isPlatformBypass) {
      const job = await this.prisma.jobRequisition.findFirst({
        where: { id, subscriptionId: scope.subscriptionId },
      });
      if (!job) {
        throw new NotFoundException(`Job posting not found or access denied`);
      }
    }
    return this.prisma.jobRequisition.delete({
      where: { id },
    });
  }

  async updateJobPosting(
    id: string,
    scope: TenantScope,
    data: {
      title?: string;
      department?: string;
      departmentId?: string;
      designationId?: string;
      hiringManager?: string;
      location?: string;
      type?: string;
      priority?: string;
      openings?: number;
      minSalary?: number;
      maxSalary?: number;
      currency?: string;
      budgetJustification?: string;
      jobDescription?: string;
      skillsRequired?: string[] | string;
      experienceRequired?: string;
      minExperience?: number;
      educationRequired?: string;
      expectedJoiningDate?: string;
      status?: string;
    },
  ) {
    if (!scope.isPlatformBypass) {
      const job = await this.prisma.jobRequisition.findFirst({
        where: { id, subscriptionId: scope.subscriptionId },
      });
      if (!job) {
        throw new NotFoundException(`Job posting not found or access denied`);
      }
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.designationId !== undefined) updateData.designationId = data.designationId;
    if (data.hiringManager !== undefined) updateData.hiringManager = data.hiringManager;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.openings !== undefined) updateData.openings = Number(data.openings);
    if (data.minSalary !== undefined) updateData.minSalary = Number(data.minSalary);
    if (data.maxSalary !== undefined) updateData.maxSalary = Number(data.maxSalary);
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.budgetJustification !== undefined) updateData.budgetJustification = data.budgetJustification;
    if (data.jobDescription !== undefined) updateData.jobDescription = data.jobDescription;
    if (data.educationRequired !== undefined) updateData.educationRequired = data.educationRequired;
    if (data.expectedJoiningDate !== undefined) updateData.expectedJoiningDate = data.expectedJoiningDate;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.skillsRequired !== undefined) {
      updateData.skillsRequired = Array.isArray(data.skillsRequired)
        ? data.skillsRequired.join(', ')
        : data.skillsRequired;
    }
    if (data.experienceRequired !== undefined) {
      updateData.experienceRequired = data.experienceRequired;
    } else if (data.minExperience !== undefined) {
      updateData.experienceRequired = `${data.minExperience} Yrs`;
    }

    return this.prisma.jobRequisition.update({
      where: { id },
      data: updateData,
    });
  }

  async getCandidates(
    scope: TenantScope,
    jobId?: string,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<any>> {
    const where: any = {};
    if (!scope.isPlatformBypass) {
      where.subscriptionId = scope.subscriptionId;
    }
    if (jobId) {
      where.jobId = jobId;
    }

    const rawPage = Number(options?.page);
    const page = !isNaN(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const rawLimit = Number(options?.limit);
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;

    const [total, data] = await Promise.all([
      this.prisma.candidate.count({ where }),
      this.prisma.candidate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: { evaluations: true, offer: true },
      }),
    ]);
    return createPaginatedResponse(data, total, page, limit);
  }

  async createCandidate(
    scope: TenantScope,
    data: {
      name: string;
      email: string;
      jobId?: string;
      jobTitle?: string;
      position?: string;
      stage?: string;
      experience?: string;
      experienceYears?: number;
      appliedDate?: string;
      resume?: string;
      score?: number;
      phone?: string;
    },
  ) {
    const subId = scope.isPlatformBypass ? 'SYSTEM' : scope.subscriptionId;

    let effectiveJobTitle = data.jobTitle || data.position || 'Applicant';
    const effectiveJobId = data.jobId || 'GENERIC';

    if (data.jobId && data.jobId !== 'GENERIC') {
      const job = await this.prisma.jobRequisition.findFirst({
        where: { id: data.jobId },
      });
      if (job) {
        if (!data.jobTitle && !data.position) {
          effectiveJobTitle = job.title;
        }
        await this.prisma.jobRequisition.update({
          where: { id: job.id },
          data: { applicantsCount: { increment: 1 } },
        }).catch(() => {});
      }
    }

    const appliedDate = data.appliedDate || new Date().toISOString().split('T')[0];
    const exp =
      data.experience ||
      (data.experienceYears !== undefined ? `${data.experienceYears} Yrs` : '3 Yrs');

    return this.prisma.candidate.create({
      data: {
        name: data.name,
        email: data.email,
        jobId: effectiveJobId,
        jobTitle: effectiveJobTitle,
        stage: data.stage || 'Applied',
        experience: exp,
        appliedDate,
        resume: data.resume || null,
        score: data.score !== undefined ? Number(data.score) : null,
        subscriptionId: subId,
      },
      include: { evaluations: true, offer: true },
    });
  }

  async getCandidateById(id: string, scope: TenantScope) {
    const where: any = { id };
    if (!scope.isPlatformBypass) {
      where.subscriptionId = scope.subscriptionId;
    }
    const candidate = await this.prisma.candidate.findFirst({
      where,
      include: { evaluations: true, offer: true },
    });
    if (!candidate) {
      throw new NotFoundException(`Candidate not found or access denied`);
    }
    return candidate;
  }

  async updateCandidateStage(id: string, scope: TenantScope, stage: string) {
    if (!scope.isPlatformBypass) {
      const candidate = await this.prisma.candidate.findFirst({
        where: { id, subscriptionId: scope.subscriptionId },
      });
      if (!candidate) {
        throw new NotFoundException(`Candidate not found or access denied`);
      }
    }

    return this.prisma.candidate.update({
      where: { id },
      data: { stage },
      include: { evaluations: true, offer: true },
    });
  }

  async createEvaluation(
    candidateId: string,
    scope: TenantScope,
    data: {
      score?: number;
      rating?: number;
      status?: string;
      overallRecommendation?: string;
      comments?: string;
      notes?: string;
      interviewer?: string;
      evaluatorId?: string;
      technicalSkills?: number;
      communication?: number;
      experienceMatch?: number;
      culturalFit?: number;
      problemSolving?: number;
      leadership?: number;
      calculatedScore?: number;
    },
  ) {
    if (!scope.isPlatformBypass) {
      const candidate = await this.prisma.candidate.findFirst({
        where: { id: candidateId, subscriptionId: scope.subscriptionId },
      });
      if (!candidate) {
        throw new NotFoundException(`Candidate not found or access denied`);
      }
    }

    const subId = scope.isPlatformBypass ? 'SYSTEM' : scope.subscriptionId;
    const baseScore = Number(data.score || data.rating || 4);
    const tech = Number(data.technicalSkills !== undefined ? data.technicalSkills : baseScore);
    const comm = Number(data.communication !== undefined ? data.communication : baseScore);
    const exp = Number(data.experienceMatch !== undefined ? data.experienceMatch : baseScore);
    const cult = Number(data.culturalFit !== undefined ? data.culturalFit : baseScore);
    const prob = Number(data.problemSolving !== undefined ? data.problemSolving : baseScore);
    const lead = Number(data.leadership !== undefined ? data.leadership : baseScore);
    const calc = Number(
      data.calculatedScore !== undefined
        ? data.calculatedScore
        : Math.round(((tech + comm + exp + cult + prob + lead) / 6) * 10) / 10,
    );
    const rec = data.overallRecommendation || data.status || 'Yes';
    const note = data.notes || data.comments || null;
    const evalId = data.evaluatorId || data.interviewer || 'Interviewer';

    const evaluation = await this.prisma.candidateEvaluation.upsert({
      where: { candidateId },
      update: {
        technicalSkills: tech,
        communication: comm,
        experienceMatch: exp,
        culturalFit: cult,
        problemSolving: prob,
        leadership: lead,
        calculatedScore: calc,
        overallRecommendation: rec,
        notes: note,
        evaluatorId: evalId,
        subscriptionId: subId,
      },
      create: {
        candidateId,
        technicalSkills: tech,
        communication: comm,
        experienceMatch: exp,
        culturalFit: cult,
        problemSolving: prob,
        leadership: lead,
        calculatedScore: calc,
        overallRecommendation: rec,
        notes: note,
        evaluatorId: evalId,
        subscriptionId: subId,
      },
    });

    await this.prisma.candidate
      .update({
        where: { id: candidateId },
        data: { score: calc },
      })
      .catch(() => {});

    return evaluation;
  }

  async getEvaluationByCandidateId(candidateId: string, scope: TenantScope) {
    if (!scope.isPlatformBypass) {
      const candidate = await this.prisma.candidate.findFirst({
        where: { id: candidateId, subscriptionId: scope.subscriptionId },
      });
      if (!candidate) {
        throw new NotFoundException(`Candidate not found or access denied`);
      }
    }

    return this.prisma.candidateEvaluation.findUnique({
      where: { candidateId },
    });
  }

  async getPlatformOverview(): Promise<PlatformRecruitmentOverview> {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const realSubWhere = {
      subscription: {
        companyRelation: {
          isDemo: false,
        },
      },
    };

    const [
      totalOpenJobs,
      totalCandidates,
      interviewsScheduled,
      offersSent,
      hiredCount,
      jobsPostedThisMonth,
      candidatesHiredThisMonth,
      stageDistributionRaw,
      topDepartmentsRaw,
      openJobsBySub,
      recentJobs,
      recentCandidates,
    ] = await Promise.all([
      this.prisma.jobRequisition.count({ where: { status: 'Open', ...realSubWhere } }),
      this.prisma.candidate.count({ where: realSubWhere }),
      this.prisma.candidate.count({
        where: { stage: { in: ['Interview', 'Scheduled'] }, ...realSubWhere },
      }),
      this.prisma.candidate.count({ where: { stage: 'Offer', ...realSubWhere } }),
      this.prisma.candidate.count({ where: { stage: 'Hired', ...realSubWhere } }),
      this.prisma.jobRequisition.count({
        where: { createdAt: { gte: startOfCurrentMonth }, ...realSubWhere },
      }),
      this.prisma.candidate.count({
        where: { stage: 'Hired', updatedAt: { gte: startOfCurrentMonth }, ...realSubWhere },
      }),
      this.prisma.candidate.groupBy({
        by: ['stage'],
        where: realSubWhere,
        _count: { _all: true },
      }),
      this.prisma.jobRequisition.groupBy({
        by: ['department'],
        where: { status: 'Open', ...realSubWhere },
        _count: { _all: true },
      }),
      this.prisma.jobRequisition.groupBy({
        by: ['subscriptionId'],
        where: { status: 'Open', ...realSubWhere },
        _count: { _all: true },
      }),
      this.prisma.jobRequisition.findMany({
        where: { createdAt: { gte: sixMonthsAgo }, ...realSubWhere },
        select: { createdAt: true },
      }),
      this.prisma.candidate.findMany({
        where: { createdAt: { gte: sixMonthsAgo }, ...realSubWhere },
        select: { createdAt: true },
      }),
    ]);

    const totalOffersDeliberated = offersSent + hiredCount;
    const offerAcceptanceRate =
      totalOffersDeliberated > 0
        ? Math.min(100, Math.round((hiredCount / totalOffersDeliberated) * 100))
        : 0;

    const validSubGroups = openJobsBySub.filter((g: any) => g.subscriptionId);
    const companiesCurrentlyHiring = validSubGroups.length;

    const subIds = validSubGroups.map((g: any) => g.subscriptionId);
    let topHiringCompanies: Array<{
      companyName: string;
      openJobs: number;
      candidates: number;
    }> = [];

    if (subIds.length > 0) {
      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          id: { in: subIds },
          companyRelation: {
            isDemo: false,
          },
        },
        select: {
          id: true,
          company: true,
          _count: { select: { candidates: true } },
        },
      });
      const subMap = new Map(subscriptions.map((s: any) => [s.id, s]));

      topHiringCompanies = validSubGroups
        .map((g: any) => {
          const sub: any = subMap.get(g.subscriptionId);
          return {
            companyName: sub?.company || 'Unknown Company',
            openJobs: g._count._all,
            candidates: sub?._count?.candidates || 0,
          };
        })
        .sort((a, b) => b.openJobs - a.openJobs)
        .slice(0, 5);
    }

    const defaultStages = [
      'Applied',
      'Screening',
      'Interview',
      'Offer',
      'Hired',
      'Rejected',
    ];
    const stageMap = new Map<string, number>();
    defaultStages.forEach((s) => stageMap.set(s, 0));

    stageDistributionRaw.forEach((g: any) => {
      if (g.stage) {
        stageMap.set(g.stage, (stageMap.get(g.stage) || 0) + (g._count._all || 0));
      }
    });

    const pipelineStageDistribution = Array.from(stageMap.entries()).map(
      ([stage, count]) => ({ stage, count }),
    );

    const topHiringDepartments = topDepartmentsRaw
      .map((d: any) => ({
        department: d.department || 'General',
        openJobs: d._count._all,
      }))
      .sort((a, b) => b.openJobs - a.openJobs)
      .slice(0, 5);

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const hiringTrends: Array<{
      month: string;
      jobsPosted: number;
      candidatesApplied: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = monthNames[d.getMonth()];
      const year = d.getFullYear();
      const monthIndex = d.getMonth();

      const jobsPosted = recentJobs.filter((j: any) => {
        const jd = new Date(j.createdAt);
        return jd.getFullYear() === year && jd.getMonth() === monthIndex;
      }).length;

      const candidatesApplied = recentCandidates.filter((c: any) => {
        const cd = new Date(c.createdAt);
        return cd.getFullYear() === year && cd.getMonth() === monthIndex;
      }).length;

      hiringTrends.push({
        month: mName,
        jobsPosted,
        candidatesApplied,
      });
    }

    return {
      totalOpenJobs,
      totalCandidates,
      interviewsScheduled,
      offersSent,
      hiredCount,
      offerAcceptanceRate,
      jobsPostedThisMonth,
      candidatesHiredThisMonth,
      companiesCurrentlyHiring,
      pipelineStageDistribution,
      topHiringDepartments,
      topHiringCompanies,
      hiringTrends,
    };
  }

  async getOfferByCandidateId(candidateId: string, scope: TenantScope) {
    const where: any = { candidateId };
    if (!scope.isPlatformBypass) {
      where.companyId = scope.companyId;
      if (scope.subscriptionId) {
        where.subscriptionId = scope.subscriptionId;
      }
    }

    return this.prisma.offer.findFirst({
      where,
      include: {
        candidate: true,
        document: true,
      },
    });
  }

  async getOfferById(id: string, scope: TenantScope) {
    const where: any = { id };
    if (!scope.isPlatformBypass) {
      where.companyId = scope.companyId;
      if (scope.subscriptionId) {
        where.subscriptionId = scope.subscriptionId;
      }
    }

    return this.prisma.offer.findFirst({
      where,
      include: {
        candidate: true,
        document: true,
      },
    });
  }

  async getOffers(
    scope: TenantScope,
    options?: { page?: number; limit?: number },
  ) {
    const where: any = {};
    if (!scope.isPlatformBypass) {
      where.companyId = scope.companyId;
      if (scope.subscriptionId) {
        where.subscriptionId = scope.subscriptionId;
      }
    }

    if (options?.page || options?.limit) {
      const page = options.page && options.page > 0 ? options.page : 1;
      const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
      const [total, data] = await Promise.all([
        this.prisma.offer.count({ where }),
        this.prisma.offer.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            candidate: true,
            document: true,
          },
        }),
      ]);
      return createPaginatedResponse(data, total, page, limit);
    }

    return this.prisma.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: true,
        document: true,
      },
    });
  }

  async upsertOffer(
    candidateId: string,
    scope: TenantScope,
    data: {
      jobPostingId?: string;
      annualCTC: number;
      monthlyCTC: number;
      annualGross: number;
      monthlyGross: number;
      designation: string;
      joiningDate: string;
      expiryDate?: string;
      status: string;
      compensationSnapshot: any;
      documentId?: string;
      generatedAt?: Date;
    },
  ) {
    const companyId = scope.companyId;
    const subscriptionId = scope.subscriptionId;

    const existing = await this.prisma.offer.findUnique({
      where: { candidateId },
    });

    if (existing) {
      if (!scope.isPlatformBypass && existing.companyId !== companyId) {
        throw new NotFoundException(`Offer not found or access denied`);
      }

      return this.prisma.offer.update({
        where: { candidateId },
        data: {
          jobPostingId: data.jobPostingId || existing.jobPostingId,
          annualCTC: data.annualCTC,
          monthlyCTC: data.monthlyCTC,
          annualGross: data.annualGross,
          monthlyGross: data.monthlyGross,
          designation: data.designation,
          joiningDate: data.joiningDate,
          expiryDate: data.expiryDate,
          status: data.status,
          compensationSnapshot: data.compensationSnapshot,
          documentId: data.documentId || existing.documentId,
          generatedAt: data.generatedAt || existing.generatedAt,
          companyId,
          subscriptionId,
        },
        include: {
          candidate: true,
          document: true,
        },
      });
    }

    return this.prisma.offer.create({
      data: {
        candidateId,
        jobPostingId: data.jobPostingId,
        companyId,
        subscriptionId,
        annualCTC: data.annualCTC,
        monthlyCTC: data.monthlyCTC,
        annualGross: data.annualGross,
        monthlyGross: data.monthlyGross,
        designation: data.designation,
        joiningDate: data.joiningDate,
        expiryDate: data.expiryDate,
        status: data.status,
        compensationSnapshot: data.compensationSnapshot,
        documentId: data.documentId,
        generatedAt: data.generatedAt,
      },
      include: {
        candidate: true,
        document: true,
      },
    });
  }
}
