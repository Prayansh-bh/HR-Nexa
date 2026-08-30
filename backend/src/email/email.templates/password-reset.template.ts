export function getPasswordResetTemplate(
  toName: string,
  resetLink: string,
): string {
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
          .text { font-size: 14px; line-height: 1.6; color: #555; margin-bottom: 24px; }
          .btn-container { text-align: center; margin: 28px 0; }
          .btn { display: inline-block; background-color: #7c3aed; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 6px rgba(124,58,237,0.3); }
          .footer { font-size: 12px; color: #999; text-align: center; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; }
          .token-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 13px; word-break: break-all; color: #475569; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">HR Nexa</div>
          </div>
          <div class="title">Password Reset Request</div>
          <div class="text">
            Hello <strong>${toName || 'User'}</strong>,<br/><br/>
            We received a request to reset the password for your account. Click the button below to set a new password:
          </div>
          <div class="btn-container">
            <a href="${resetLink}" class="btn" target="_blank">Reset Password</a>
          </div>
          <div class="text">
            This link is valid for <strong>15 minutes</strong>. If you did not request a password reset, please ignore this email.
          </div>
          <div class="token-box">
            Or copy & paste this link in your browser:<br/>
            <a href="${resetLink}" style="color: #7c3aed;">${resetLink}</a>
          </div>
          <div class="footer">
            &copy; 2026 HR Nexa Multi-Tenant HRMS. All rights reserved.
          </div>
        </div>
      </body>
      </html>
  `;
}
