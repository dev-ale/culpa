'use client'

// Culpa — domain display pieces built on the scribble primitives.
// These are presentation-only and prop-driven: they render whatever balances
// and entries they are handed. The data that fills them (derived pairwise
// balances, the Entry list) lands with the entries feature; until then the
// Overview renders empty states and never mounts these with rows.

import * as React from 'react'

import {
  Money,
  ScribbleArrow,
  ScribbleAvatar,
  ScribbleCircle,
  ScribbleDivider,
  ScribbleStar,
  ScribbleUnderline,
} from '@/components/scribble'

// A derived pairwise balance: `fromName` owes `toName` `amount` (major units).
export type BalanceView = {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}

// One Entry as rendered in "the spending" list.
export type EntryView =
  | {
      id: string
      kind: 'expense'
      title: string
      dateStr: string
      amount: number
      paidByName: string
      shareCount: number
    }
  | {
      id: string
      kind: 'payment'
      title: string
      dateStr: string
      amount: number
      fromName: string
      toName: string
    }

// ─────────────────────────────────────────────────────────────
// BalanceRow — "Bob owes Alex €18", as prose. The viewer's own rows
// get a ★ and the amount is toned (red = you owe, green = you're owed).
// ─────────────────────────────────────────────────────────────
export function BalanceRow({
  balance,
  currency,
  viewerId,
  seed = 1,
}: {
  balance: BalanceView
  currency: string
  viewerId?: string
  seed?: number
}) {
  const { fromId, fromName, toId, toName, amount } = balance
  const youAreDebtor = viewerId === fromId
  const youAreCreditor = viewerId === toId
  const isYou = youAreDebtor || youAreCreditor
  const fromLabel = youAreDebtor ? 'You' : fromName
  const toLabel = youAreCreditor ? 'you' : toName

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 4px',
        position: 'relative',
        fontSize: 20,
      }}
    >
      {isYou && (
        <span style={{ position: 'absolute', left: -22, top: '50%', transform: 'translateY(-50%) rotate(-8deg)' }}>
          <ScribbleStar seed={seed + 5} color="var(--red)" size={18} />
        </span>
      )}
      <ScribbleAvatar name={fromName} size={32} seed={seed + 1} you={youAreDebtor} />
      <span style={{ fontFamily: 'var(--font-hand), cursive', fontWeight: 600, fontSize: 26, lineHeight: 1 }}>{fromLabel}</span>
      <span style={{ fontFamily: 'var(--font-hand), cursive', fontStyle: 'italic', fontSize: 20, color: 'var(--pencil)', margin: '0 4px' }}>owes</span>
      <ScribbleAvatar name={toName} size={32} seed={seed + 2} you={youAreCreditor} />
      <span style={{ fontFamily: 'var(--font-hand), cursive', fontWeight: 600, fontSize: 26, lineHeight: 1 }}>{toLabel}</span>
      <span style={{ marginLeft: 'auto' }}>
        <Money amount={amount} currency={currency} size="md" tone={youAreDebtor ? 'owed' : youAreCreditor ? 'credit' : undefined} />
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// EntryRow — a handwritten line item. Expenses say "fronted by",
// payments say "paid to" — never conflating the two senses of "paid".
// ─────────────────────────────────────────────────────────────
export function EntryRow({ entry, currency, seed = 1 }: { entry: EntryView; currency: string; seed?: number }) {
  const isPayment = entry.kind === 'payment'
  const sub = isPayment ? (
    <>
      {entry.fromName} <span style={{ color: 'var(--green)' }}>paid to</span> {entry.toName}
    </>
  ) : (
    <>
      fronted by <b style={{ fontWeight: 600 }}>{entry.paidByName}</b> · split {entry.shareCount} ways
    </>
  )
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        gap: 14,
        alignItems: 'center',
        padding: '12px 4px',
        fontSize: 17,
      }}
    >
      <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pencil)' }}>
        {isPayment ? (
          <ScribbleArrow width={30} height={14} seed={seed * 3} color="var(--green)" strokeWidth={1.8} />
        ) : (
          <ScribbleCircle size={28} seed={seed} color="var(--pencil)" strokeWidth={1.4} amp={1}>
            <span style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 16, color: 'var(--pencil)' }}>{(entry.title || '?')[0]}</span>
          </ScribbleCircle>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-print), cursive',
            fontSize: 19,
            color: isPayment ? 'var(--green)' : 'var(--ink)',
            lineHeight: 1.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.title}
        </div>
        <div style={{ fontFamily: 'var(--font-print), cursive', fontSize: 13.5, color: 'var(--pencil)' }}>
          {entry.dateStr} · {sub}
        </div>
      </div>
      <Money amount={entry.amount} currency={currency} size="md" tone={isPayment ? 'credit' : undefined} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CulpaLogo — wordmark with the red underline used across screens.
// ─────────────────────────────────────────────────────────────
export function CulpaLogo({ size = 32, seed = 1 }: { size?: number; seed?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span style={{ fontFamily: 'var(--font-hand), cursive', fontWeight: 700, fontSize: size }}>Culpa.</span>
      <span style={{ position: 'absolute', left: 2, right: 8, bottom: -4 }}>
        <ScribbleUnderline seed={seed} color="var(--red)" strokeWidth={2.4} amp={1.8} />
      </span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// SectionHeading — handwritten title + count, over a wavy divider.
// ─────────────────────────────────────────────────────────────
export function SectionHeading({ title, meta, seed = 1 }: { title: string; meta?: React.ReactNode; seed?: number }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 28, fontWeight: 600 }}>{title}</div>
        {meta != null && <div className="c-tiny">{meta}</div>}
      </div>
      <ScribbleDivider seed={seed} color="var(--pencil-soft)" strokeWidth={1.4} amp={1.6} style={{ margin: '0 0 6px' }} />
    </>
  )
}
