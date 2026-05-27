// A curated subset of ISO 4217 codes offered when creating a Group. A Group's
// currency is fixed at creation, so the set only needs to cover common cases —
// it is not meant to be exhaustive. Each code is exactly 3 chars (DB constraint).
export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'ZAR', name: 'South African Rand' },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

// Tuple form for z.enum(...). Cast keeps the literal union without re-listing.
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [
  CurrencyCode,
  ...CurrencyCode[],
]

const CURRENCY_NAMES = new Map(CURRENCIES.map((c) => [c.code, c.name]))

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return CURRENCY_NAMES.has(code as CurrencyCode)
}

// "EUR — Euro" for read-only display.
export function currencyLabel(code: string): string {
  const name = CURRENCY_NAMES.get(code as CurrencyCode)
  return name ? `${code} — ${name}` : code
}
