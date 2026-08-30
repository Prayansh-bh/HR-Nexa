import { Injectable } from '@nestjs/common';

export interface OfferLetterTemplateParams {
  recipientName: string;
  designation: string;
  companyName: string;
  companyAddress: string;
  issueDate: string;
  joiningDate: string;
  offerRef: string;
  expiryDate?: string;
  terms?: string;
  preview: {
    annualCTC: number;
    monthlyCTC: number;
    annualGross: number;
    monthlyGross: number;
    netTakeHomeMonthly: number;
    breakdown: Array<{
      name: string;
      category: string;
      monthly: number;
      annual: number;
    }>;
  };
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class OfferLetterTemplateService {
  /**
   * Compiles the canonical, authoritative server-side HTML Offer Letter document.
   * This is the SINGLE source of truth for all offer letter rendering in the application.
   */
  compileOfferLetterHtml(params: OfferLetterTemplateParams): string {
    const {
      recipientName,
      designation,
      companyName,
      companyAddress,
      issueDate,
      joiningDate,
      offerRef,
      expiryDate,
      terms,
      preview,
    } = params;

    const safeRecipientName = escapeHtml(recipientName);
    const safeDesignation = escapeHtml(designation);
    const safeCompanyName = escapeHtml(companyName);
    const safeCompanyAddress = escapeHtml(companyAddress);
    const safeIssueDate = escapeHtml(issueDate);
    const safeJoiningDate = escapeHtml(joiningDate);
    const safeOfferRef = escapeHtml(offerRef);
    const safeExpiryDate = expiryDate ? escapeHtml(expiryDate) : '';

    const rawTerms =
      terms ||
      'Standard probation period of 3 months applies. Governed by company policies.';
    const formattedTerms = escapeHtml(rawTerms).replace(/\n/g, '<br/>');

    const breakdownRowsHtml = (preview.breakdown || [])
      .map(
        (b) => `
        <tr style="border-bottom: 1px solid #e2e8f0; ${b.category === 'DEDUCTION' ? 'color: #64748b;' : ''}">
          <td style="padding: 10px 12px; font-weight: 500;">
            ${escapeHtml(b.name)} 
            <span style="font-size: 11px; opacity: 0.75;">
              (${b.category === 'BENEFIT' ? 'Employer Contribution' : b.category === 'DEDUCTION' ? 'Deduction' : 'Earnings'})
            </span>
          </td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 600;">₹${Number(b.monthly).toLocaleString('en-IN')}</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 600;">₹${Number(b.annual).toLocaleString('en-IN')}</td>
        </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Offer Letter - ${safeRecipientName}</title>
  <style>
    body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #ffffff; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-top: 6px solid #7c3aed; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 28px; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #7c3aed, #c026d3); border-radius: 10px; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 18px; font-family: sans-serif; }
    .company-title { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }
    .company-meta { font-size: 12px; color: #64748b; margin-top: 2px; }
    .meta-box { text-align: right; font-size: 12px; color: #64748b; }
    .meta-box strong { color: #1e293b; }
    .offer-title { text-align: center; font-size: 20px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 1.5px; margin: 24px 0 16px 0; }
    .salutation { font-size: 15px; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
    .body-text { font-size: 14px; color: #334155; margin-bottom: 24px; text-align: justify; }
    .annexure-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #7c3aed; margin: 32px 0 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
    th { background: #f8fafc; text-align: left; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; font-weight: 700; color: #475569; }
    .total-row { background: #f3e8ff; font-weight: 800; color: #6b21a8; border-top: 2px solid #c084fc; }
    .terms-box { background: #f8fafc; border-left: 4px solid #7c3aed; padding: 16px; font-size: 13px; color: #475569; margin-bottom: 32px; border-radius: 0 6px 6px 0; }
    .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
    .sig-block { width: 45%; }
    .sig-line { margin-top: 40px; border-bottom: 1px solid #94a3b8; width: 100%; }
    .sig-title { font-size: 12px; font-weight: 700; color: #475569; margin-top: 6px; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="logo-icon">HR</div>
        <div>
          <h2 class="company-title">${safeCompanyName}</h2>
          <div class="company-meta">${safeCompanyAddress}</div>
        </div>
      </div>
      <div class="meta-box">
        <div><strong>Ref:</strong> ${safeOfferRef}</div>
        <div><strong>Date:</strong> ${safeIssueDate}</div>
      </div>
    </div>

    <div class="offer-title">Formal Offer of Employment</div>

    <div class="salutation">Dear ${safeRecipientName},</div>

    <div class="body-text">
      We are pleased to offer you the position of <strong>${safeDesignation}</strong> at <strong>${safeCompanyName}</strong>.
      Based on our evaluation and discussion, we believe your skills and experience will make a significant contribution to our team.
      <br/><br/>
      Your Total Cost to Company (CTC) will be <strong>₹${Number(preview.annualCTC).toLocaleString('en-IN')}</strong> per annum.
      Your expected date of joining is <strong>${safeJoiningDate}</strong>.
    </div>

    <div class="annexure-title">Annexure A: Compensation Breakdown</div>

    <table>
      <thead>
        <tr>
          <th>Salary Component</th>
          <th style="text-align: right;">Monthly (₹)</th>
          <th style="text-align: right;">Annual (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${breakdownRowsHtml}
        <tr class="total-row">
          <td style="padding: 12px;">Total Cost to Company (CTC)</td>
          <td style="padding: 12px; text-align: right;">₹${Number(preview.monthlyCTC).toLocaleString('en-IN')}</td>
          <td style="padding: 12px; text-align: right;">₹${Number(preview.annualCTC).toLocaleString('en-IN')}</td>
        </tr>
      </tbody>
    </table>

    <div class="terms-box">
      <strong>Terms of Offer:</strong><br/>
      ${formattedTerms}
      ${safeExpiryDate ? `<br/><br/><em>This offer is valid until ${safeExpiryDate}.</em>` : ''}
    </div>

    <div class="signatures">
      <div class="sig-block">
        <div>For <strong>${safeCompanyName}</strong></div>
        <div class="sig-line"></div>
        <div class="sig-title">Authorized Signatory</div>
      </div>
      <div class="sig-block">
        <div>Accepted & Agreed</div>
        <div class="sig-line"></div>
        <div class="sig-title">${safeRecipientName} (Signature & Date)</div>
      </div>
    </div>

    <div class="footer">
      This is a system-generated offer letter document issued by ${safeCompanyName}.
    </div>
  </div>
</body>
</html>`;
  }
}
