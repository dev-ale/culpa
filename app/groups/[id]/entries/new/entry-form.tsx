'use client'

import Link from 'next/link'
import * as React from 'react'
import { useMemo, useRef, useState } from 'react'

import {
  Money,
  ScribbleArrow,
  ScribbleAvatar,
  ScribbleBox,
  ScribbleButton,
  ScribbleCheckbox,
  ScribbleCircleFill,
  ScribbleCurvedArrow,
  ScribbleUnderline,
  currencySymbol,
  mulberry32,
} from '@/components/scribble'

type Participant = { id: string; displayName: string }
type Kind = 'expense' | 'payment'

export function EntryForm({
  groupId,
  currency,
  initialKind,
  participants,
}: {
  groupId: string
  currency: string
  initialKind: Kind
  participants: Participant[]
}) {
  const sym = currencySymbol(currency)
  const [kind, setKind] = useState<Kind>(initialKind)
  const [notice, setNotice] = useState(false)

  // ── shared ──
  const [title, setTitle] = useState('')

  // ── expense ──
  const [total, setTotal] = useState('')
  const [paidById, setPaidById] = useState(participants[0]?.id ?? '')
  const [included, setIncluded] = useState<Set<string>>(
    () => new Set(participants.map((p) => p.id)),
  )
  const [shares, setShares] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    participants.forEach((p) => (m[p.id] = ''))
    return m
  })

  // ── payment ──
  const [amount, setAmount] = useState('')
  const [debtorId, setDebtorId] = useState(participants[0]?.id ?? '')
  const [creditorId, setCreditorId] = useState(participants[1]?.id ?? participants[0]?.id ?? '')

  const totalNum = parseFloat(total) || 0
  const sumShares = useMemo(() => {
    let s = 0
    included.forEach((id) => {
      s += parseFloat(shares[id]) || 0
    })
    return Math.round(s * 100) / 100
  }, [shares, included])
  const remainder = Math.round((totalNum - sumShares) * 100) / 100
  const exact = Math.abs(remainder) < 0.005
  const over = remainder < -0.005
  const progressPct = totalNum > 0 ? Math.min(100, (sumShares / totalNum) * 100) : 0

  const expenseValid = totalNum > 0 && exact && included.size >= 1
  const amountNum = parseFloat(amount) || 0
  const paymentValid = amountNum > 0 && !!debtorId && !!creditorId && debtorId !== creditorId
  const canSave = kind === 'expense' ? expenseValid : paymentValid

  function toggleInclude(id: string) {
    const n = new Set(included)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setIncluded(n)
  }

  function splitEqually() {
    const inc = Array.from(included)
    if (inc.length === 0 || totalNum <= 0) return
    const cents = Math.round(totalNum * 100)
    const each = Math.floor(cents / inc.length)
    const leftover = cents - each * inc.length
    const m = { ...shares }
    inc.forEach((id) => (m[id] = (each / 100).toFixed(2)))
    // Floor split: park leftover cents on whoever fronted it (or first included).
    const parkOn = included.has(paidById) ? paidById : inc[0]
    m[parkOn] = ((each + leftover) / 100).toFixed(2)
    participants.forEach((p) => {
      if (!included.has(p.id)) m[p.id] = '0.00'
    })
    setShares(m)
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    // No entries backend yet: the form is the design, ready to be wired.
    setNotice(true)
  }

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.displayName ?? '?'

  return (
    <form onSubmit={onSave} className="mx-auto w-full max-w-xl px-5 pb-24 pt-2 sm:px-8">
      {/* Top bar */}
      <div className="flex items-center justify-between py-2">
        <Link
          href={`/groups/${groupId}`}
          className="c-label"
          style={{ fontFamily: 'var(--font-print), cursive', fontSize: 17, color: 'var(--pencil)', textDecoration: 'none' }}
        >
          cancel
        </Link>
        <div className="c-label" style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 18 }}>new entry</div>
        <ScribbleButton type="submit" variant={canSave ? 'ink' : 'ghost'} seed={1} disabled={!canSave} fontSize={15} padding="6px 14px">
          save
        </ScribbleButton>
      </div>

      {/* Segmented: expense / payment */}
      <div className="flex justify-center py-3">
        <div style={{ display: 'inline-flex', gap: 28, fontFamily: 'var(--font-print), cursive', fontSize: 18 }}>
          {(['expense', 'payment'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k)
                setNotice(false)
              }}
              style={{ position: 'relative', background: 'transparent', border: 0, cursor: 'pointer', padding: '6px 4px', color: kind === k ? 'var(--ink)' : 'var(--pencil)' }}
            >
              {k}
              {kind === k && (
                <span style={{ position: 'absolute', left: -4, right: -4, bottom: -2, height: 10, background: 'var(--highlighter)', zIndex: -1, transform: 'rotate(-1.5deg)', borderRadius: 2 }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <Field label={kind === 'expense' ? 'what was it?' : 'what for? — optional'}>
        <BigInput value={title} onChange={setTitle} placeholder={kind === 'expense' ? 'dinner, taxi, deposit…' : 'settling up'} seed={4} />
      </Field>

      {/* Amount */}
      <div className="pt-6">
        <div className="c-label" style={{ marginBottom: 4 }}>{kind === 'expense' ? 'how much, total' : 'how much'}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, position: 'relative' }}>
          <span style={{ fontFamily: 'var(--font-num), monospace', fontSize: 46, fontWeight: 400, color: 'var(--pencil)' }}>{sym}</span>
          <input
            value={kind === 'expense' ? total : amount}
            onChange={(e) => (kind === 'expense' ? setTotal(e.target.value) : setAmount(e.target.value))}
            inputMode="decimal"
            placeholder="0.00"
            style={{ font: '700 56px/0.95 var(--font-num), monospace', letterSpacing: '-0.01em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', width: '100%', flex: 1, padding: '0 0 8px', background: 'transparent', border: 0, outline: 'none' }}
          />
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: -2 }}>
            <ScribbleUnderline seed={5} color="var(--ink)" strokeWidth={2.2} amp={2} />
          </span>
        </div>
        <div className="c-tiny" style={{ marginTop: 8 }}>{currency} · fixed for this group</div>
      </div>

      {kind === 'expense' ? (
        <ExpenseFields
          participants={participants}
          paidById={paidById}
          setPaidById={setPaidById}
          included={included}
          toggleInclude={toggleInclude}
          shares={shares}
          setShares={setShares}
          splitEqually={splitEqually}
          totalNum={totalNum}
          sumShares={sumShares}
          remainder={remainder}
          exact={exact}
          over={over}
          progressPct={progressPct}
          sym={sym}
          currency={currency}
        />
      ) : (
        <PaymentFields
          participants={participants}
          debtorId={debtorId}
          setDebtorId={setDebtorId}
          creditorId={creditorId}
          setCreditorId={setCreditorId}
          nameOf={nameOf}
        />
      )}

      {notice && (
        <div className="pt-7">
          <ScribbleBox seed={88} strokeWidth={1.6} color="var(--red)" amp={1.6} padding="14px 16px" style={{ background: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 20, color: 'var(--red)' }}>looks good — but not saved yet.</div>
            <div className="c-tiny" style={{ marginTop: 4, lineHeight: 1.5 }}>
              This is the {kind} form from the design. Recording entries lands with the entries feature; the screen is ready to wire up.
            </div>
          </ScribbleBox>
        </div>
      )}
    </form>
  )
}

// ─────────────────────────────────────────────────────────────
function ExpenseFields({
  participants,
  paidById,
  setPaidById,
  included,
  toggleInclude,
  shares,
  setShares,
  splitEqually,
  totalNum,
  sumShares,
  remainder,
  exact,
  over,
  progressPct,
  sym,
  currency,
}: {
  participants: Participant[]
  paidById: string
  setPaidById: (id: string) => void
  included: Set<string>
  toggleInclude: (id: string) => void
  shares: Record<string, string>
  setShares: (s: Record<string, string>) => void
  splitEqually: () => void
  totalNum: number
  sumShares: number
  remainder: number
  exact: boolean
  over: boolean
  progressPct: number
  sym: string
  currency: string
}) {
  return (
    <>
      {/* Fronted by */}
      <div className="pt-6">
        <div className="c-label" style={{ marginBottom: 12 }}>
          fronted by <span style={{ color: 'var(--pencil-soft)' }}>— who paid the real cost?</span>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {participants.map((p, i) => {
            const on = paidById === p.id
            return (
              <button key={p.id} type="button" onClick={() => setPaidById(p.id)} style={{ position: 'relative', background: 'transparent', border: 0, cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 4px' }}>
                <span style={{ position: 'relative' }}>
                  <ScribbleAvatar name={p.displayName} size={44} seed={300 + i * 11} strokeWidth={1.8} />
                  {on && (
                    <span style={{ position: 'absolute', inset: -8 }}>
                      <ScribbleCircleFill seed={500 + i * 13} color="var(--red)" strokeWidth={2.4} amp={2.6} />
                    </span>
                  )}
                </span>
                <span style={{ fontFamily: 'var(--font-print), cursive', fontSize: 14, color: on ? 'var(--red)' : 'var(--ink)', fontWeight: on ? 600 : 400 }}>{p.displayName}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Split between */}
      <div className="pt-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div className="c-label">split between</div>
          <button type="button" onClick={splitEqually} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, position: 'relative', display: 'inline-flex', alignItems: 'center', fontFamily: 'var(--font-print), cursive', fontSize: 15, color: 'var(--ink)' }}>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              ✦ split equally
              <span style={{ position: 'absolute', left: -4, right: -4, bottom: -6, width: 'calc(100% + 8px)' }}>
                <ScribbleUnderline seed={71} color="var(--ink)" strokeWidth={1.4} amp={1} />
              </span>
            </span>
          </button>
        </div>

        <ScribbleBox seed={73} strokeWidth={1.4} color="var(--pencil)" amp={1.4} padding={0} style={{ background: 'rgba(255,255,255,0.4)' }}>
          <div style={{ padding: '4px 0' }}>
            {participants.map((p, i) => {
              const on = included.has(p.id)
              const pct = totalNum > 0 && on ? ((parseFloat(shares[p.id]) || 0) / totalNum) * 100 : 0
              const isPayer = p.id === paidById
              return (
                <React.Fragment key={p.id}>
                  {i > 0 && <div style={{ height: 1, background: 'var(--pencil-soft)', opacity: 0.4, margin: '0 16px' }} />}
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 14, alignItems: 'center', padding: '12px 16px', opacity: on ? 1 : 0.5 }}>
                    <button type="button" onClick={() => toggleInclude(p.id)} aria-label={`Toggle ${p.displayName}`} style={{ background: 'transparent', border: 0, cursor: 'pointer', width: 28, height: 28, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ScribbleCheckbox checked={on} size={26} seed={400 + i * 7} color="var(--ink)" />
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontFamily: 'var(--font-print), cursive', fontSize: 18, display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                        {p.displayName}
                        {isPayer && <span style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 14, color: 'var(--red)' }}>· fronted</span>}
                      </div>
                      <div className="c-tiny" style={{ fontSize: 12.5 }}>{on ? `${pct.toFixed(1)}% of the bill` : 'not included'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontFamily: 'var(--font-num), monospace', fontSize: 16, color: 'var(--pencil)' }}>{sym}</span>
                      <input
                        value={shares[p.id]}
                        disabled={!on}
                        onChange={(e) => setShares({ ...shares, [p.id]: e.target.value })}
                        inputMode="decimal"
                        placeholder="0.00"
                        style={{ font: '700 20px/1 var(--font-num), monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', textAlign: 'right', width: 82, padding: '2px 0', background: 'transparent', border: 0, outline: 'none' }}
                      />
                    </div>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        </ScribbleBox>

        {/* Live tally */}
        <div style={{ marginTop: 16 }}>
          <ProgressScribble pct={progressPct} exact={exact} over={over} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'baseline' }}>
            <div className="c-tiny">
              shares add up to <Money amount={sumShares} currency={currency} size="sm" />
              <span style={{ color: 'var(--pencil-soft)' }}> of </span>
              <Money amount={totalNum} currency={currency} size="sm" />
            </div>
            <div style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 17, fontWeight: 600 }}>
              {exact ? (
                <span style={{ color: 'var(--green)' }}>✓ balanced</span>
              ) : over ? (
                <span style={{ color: 'var(--red)' }}>over by {sym}{Math.abs(remainder).toFixed(2)}</span>
              ) : (
                <span style={{ color: 'var(--red)' }}>{sym}{remainder.toFixed(2)} left</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative pt-7">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <ScribbleCurvedArrow width={70} height={40} seed={99} color="var(--pencil)" strokeWidth={1.4} dir="down-right" style={{ position: 'absolute', left: -56, top: -28 }} />
          <span className="c-tiny" style={{ fontStyle: 'italic', maxWidth: 280, display: 'block' }}>
            tip: hit <b style={{ fontWeight: 600 }}>✦ split equally</b> and any leftover cents land on whoever fronted it.
          </span>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function PaymentFields({
  participants,
  debtorId,
  setDebtorId,
  creditorId,
  setCreditorId,
  nameOf,
}: {
  participants: Participant[]
  debtorId: string
  setDebtorId: (id: string) => void
  creditorId: string
  setCreditorId: (id: string) => void
  nameOf: (id: string) => string
}) {
  const sameWarning = debtorId && creditorId && debtorId === creditorId
  return (
    <>
      <PickerRow label="who paid" tone="ink" participants={participants} selectedId={debtorId} onSelect={setDebtorId} seedBase={600} />
      <div className="flex items-center gap-3 pt-5 pl-1">
        <ScribbleArrow width={34} height={16} seed={42} color="var(--green)" strokeWidth={1.8} />
        <span style={{ fontFamily: 'var(--font-hand), cursive', fontStyle: 'italic', fontSize: 18, color: 'var(--green)' }}>paid to</span>
      </div>
      <PickerRow label="recipient" tone="green" participants={participants} selectedId={creditorId} onSelect={setCreditorId} seedBase={700} />

      <div className="pt-5">
        {sameWarning ? (
          <p className="c-tiny" style={{ color: 'var(--red)' }}>Pick two different people — a payment evens up between two participants.</p>
        ) : debtorId && creditorId ? (
          <p style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 18, color: 'var(--pencil)' }}>
            records <b style={{ color: 'var(--ink)' }}>{nameOf(debtorId)}</b> paying{' '}
            <b style={{ color: 'var(--ink)' }}>{nameOf(creditorId)}</b> — settling the other way.
          </p>
        ) : null}
      </div>
    </>
  )
}

function PickerRow({
  label,
  tone,
  participants,
  selectedId,
  onSelect,
  seedBase,
}: {
  label: string
  tone: 'ink' | 'green'
  participants: Participant[]
  selectedId: string
  onSelect: (id: string) => void
  seedBase: number
}) {
  const ring = tone === 'green' ? 'var(--green)' : 'var(--red)'
  return (
    <div className="pt-6">
      <div className="c-label" style={{ marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {participants.map((p, i) => {
          const on = selectedId === p.id
          return (
            <button key={p.id} type="button" onClick={() => onSelect(p.id)} style={{ position: 'relative', background: 'transparent', border: 0, cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 4px' }}>
              <span style={{ position: 'relative' }}>
                <ScribbleAvatar name={p.displayName} size={44} seed={seedBase + i * 11} strokeWidth={1.8} />
                {on && (
                  <span style={{ position: 'absolute', inset: -8 }}>
                    <ScribbleCircleFill seed={seedBase + 50 + i * 13} color={ring} strokeWidth={2.4} amp={2.6} />
                  </span>
                )}
              </span>
              <span style={{ fontFamily: 'var(--font-print), cursive', fontSize: 14, color: on ? ring : 'var(--ink)', fontWeight: on ? 600 : 400 }}>{p.displayName}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-1">
      <div className="c-label" style={{ marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

function BigInput({ value, onChange, placeholder, seed }: { value: string; onChange: (v: string) => void; placeholder?: string; seed: number }) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ display: 'block', width: '100%', fontFamily: 'var(--font-hand), cursive', fontWeight: 600, fontSize: 36, lineHeight: 1, color: 'var(--ink)', padding: '8px 0 14px', background: 'transparent', border: 0, outline: 'none' }}
      />
      <span style={{ position: 'absolute', left: 0, right: 0, bottom: 2 }}>
        <ScribbleUnderline seed={seed} color="var(--ink)" strokeWidth={2} amp={1.8} />
      </span>
    </div>
  )
}

function ProgressScribble({ pct, exact, over }: { pct: number; exact: boolean; over: boolean }) {
  const color = exact ? 'var(--green)' : over ? 'var(--red)' : 'var(--ink)'
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(el.offsetWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fillW = w * Math.min(1, pct / 100)
  const lineD = (x1: number, x2: number, rand: () => number) => {
    // a single gently-wobbling horizontal stroke
    const y = 7
    return `M ${x1} ${y} C ${x1 + (x2 - x1) / 3} ${y + (rand() - 0.5) * 2}, ${x1 + ((x2 - x1) * 2) / 3} ${y + (rand() - 0.5) * 2}, ${x2} ${y}`
  }
  const bgD = w ? lineD(2, w - 2, mulberry32(92)) : ''
  const fgD = w && fillW > 4 ? lineD(2, Math.max(4, fillW - 2), mulberry32(91)) : ''
  return (
    <div ref={ref} style={{ position: 'relative', height: 14, width: '100%' }}>
      {w > 0 && (
        <svg width={w} height={14} viewBox={`0 0 ${w} 14`} style={{ overflow: 'visible' }} aria-hidden="true">
          <path d={bgD} fill="none" stroke="var(--pencil-soft)" strokeWidth={3} strokeLinecap="round" />
          {fillW > 4 && <path d={fgD} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />}
        </svg>
      )}
    </div>
  )
}
