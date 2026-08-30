import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../email/email.service';
import { CreateTrialRequestDto } from '../dto/create-trial-request.dto';
import { UpdateTrialRequestStatusDto } from '../dto/update-trial-request-status.dto';

@Injectable()
export class TrialRequestsService {
  private readonly logger = new Logger(TrialRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Captures an inbound free trial lead, persists it, and dispatches email notifications.
   */
  async create(
    dto: CreateTrialRequestDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const modulesJson = JSON.stringify(dto.selectedModules || []);

    const trialRequest = await (this.prisma as any).trialRequest.create({
      data: {
        fullName: dto.fullName.trim(),
        workEmail: dto.workEmail.trim().toLowerCase(),
        phoneNumber: dto.phoneNumber.trim(),
        companyName: dto.companyName.trim(),
        teamSize: dto.teamSize.trim(),
        selectedModules: modulesJson,
        message: dto.message ? dto.message.trim() : null,
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `New 14-day free trial request captured: ID=${trialRequest.id}, Company=${trialRequest.companyName}, Email=${trialRequest.workEmail}`,
    );

    // Asynchronously dispatch email alerts (non-blocking for fast UI response)
    this.sendNotificationEmails(trialRequest, dto.selectedModules || []).catch(
      (err) => {
        this.logger.error(
          `Failed to dispatch trial request notification emails for ${trialRequest.id}: ${err.message}`,
          err.stack,
        );
      },
    );

    return {
      success: true,
      id: trialRequest.id,
      message: 'Trial request received successfully',
      companyName: trialRequest.companyName,
      workEmail: trialRequest.workEmail,
    };
  }

  /**
   * Retrieves paginated trial requests for SuperAdmin console.
   */
  async findAll(query?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query?.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (query?.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { workEmail: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      (this.prisma as any).trialRequest.count({ where }),
      (this.prisma as any).trialRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const formattedItems = items.map((item: any) => {
      let modules: string[] = [];
      try {
        modules = JSON.parse(item.selectedModules || '[]');
      } catch {
        modules = [];
      }
      return {
        ...item,
        selectedModulesList: modules,
      };
    });

    return {
      data: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Updates lead status and SuperAdmin notes.
   */
  async updateStatus(id: string, dto: UpdateTrialRequestStatusDto) {
    const existing = await (this.prisma as any).trialRequest.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Trial request with ID ${id} not found.`);
    }

    const updated = await (this.prisma as any).trialRequest.update({
      where: { id },
      data: {
        status: dto.status,
        adminNotes: dto.adminNotes !== undefined ? dto.adminNotes : existing.adminNotes,
      },
    });

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Dispatches email notifications to Admin and Requester.
   */
  private async sendNotificationEmails(
    request: any,
    selectedModules: string[],
  ) {
    const adminEmail =
      this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL') ||
      this.configService.get<string>('EMAIL_FROM') ||
      'nishadhruve20@gmail.com';

    const modulesText =
      selectedModules.length > 0 ? selectedModules.join(', ') : 'All Core Modules';

    // 1. Email to Admin / Sales
    const adminHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
        <div style="background: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #e2e8f0;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">🚀 New 14-Day Free Trial Request</h2>
          <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">A prospective customer has requested a 14-day free trial on HR NEXA.</p>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 35%;">Lead Name:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${request.fullName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Work Email:</td>
              <td style="padding: 8px 0; color: #2563eb; font-weight: bold;">${request.workEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Company:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${request.companyName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Phone Number:</td>
              <td style="padding: 8px 0; color: #0f172a;">${request.phoneNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Team Size:</td>
              <td style="padding: 8px 0; color: #0f172a;">${request.teamSize}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Selected Modules:</td>
              <td style="padding: 8px 0; color: #0f172a;">${modulesText}</td>
            </tr>
            ${
              request.message
                ? `<tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; vertical-align: top;">Notes/Message:</td>
                    <td style="padding: 8px 0; color: #334155; font-style: italic;">"${request.message}"</td>
                  </tr>`
                : ''
            }
          </table>

          <div style="padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">HR NEXA Inbound Lead Generation Engine</p>
          </div>
        </div>
      </div>
    `;

    await this.emailService.sendEmail({
      to: adminEmail,
      subject: `[New Trial Lead] ${request.companyName} (${request.fullName})`,
      html: adminHtml,
    });

    // 2. Automated Welcome/Confirmation Email to Requester
    const userHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
        <div style="background: #ffffff; padding: 28px; border-radius: 10px; border: 1px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 22px;">Welcome to HR NEXA!</h2>
            <p style="color: #2563eb; font-weight: 600; font-size: 13px; margin: 4px 0 0 0;">14-Day Full Access Free Trial</p>
          </div>

          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Hi <strong>${request.fullName}</strong>,
          </p>

          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Thank you for requesting a 14-day free trial of HR NEXA for <strong>${request.companyName}</strong>.
          </p>

          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h4 style="color: #1e40af; margin: 0 0 8px 0; font-size: 14px;">What happens next?</h4>
            <ul style="color: #1e3a8a; font-size: 13px; margin: 0; padding-left: 18px; line-height: 1.6;">
              <li>Our solutions engineering team is provisioning your dedicated cloud tenant instance.</li>
              <li>Your workspace URL and temporary administrator credentials will be delivered to this email shortly.</li>
              <li>You will have 14 days of unrestricted access to payroll, automated attendance, and compliance modules.</li>
            </ul>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            Need an immediate customized demo or have enterprise migration questions? Simply reply directly to this email and our team will assist you immediately.
          </p>

          <div style="padding-top: 16px; border-top: 1px solid #e2e8f0; margin-top: 24px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">© HR NEXA — Automated Workforce Operating System</p>
          </div>
        </div>
      </div>
    `;

    await this.emailService.sendEmail({
      to: request.workEmail,
      subject: `Your HR NEXA 14-Day Free Trial Request (${request.companyName})`,
      html: userHtml,
    });
  }
}
