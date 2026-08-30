/**
 * Safely masks a bank account number for UI/payslip presentation
 * preserving only the last 4 digits (e.g. "123456789845" -> "XXXXXXXX9845").
 * Never logs raw account numbers to debug/console logs.
 */
export function maskAccountNumber(acc: unknown): string {
  if (acc === null || acc === undefined) {
    return "Bank details not configured";
  }
  const str = String(acc).trim();
  if (!str || str.toUpperCase() === "N/A" || str === "—") {
    return "Bank details not configured";
  }
  if (str.length <= 4) {
    return str;
  }
  const last4 = str.slice(-4);
  const maskedLength = Math.max(4, str.length - 4);
  return "X".repeat(maskedLength) + last4;
}
