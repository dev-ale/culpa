// Run with: node --test lib/balances.test.ts   (Node 23+; native TS, zero deps)
//
// These tests pin computePairwiseBalances to the worked example in CONTEXT.md
// (the dinner → payment → edit → delete dialogue) plus the invariants from
// issue #15: only non-zero pairs, self-shares excluded, no rounding drift.
//
// Amounts are integer minor units (cents): €30 == 3000.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  type BalanceEntry,
  type BalanceShare,
  computePairwiseBalances,
  type PairwiseBalance,
} from './balances.ts'

const ALEX = 'alex'
const BOB = 'bob'
const MICHELLE = 'michelle'

// Find the directed balance for an unordered pair, or null if they're square.
function between(
  balances: PairwiseBalance[],
  x: string,
  y: string,
): PairwiseBalance | null {
  return (
    balances.find(
      (b) =>
        (b.from === x && b.to === y) || (b.from === y && b.to === x),
    ) ?? null
  )
}

test('dinner split 3 ways: Bob and Michelle each owe Alex €30', () => {
  const entries: BalanceEntry[] = [{ id: 'dinner', paidBy: ALEX }]
  const shares: BalanceShare[] = [
    { entryId: 'dinner', participantId: ALEX, amount: 3000 },
    { entryId: 'dinner', participantId: BOB, amount: 3000 },
    { entryId: 'dinner', participantId: MICHELLE, amount: 3000 },
  ]

  const balances = computePairwiseBalances(entries, shares)

  // Alex's own €30 share nets out — he doesn't owe himself.
  assert.deepEqual(balances, [
    { from: BOB, to: ALEX, amount: 3000 },
    { from: MICHELLE, to: ALEX, amount: 3000 },
  ])
})

test('dinner + Michelle’s €30 payment: Alex and Michelle are square, Bob still owes €30', () => {
  const entries: BalanceEntry[] = [
    { id: 'dinner', paidBy: ALEX },
    { id: 'payment', paidBy: MICHELLE },
  ]
  const shares: BalanceShare[] = [
    { entryId: 'dinner', participantId: ALEX, amount: 3000 },
    { entryId: 'dinner', participantId: BOB, amount: 3000 },
    { entryId: 'dinner', participantId: MICHELLE, amount: 3000 },
    // Payment: one Share, 100% to the recipient (Alex).
    { entryId: 'payment', participantId: ALEX, amount: 3000 },
  ]

  const balances = computePairwiseBalances(entries, shares)

  assert.equal(between(balances, ALEX, MICHELLE), null, 'should be square')
  assert.deepEqual(between(balances, ALEX, BOB), {
    from: BOB,
    to: ALEX,
    amount: 3000,
  })
})

test('edit dinner to €120 (Michelle €40): she now owes Alex €10', () => {
  const entries: BalanceEntry[] = [
    { id: 'dinner', paidBy: ALEX },
    { id: 'payment', paidBy: MICHELLE },
  ]
  const shares: BalanceShare[] = [
    { entryId: 'dinner', participantId: ALEX, amount: 4000 },
    { entryId: 'dinner', participantId: BOB, amount: 4000 },
    { entryId: 'dinner', participantId: MICHELLE, amount: 4000 },
    { entryId: 'payment', participantId: ALEX, amount: 3000 },
  ]

  const balances = computePairwiseBalances(entries, shares)

  // €40 owed − €30 already paid = €10 residual, Michelle → Alex.
  assert.deepEqual(between(balances, ALEX, MICHELLE), {
    from: MICHELLE,
    to: ALEX,
    amount: 1000,
  })
})

test('delete the dinner: Alex now owes Michelle €30 (her payment stands alone)', () => {
  const entries: BalanceEntry[] = [{ id: 'payment', paidBy: MICHELLE }]
  const shares: BalanceShare[] = [
    { entryId: 'payment', participantId: ALEX, amount: 3000 },
  ]

  const balances = computePairwiseBalances(entries, shares)

  assert.deepEqual(balances, [{ from: ALEX, to: MICHELLE, amount: 3000 }])
})

test('a payer’s own share is excluded — no one owes themselves', () => {
  const entries: BalanceEntry[] = [{ id: 'solo', paidBy: ALEX }]
  const shares: BalanceShare[] = [
    { entryId: 'solo', participantId: ALEX, amount: 5000 },
  ]

  assert.deepEqual(computePairwiseBalances(entries, shares), [])
})

test('split-equally remainder lands on payer: shares sum exactly, balances reconcile', () => {
  // €100 split 3 ways: floor(10000/3)=3333, remainder 1 cent parked on payer.
  const total = 10000
  const base = Math.floor(total / 3) // 3333
  const remainder = total - base * 3 // 1
  const entries: BalanceEntry[] = [{ id: 'lunch', paidBy: ALEX }]
  const shares: BalanceShare[] = [
    { entryId: 'lunch', participantId: ALEX, amount: base + remainder },
    { entryId: 'lunch', participantId: BOB, amount: base },
    { entryId: 'lunch', participantId: MICHELLE, amount: base },
  ]

  // The Share amounts are the source of truth and sum to the total exactly.
  assert.equal(
    shares.reduce((s, sh) => s + sh.amount, 0),
    total,
  )

  const balances = computePairwiseBalances(entries, shares)
  const owedToAlex = balances.reduce((s, b) => s + b.amount, 0)

  // Everyone but Alex owes their non-rounded share; no cent is lost or invented.
  assert.deepEqual(balances, [
    { from: BOB, to: ALEX, amount: base },
    { from: MICHELLE, to: ALEX, amount: base },
  ])
  assert.equal(owedToAlex, total - (base + remainder))
})
