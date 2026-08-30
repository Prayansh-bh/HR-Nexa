function getBaseLayout(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }
        .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee; }
        .logo { font-size: 24px; font-weight: bold; color: #7c3aed; }
        .title { font-size: 20px; font-weight: 600; margin-top: 24px; margin-bottom: 12px; color: #111; }
        .text { font-size: 14px; line-height: 1.6; color: #555; margin-bottom: 20px; }
        .footer { font-size: 12px; color: #999; text-align: center; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; }
        .highlight-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo">HR Nexa</div>
        </div>
        <div class="title">${title}</div>
        <div class="text">${content}</div>
        <div class="footer">
          &copy; 2026 HR Nexa Multi-Tenant HRMS. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
}

export function getOtpTemplate(otp: string): string {
  return getBaseLayout(
    'Your One-Time Password (OTP)',
    `
    We received a login or verification attempt requiring an OTP code.
    <div class="highlight-box" style="text-align: center; font-size: 24px; font-weight: bold; color: #7c3aed; letter-spacing: 4px;">
      ${otp}
    </div>
    This code is valid for <strong>5 minutes</strong>. If you did not request this, please secure your account credentials immediately.
    `,
  );
}

export function getEmailChangeVerificationTemplate(otp: string, expiresMinutes: number = 15): string {
  return getBaseLayout(
    'SuperAdmin Email Change Verification',
    `
    A request was initiated to update the Platform SuperAdmin account email address to this destination.
    <br><br>
    Please enter the following 6-digit verification code in the Owner portal to confirm this change:
    <div class="highlight-box" style="text-align: center; font-size: 26px; font-weight: bold; color: #7c3aed; letter-spacing: 6px; padding: 18px;">
      ${otp}
    </div>
    This verification code is valid for <strong>${expiresMinutes} minutes</strong> and can only be used once.
    <br><br>
    <strong>Security Notice:</strong> If you did not authorize this change, please ignore this email. The SuperAdmin account will remain unchanged and existing credentials remain secure.
    `,
  );
}

export function getVerificationTemplate(verificationLink: string): string {
  return getBaseLayout(
    'Verify Your Email Address',
    `
    Thank you for registering with HR Nexa. Please click the button below to verify your email address and activate your account:
    <div style="text-align: center; margin: 28px 0;">
      <a href="${verificationLink}" style="display: inline-block; background-color: #7c3aed; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none;" target="_blank">Verify Email</a>
    </div>
    `,
  );
}

export function getPayrollTemplate(toName: string, month: string): string {
  return getBaseLayout(
    'Salary Slip Issued',
    `
    Hello <strong>${toName}</strong>,<br/><br/>
    Your salary payslip for the month of <strong>${month}</strong> has been processed and generated.
    <br/><br/>
    Please find the payslip PDF attached to this email. You can also view or download your payroll history at any time by logging into the Employee Self Service portal.
    `,
  );
}

export function getLeaveApprovalTemplate(
  toName: string,
  leaveDetails: string,
): string {
  return getBaseLayout(
    'Leave Request Approved',
    `
    Hello <strong>${toName}</strong>,<br/><br/>
    We are pleased to inform you that your leave request has been approved.
    <div class="highlight-box">
      <strong>Leave Details:</strong><br/>
      ${leaveDetails}
    </div>
    Have a good time off!
    `,
  );
}

export function getLeaveRejectionTemplate(
  toName: string,
  leaveDetails: string,
  reason: string,
): string {
  return getBaseLayout(
    'Leave Request Status Update',
    `
    Hello <strong>${toName}</strong>,<br/><br/>
    We regret to inform you that your leave request has been declined.
    <div class="highlight-box">
      <strong>Request Details:</strong><br/>
      ${leaveDetails}
      <br/><br/>
      <strong>Reason for Decline:</strong><br/>
      ${reason || 'Not specified'}
    </div>
    If you have any questions, please contact your manager or HR Administrator.
    `,
  );
}

export function getInterviewTemplate(
  toName: string,
  roleName: string,
  details: string,
): string {
  return getBaseLayout(
    'Interview Invitation',
    `
    Hello <strong>${toName}</strong>,<br/><br/>
    Thank you for your application for the <strong>${roleName}</strong> position at our company.
    <br/><br/>
    We would like to invite you for an interview to discuss your candidacy.
    <div class="highlight-box">
      <strong>Interview Details:</strong><br/>
      ${details}
    </div>
    `,
  );
}

export function getInvoiceTemplate(
  toName: string,
  company: string,
  amount: number,
): string {
  return getBaseLayout(
    'Subscription Invoice Generated',
    `
    Hello <strong>${toName}</strong>,<br/><br/>
    An invoice has been generated for the subscription of <strong>${company}</strong>.
    <div class="highlight-box">
      <strong>Subscription Details:</strong><br/>
      Company: ${company}<br/>
      Amount: $${amount.toFixed(2)}
    </div>
    Please find your receipt/invoice PDF attached. Thank you for partnering with HR Nexa!
    `,
  );
}
