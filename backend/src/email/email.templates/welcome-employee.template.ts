export function getEmployeeWelcomeTemplate(
  toName: string,
  companyName: string,
  tempPassword: string,
  frontendUrl: string,
): string {
  const loginLink = `${frontendUrl}/`;
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
          .credentials-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; }
          .cred-row { margin-bottom: 8px; }
          .cred-row:last-child { margin-bottom: 0; }
          .cred-label { font-weight: 600; color: #475569; }
          .cred-value { font-family: monospace; font-size: 15px; color: #7c3aed; font-weight: 600; }
          .btn-container { text-align: center; margin: 28px 0; }
          .btn { display: inline-block; background-color: #7c3aed; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 6px rgba(124,58,237,0.3); }
          .footer { font-size: 12px; color: #999; text-align: center; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">HR Nexa</div>
          </div>
          <div class="title">Welcome to HR Nexa Portal</div>
          <div class="text">
            Hello <strong>${toName || 'Employee'}</strong>,<br/><br/>
            Your employee portal account for <strong>${companyName}</strong> has been onboarded by your HR Administrator.
          </div>
          <div class="credentials-box">
            <div class="cred-row"><span class="cred-label">Login Email:</span> (Your email address)</div>
            <div class="cred-row"><span class="cred-label">Temporary Password:</span> <span class="cred-value">${tempPassword}</span></div>
          </div>
          <div class="text">
            Click below to access your employee portal to view payroll, submit attendance, and request leaves.
          </div>
          <div class="btn-container">
            <a href="${loginLink}" class="btn" target="_blank">Access Employee Portal</a>
          </div>
          <div class="footer">
            &copy; 2026 HR Nexa Multi-Tenant HRMS. All rights reserved.
          </div>
        </div>
      </body>
      </html>
  `;
}
