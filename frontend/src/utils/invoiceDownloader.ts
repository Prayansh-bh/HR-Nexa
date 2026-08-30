import { Invoice } from "../services/billing.service";
import { formatCurrency } from "./currency.utils";
import { formatDate } from "./date.utils";

export function downloadInvoiceHtml(
  invoice: Invoice,
  currencyStr?: string,
  dateFormat?: string,
) {
  const formattedAmount = formatCurrency(invoice.amount, currencyStr, {
    maximumFractionDigits: 0,
  });
  const formattedZeroTax = formatCurrency(0, currencyStr, {
    maximumFractionDigits: 0,
  });
  const displayDate = formatDate(invoice.date, dateFormat);

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.id}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #334155;
      margin: 0;
      padding: 40px;
      background-color: #f8fafc;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
    }
    .company-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.025em;
    }
    .invoice-title {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      text-align: right;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 8px;
    }
    .badge-paid {
      background-color: #dcfce7;
      color: #15803d;
    }
    .badge-pending {
      background-color: #fef3c7;
      color: #b45309;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 40px;
    }
    .details-block h4 {
      margin: 0 0 8px 0;
      font-size: 12px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.05em;
    }
    .details-block p {
      margin: 0;
      font-size: 15px;
      color: #0f172a;
      line-height: 1.5;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
    }
    th {
      background-color: #f8fafc;
      color: #64748b;
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 600;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    td {
      padding: 16px;
      font-size: 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #0f172a;
    }
    .amount-col {
      text-align: right;
    }
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 24px;
    }
    .totals-table {
      width: 300px;
      margin: 0;
    }
    .totals-table td {
      border: none;
      padding: 8px 0;
    }
    .total-row td {
      font-size: 18px;
      font-weight: 800;
      color: #4f46e5;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
    }
    .footer {
      text-align: center;
      margin-top: 60px;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 24px;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div class="logo-section">
        <div class="logo-icon">HR</div>
        <div>
          <div class="company-title">HR Nexa Suite</div>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Enterprise Payroll Platform</p>
        </div>
      </div>
      <div>
        <div class="invoice-title">INVOICE</div>
        <div style="text-align: right;">
          <span class="badge ${invoice.status.toLowerCase() === "paid" || invoice.status.toLowerCase() === "processed" ? "badge-paid" : "badge-pending"}">${invoice.status}</span>
        </div>
      </div>
    </div>

    <div class="details-grid">
      <div class="details-block">
        <h4>Billed To</h4>
        <p><strong>${invoice.company}</strong></p>
        <p>Organization Client Account</p>
      </div>
      <div class="details-block" style="text-align: right;">
        <h4>Invoice Details</h4>
        <p><strong>Invoice ID:</strong> ${invoice.id}</p>
        <p><strong>Date:</strong> ${displayDate}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="amount-col">Quantity</th>
          <th class="amount-col">Unit Price</th>
          <th class="amount-col">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${invoice.type}</strong><br><span style="font-size: 12px; color: #64748b;">SaaS Subscription License for the Billing Period</span></td>
          <td class="amount-col">1</td>
          <td class="amount-col">${formattedAmount}</td>
          <td class="amount-col">${formattedAmount}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals-section">
      <table class="totals-table">
        <tr>
          <td>Subtotal:</td>
          <td class="amount-col">${formattedAmount}</td>
        </tr>
        <tr>
          <td>GST / Taxes (0%):</td>
          <td class="amount-col">${formattedZeroTax}</td>
        </tr>
        <tr class="total-row">
          <td>Total:</td>
          <td class="amount-col">${formattedAmount}</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <p>Thank you for choosing HR Nexa Suite!</p>
      <p>If you have any questions about this invoice, please contact support@hrnexa.com</p>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `invoice-${invoice.id}.html`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
