/** ISO 4217 codes supported in store settings */
export const DEFAULT_CURRENCY = "RON";

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const SUPPORTED_CURRENCIES = [
  { code: "RON", label: "Lei (RON)", locale: "ro-RO" },
  { code: "EUR", label: "Euro (EUR)", locale: "ro-RO" },
  { code: "USD", label: "US Dollar (USD)", locale: "en-US" },
  { code: "GBP", label: "British Pound (GBP)", locale: "en-GB" },
  { code: "CHF", label: "Swiss Franc (CHF)", locale: "de-CH" },
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
  const locale = localeByCode[code] ?? "ro-RO";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}