// "Split equally" helper. Each selected Participant owes floor(total / N) cents;
// the leftover remainder cents land on the payer's own Share, so the amounts
// always sum to exactly `totalCents` — no rounding drift. The payer is expected
// to be among the selected Participants; if they aren't, the remainder falls on
// the first selected Participant so the result still sums exactly.
//
// Pure and shared between the client form (to fill inputs) and any server reuse.
export function splitEqually(
  totalCents: number,
  participantIds: string[],
  payerId: string,
): Record<string, number> {
  const result: Record<string, number> = {}
  const n = participantIds.length
  if (n === 0) return result

  const base = Math.floor(totalCents / n)
  const remainder = totalCents - base * n
  const remainderHolder = participantIds.includes(payerId)
    ? payerId
    : participantIds[0]

  for (const id of participantIds) {
    result[id] = base + (id === remainderHolder ? remainder : 0)
  }
  return result
}
