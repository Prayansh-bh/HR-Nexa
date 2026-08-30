/**
 * Utility function to HTML-escape dynamic input values
 * preventing XSS vulnerabilities when generating printable HTML templates or PDF views.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value !== "string") {
    try {
      value = JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
