import { formatHeaderLabel } from './csv-exporter.util';

export function convertToHTMLReport(title: string, data: any[]): string {
  if (!data || data.length === 0) {
    return `<html><body><h2>${title}</h2><p>No data available</p></body></html>`;
  }

  const keys = Object.keys(data[0]);

  const headersHtml = keys
    .map(
      (k) =>
        `<th style="border:1px solid #cbd5e1;padding:8px 12px;background:#f1f5f9;text-align:left;font-size:12px;font-weight:600;color:#334155;">${formatHeaderLabel(k)}</th>`,
    )
    .join('');

  const rowsHtml = data
    .map(
      (row) =>
        `<tr>` +
        keys
          .map(
            (k) =>
              `<td style="border:1px solid #e2e8f0;padding:8px 12px;font-size:12px;color:#475569;">${row[k] !== undefined && row[k] !== null ? row[k] : ''}</td>`,
          )
          .join('') +
        `</tr>`,
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 24px; color: #1e293b; }
        h1 { font-size: 20px; font-weight: 700; color: #7c3aed; margin-bottom: 4px; }
        p.sub { font-size: 12px; color: #64748b; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <h1>HR Nexa - Platform ${title}</h1>
      <p class="sub">Generated on ${new Date().toLocaleString()} | Confidential Super Admin Platform Report</p>
      <table>
        <thead>
          <tr>${headersHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <footer>&copy; 2026 HR Nexa SaaS HRMS. All rights reserved.</footer>
    </body>
    </html>
  `;
}
