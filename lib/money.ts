// Money is stored and computed in integer minor units (cents) end-to-end, never
// as floats — so no rounding drift is possible. These helpers convert to/from
// the major-unit strings a person types and reads. They assume a 2-decimal
// currency (the curated set in lib/currencies is all 2-decimal in practice).

// Parse a major-unit amount ("90", "90.5", "90.50") into a positive integer of
// cents. Returns null for anything malformed, zero, negative, or with more than
// two decimal places — callers surface that as a field error.
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null

  const [whole, frac = ''] = trimmed.split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0) return null
  return cents
}

// "9000" -> "90.00". For an editable input value.
export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

// "9000", "EUR" -> "90.00 EUR". For read-only display alongside the Group's
// currency code.
export function formatMoney(cents: number, currency: string): string {
  return `${formatCents(cents)} ${currency}`
}
