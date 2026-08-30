const CURRENCY_CONFIG: Record<string, { code: string; locale: string }> = {
  "INR (₹)": { code: "INR", locale: "en-IN" },
  "INR": { code: "INR", locale: "en-IN" },
  "USD ($)": { code: "USD", locale: "en-US" },
  "USD": { code: "USD", locale: "en-US" },
  "EUR (€)": { code: "EUR", locale: "de-DE" },
  "EUR": { code: "EUR", locale: "de-DE" },
  "GBP (£)": { code: "GBP", locale: "en-GB" },
  "GBP": { code: "GBP", locale: "en-GB" },
  "AED (AED)": { code: "AED", locale: "en-AE" },
  "AED": { code: "AED", locale: "en-AE" },
};

export function resolveCurrencyCode(currencyStr?: string): string {
  if (!currencyStr) return "INR";
  const mapped = CURRENCY_CONFIG[currencyStr];
  if (mapped) return mapped.code;
  const match = currencyStr.match(/^[A-Z]{3}/i);
  if (match) return match[0].toUpperCase();
  return "INR";
}

export function formatCurrency(
  amount: number,
  currencyStr?: string,
  options?: Intl.NumberFormatOptions
): string {
  const currencyCode = resolveCurrencyCode(currencyStr);
  const locale = CURRENCY_CONFIG[currencyStr || ""]?.locale || "en-US";
  const num = typeof amount === "number" && !isNaN(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
      ...options,
    }).format(num);
  } catch {
    return `${currencyCode} ${num.toLocaleString()}`;
  }
}
