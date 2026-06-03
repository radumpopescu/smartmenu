/** ISO 4217 codes supported in store settings */
export const DEFAULT_CURRENCY = "RON";

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const SUPPORTED_CURRENCIES = [
  { code: "RON", label: "Lei", locale: "ro-RO", symbol: "lei" },
  { code: "EUR", label: "Euro", locale: "ro-RO", symbol: "€" },
  { code: "USD", label: "US Dollar", locale: "en-US", symbol: "$" },
  { code: "GBP", label: "British Pound", locale: "en-GB", symbol: "£" },
  { code: "CHF", label: "Swiss Franc", locale: "de-CH", symbol: "CHF" },
] as const;

const localeByCode = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.locale])
) as Record<string, string>;

export function normalizeCurrency(code: string | null | undefined): string {
  if (!code) return DEFAULT_CURRENCY;
  const upper = code.toUpperCase();
  if (localeByCode[upper]) return upper;
  return DEFAULT_CURRENCY;
}

export function formatPrice(
  cents: number | null,
  label?: string | null,
  currency: string = DEFAULT_CURRENCY
): string {
  if (label) return label;
  if (cents == null) return "";

  const code = normalizeCurrency(currency);
  const config = SUPPORTED_CURRENCIES.find((c) => c.code === code);
  const locale = config?.locale ?? "ro-RO";
  const amount = cents / 100;

  if (code === "RON") {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted} lei`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    const suffix = config?.symbol ?? code;
    return `${amount.toFixed(2)} ${suffix}`;
  }
}