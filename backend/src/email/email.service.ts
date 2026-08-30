import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationResolverService } from '../modules/integrations/services/integration-resolver.service';
import * as nodemailer from 'nodemailer';
import { EMAIL_CONSTANTS } from './email.constants';
import { SendEmailOptions, EmailAttachment } from './email.interface';
import { maskLogCredentials } from './email.utils';
import { getEmployeeWelcomeTemplate } from './email.templates/welcome-employee.template';
import { getAdminWelcomeTemplate } from './email.templates/welcome-admin.template';
import { getPasswordResetTemplate } from './email.templates/password-reset.template';
import {
  getOtpTemplate,
  getEmailChangeVerificationTemplate,
  getVerificationTemplate,
  getPayrollTemplate,
  getLeaveApprovalTemplate,
  getLeaveRejectionTemplate,
  getInterviewTemplate,
  getInvoiceTemplate,
} from './email.templates/generic-system.template';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly integrationResolver: IntegrationResolverService,
  ) {}

  /**
   * Fail-fast verification check at application startup.
   */
  async onModuleInit() {
    try {
      const creds = await this.integrationResolver.resolveSmtp(null);
      if (!creds.host || !creds.from) {
        const errorMsg =
          '❌ SMTP Email Configuration is incomplete! Required fields (host, from) missing.';
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }
      this.logger.log(
        `Initializing SMTP Transporter Resolver: Host=${creds.host}:${creds.port}, Secure=${creds.secure}, User=${creds.user || 'none'} [Source: ${creds.source}]`,
      );
    } catch (err: any) {
      this.logger.error(
        `SMTP startup initialization check failed: ${err.message}`,
      );
      throw err;
    }
  }

  /**
   * Core sendEmail utility with dynamic credential resolution, retry mechanics, and secret protection
   */
  async sendEmail(
    options: SendEmailOptions & { companyId?: string },
  ): Promise<boolean> {
    const targetCompanyId = options.companyId ?? null;
    const creds = await this.integrationResolver.resolveSmtp(targetCompanyId);

    if (!creds.host || !creds.from) {
      this.logger.error(
        '❌ SMTP configuration incomplete. Unable to send email.',
      );
      return false;
    }

    const fromEmail = creds.from;
    const fromName = creds.name || 'HR Nexa Support';
    const emailPass = creds.password || '';

    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.secure,
      auth:
        creds.user && creds.password
          ? {
              user: creds.user,
              pass: creds.password,
            }
          : undefined,
      connectionTimeout: EMAIL_CONSTANTS.CONNECTION_TIMEOUT_MS,
    });

    let attempt = 0;
    while (attempt < EMAIL_CONSTANTS.MAX_RETRY_ATTEMPTS) {
      attempt++;
      try {
        const info = await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: options.toName
            ? `"${options.toName}" <${options.to}>`
            : options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || '',
          attachments: options.attachments,
          messageId: options.messageId,
        });

        this.logger.log(
          `✅ Email successfully sent to ${options.to} (MessageID: ${info.messageId}) [Source: ${creds.source}]`,
        );
        return true;
      } catch (error: any) {
        const maskedMsg = maskLogCredentials(error.message, emailPass);
        this.logger.warn(
          `SMTP attempt ${attempt}/${EMAIL_CONSTANTS.MAX_RETRY_ATTEMPTS} to ${options.to} failed: ${maskedMsg}`,
        );
        if (attempt >= EMAIL_CONSTANTS.MAX_RETRY_ATTEMPTS) {
          this.logger.error(
            `❌ SMTP failed permanently to send email to ${options.to} after ${EMAIL_CONSTANTS.MAX_RETRY_ATTEMPTS} attempts`,
          );
          return false;
        }
        await new Promise((res) =>
          setTimeout(res, EMAIL_CONSTANTS.RETRY_DELAY_MS),
        );
      }
    }
    return false;
  }

  /**
   * Sends HR Admin or Employee welcome email
   */
  async sendWelcomeEmail(
    toEmail: string,
    toName: string,
    companyName: string,
    tempPassword: string,
    isAdmin = false,
    companyId?: string,
  ): Promise<boolean> {
    const frontendUrl =
      this.configService.get<string>('TENANT_APP_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:5173';

    const html = isAdmin
      ? getAdminWelcomeTemplate(
          toEmail,
          toName,
          companyName,
          tempPassword,
          frontendUrl,
        )
      : getEmployeeWelcomeTemplate(
          toName,
          companyName,
          tempPassword,
          frontendUrl,
        );

    const subject = isAdmin
      ? `Welcome to HR Nexa - HR Admin Credentials for ${companyName}`
      : `Welcome to HR Nexa - Your Employee Credentials for ${companyName}`;

    return this.sendEmail({
      to: toEmail,
      toName,
      subject,
      html,
      companyId,
    });
  }

  /**
   * Password Reset Email
   */
  async sendPasswordResetEmail(
    toEmail: string,
    toName: string,
    resetToken: string,
    companyId?: string,
  ): Promise<boolean> {
    const frontendUrl =
      this.configService.get<string>('TENANT_APP_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:5173';
    const resetLink = `${frontendUrl.replace(/\/+$/, '')}/reset-password?resetToken=${resetToken}`;

    const html = getPasswordResetTemplate(toName, resetLink);

    return this.sendEmail({
      to: toEmail,
      toName,
      subject: 'Reset Your Password - HR Nexa',
      html,
      companyId,
    });
  }

  /**
   * Verification Email
   */
  async sendVerificationEmail(
    toEmail: string,
    token: string,
    companyId?: string,
  ): Promise<boolean> {
    const frontendUrl =
      this.configService.get<string>('TENANT_APP_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:5173';
    const link = `${frontendUrl.replace(/\/+$/, '')}/verify-email?token=${token}`;
    const html = getVerificationTemplate(link);

    return this.sendEmail({
      to: toEmail,
      subject: 'Verify Your Email Address - HR Nexa',
      html,
      companyId,
    });
  }

  /**
   * OTP Verification Email
   */
  async sendOtpEmail(toEmail: string, otp: string, companyId?: string): Promise<boolean> {
    const html = getOtpTemplate(otp);

    return this.sendEmail({
      to: toEmail,
      subject: 'Your One-Time Password (OTP) - HR Nexa',
      html,
      companyId,
    });
  }

  /**
   * SuperAdmin Email Change Verification Email
   */
  async sendEmailChangeVerificationEmail(
    toEmail: string,
    otp: string,
    expiresMinutes = 15,
    companyId?: string,
  ): Promise<boolean> {
    const html = getEmailChangeVerificationTemplate(otp, expiresMinutes);

    return this.sendEmail({
      to: toEmail,
      subject: 'SuperAdmin Email Change Verification Code - HR Nexa',
      html,
      companyId,
    });
  }

  /**
   * Payroll / Salary Slip Email
   */
  async sendPayrollEmail(
    toEmail: string,
    toName: string,
    month: string,
    attachment: EmailAttachment,
    companyId?: string,
  ): Promise<boolean> {
    const html = getPayrollTemplate(toName, month);

    return this.sendEmail({
      to: toEmail,
      toName,
      subject: `Salary Payslip Issued for ${month} - HR Nexa`,
      html,
      attachments: [attachment],
      companyId,
    });
  }

  /**
   * Leave Approval Email
   */
  async sendLeaveApprovalEmail(
    toEmail: string,
    toName: string,
    leaveDetails: string,
    companyId?: string,
  ): Promise<boolean> {
    const html = getLeaveApprovalTemplate(toName, leaveDetails);

    return this.sendEmail({
      to: toEmail,
      toName,
      subject: 'Leave Request Approved - HR Nexa',
      html,
      companyId,
    });
  }

  /**
   * Leave Rejection Email
   */
  async sendLeaveRejectedEmail(
    toEmail: string,
    toName: string,
    leaveDetails: string,
    reason: string,
    companyId?: string,
  ): Promise<boolean> {
    const html = getLeaveRejectionTemplate(toName, leaveDetails, reason);

    return this.sendEmail({
      to: toEmail,
      toName,
      subject: 'Leave Request Status Update - HR Nexa',
      html,
      companyId,
    });
  }

  /**
   * Interview Invitation Email
   */
  async sendInterviewInvitation(
    toEmail: string,
    toName: string,
    roleName: string,
    details: string,
    companyId?: string,
  ): Promise<boolean> {
    const html = getInterviewTemplate(toName, roleName, details);

    return this.sendEmail({
      to: toEmail,
      toName,
      subject: `Interview Invitation - ${roleName} Position`,
      html,
      companyId,
    });
  }

  /**
   * Subscription Invoice Email
   */
  async sendSubscriptionInvoice(
    toEmail: string,
    toName: string,
    company: string,
    amount: number,
    attachment: EmailAttachment,
    companyId?: string,
  ): Promise<boolean> {
    const html = getInvoiceTemplate(toName, company, amount);

    return this.sendEmail({
      to: toEmail,
      toName,
      subject: `Subscription Invoice Generated for ${company} - HR Nexa`,
      html,
      attachments: [attachment],
      companyId,
    });
  }
}
