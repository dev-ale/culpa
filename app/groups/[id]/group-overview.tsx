'use client'

import Link from 'next/link'

import {
  type BalanceView,
  BalanceRow,
  CulpaLogo,
  type EntryView,
  EntryRow,
  SectionHeading,
} from '@/components/culpa'
import {
  ScribbleArrow,
  ScribbleAvatar,
  ScribbleBox,
  ScribbleButton,
  ScribbleCircleFill,
  ScribbleCurvedArrow,
  ScribblePlus,
  ScribbleUnderline,
  currencySymbol,
} from '@/components/scribble'

type Participant = { id: string; displayName: string }

export function GroupOverview({
  groupId,
  title,
  currency,
  createdLabel,
  participants,
  viewerId,
  balances,
  entries,
}: {
  groupId: string
  title: string
  currency: string
  createdLabel: string
  participants: Participant[]
  viewerId?: string
  balances: BalanceView[]
  entries: EntryView[]
}) {
  // Viewer's net across the table: + means owed to them, − means they owe.
  const net = balances.reduce((n, b) => {
    if (b.toId === viewerId) return n + b.amount
    if (b.fromId === viewerId) return n - b.amount
    return n
  }, 0)
  const sym = currencySymbol(currency)

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-40 pt-4 sm:px-8">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 py-2">
        <Link
          href="/dashboard"
          aria-label="All groups"
          className="inline-flex items-center gap-2"
          style={{ textDecoration: 'none', color: 'var(--ink)' }}
        >
          <ScribbleArrow width={26} height={14} seed={1} color="var(--ink)" strokeWidth={1.8} style={{ transform: 'scaleX(-1)' }} />
          <span className="c-label" style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 18 }}>my groups</span>
        </Link>
        <CulpaLogo size={26} seed={2} />
      </div>

      {/* Masthead */}
      <div className="relative pt-2">
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <h1 className="c-h1 text-[clamp(44px,12vw,80px)]" style={{ margin: 0 }}>
            {title}
          </h1>
          <span style={{ position: 'absolute', left: 0, right: 4, bottom: -8, width: '96%' }}>
            <ScribbleUnderline seed={11} color="var(--red)" strokeWidth={2.8} amp={2.4} />
          </span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {participants.map((p, i) => (
            <ScribbleAvatar key={p.id} name={p.displayName} size={32} seed={50 + i} you={p.id === viewerId} />
          ))}
          <span className="c-label" style={{ marginLeft: 4 }}>
            {participants.length} {participants.length === 1 ? 'person' : 'of us'}
          </span>
          <span className="c-label" style={{ color: 'var(--pencil-soft)' }}>·</span>
          <span className="c-label">{currency}</span>
        </div>
      </div>

      {/* Two-column on large screens: spending on the left, balances pinned right. */}
      <div className="mt-7 grid grid-cols-1 gap-10 lg:grid-cols-[1.5fr_1fr]">
        {/* LEFT — net statement + the spending */}
        <div className="order-2 lg:order-1">
          <NetStatement net={net} sym={sym} />

          {/* Actions (inline on desktop; a floating bar handles mobile below) */}
          <div className="mt-7 hidden gap-3 lg:flex">
            <ScribbleButton variant="ink" seed={21} asChild>
              <Link href={`/groups/${groupId}/entries/new?kind=expense`}>
                <ScribblePlus color="var(--paper)" size={14} seed={22} /> add expense
              </Link>
            </ScribbleButton>
            <ScribbleButton variant="ghost" seed={23} asChild>
              <Link href={`/groups/${groupId}/entries/new?kind=payment`}>add payment</Link>
            </ScribbleButton>
          </div>

          <div className="mt-8">
            <SectionHeading
              title="the spending"
              meta={entries.length > 0 ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : undefined}
              seed={30}
            />
            {entries.length === 0 ? (
              <EmptyNote
                seed={31}
                lines={['No entries yet.', 'Add an expense and the ledger starts writing itself.']}
              />
            ) : (
              <div className="flex flex-col gap-1">
                {entries.map((e, i) => (
                  <EntryRow key={e.id} entry={e} currency={currency} seed={100 + i} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — group memo + who owes who */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <ScribbleBox
            seed={50}
            strokeWidth={1.8}
            amp={1.8}
            color="var(--ink)"
            double
            padding="20px 22px"
            style={{ background: 'rgba(255,255,255,0.5)', marginBottom: 28 }}
          >
            <div className="c-label" style={{ marginBottom: 4 }}>the group</div>
            <div style={{ fontFamily: 'var(--font-hand), cursive', fontWeight: 600, fontSize: 26, lineHeight: 1.05, maxWidth: 260 }}>
              {participants.length} {participants.length === 1 ? 'person' : 'people'}, {entries.length}{' '}
              {entries.length === 1 ? 'entry' : 'entries'}.
            </div>
            <div className="c-tiny" style={{ marginTop: 12 }}>created {createdLabel} · share link active</div>
          </ScribbleBox>

          <SectionHeading
            title="who owes who"
            meta={balances.length > 0 ? `${balances.length} open` : undefined}
            seed={60}
          />
          {balances.length === 0 ? (
            <EmptyNote seed={61} lines={["Nothing's owed yet —", "you're all square."]} />
          ) : (
            <>
              <div className="flex flex-col gap-0.5 pl-6">
                {balances.map((b, i) => (
                  <BalanceRow key={`${b.fromId}-${b.toId}`} balance={b} currency={currency} viewerId={viewerId} seed={200 + i * 17} />
                ))}
              </div>
              <div className="c-tiny mt-2 pl-6">★ = you</div>
            </>
          )}

          <div className="relative mt-6">
            <ScribbleCurvedArrow width={110} height={64} seed={71} color="var(--pencil)" strokeWidth={1.4} dir="down-left" style={{ position: 'absolute', left: -6, top: -34 }} />
            <p className="c-tiny" style={{ lineHeight: 1.55, maxWidth: 320, paddingLeft: 100 }}>
              balances are derived, never stored — record a payment going the other way to settle up.
            </p>
          </div>
        </div>
      </div>

      {/* Floating action bar — mobile only */}
      <div className="fixed inset-x-0 bottom-0 z-10 lg:hidden" style={{ background: 'linear-gradient(180deg, transparent 0%, var(--paper) 32%)', padding: '24px 16px 22px' }}>
        <div className="mx-auto flex w-full max-w-5xl gap-3">
          <ScribbleButton variant="ink" seed={91} style={{ flex: 1.2 }} asChild>
            <Link href={`/groups/${groupId}/entries/new?kind=expense`}>
              <ScribblePlus color="var(--paper)" size={14} seed={92} /> add expense
            </Link>
          </ScribbleButton>
          <ScribbleButton variant="ghost" seed={93} style={{ flex: 1 }} asChild>
            <Link href={`/groups/${groupId}/entries/new?kind=payment`}>add payment</Link>
          </ScribbleButton>
        </div>
      </div>
    </div>
  )
}

function NetStatement({ net, sym }: { net: number; sym: string }) {
  const square = Math.abs(net) < 0.005
  return (
    <ScribbleBox seed={11} strokeWidth={2} color="var(--ink)" amp={1.8} double padding="18px 20px" style={{ background: 'rgba(255,255,255,0.5)' }}>
      <div className="c-label" style={{ marginBottom: 6 }}>where you stand →</div>
      {square ? (
        <div style={{ fontFamily: 'var(--font-hand), cursive', fontWeight: 600, fontSize: 30 }}>
          you&apos;re <span style={{ fontStyle: 'italic' }}>square</span> with everyone.
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--font-hand), cursive', fontWeight: 600, fontSize: 30, lineHeight: 1.1 }}>
          {net < 0 ? 'you owe ' : "you're owed "}
          <span style={{ position: 'relative', color: net < 0 ? 'var(--red)' : 'var(--green)', display: 'inline-block' }}>
            <span style={{ position: 'absolute', inset: '-6px -10px' }}>
              <ScribbleCircleFill seed={13} color={net < 0 ? 'var(--red)' : 'var(--green)'} strokeWidth={2.2} amp={2.4} />
            </span>
            {sym}
            {Math.abs(net).toFixed(2)}
          </span>{' '}
          across the table.
        </div>
      )}
    </ScribbleBox>
  )
}

function EmptyNote({ lines, seed }: { lines: string[]; seed: number }) {
  return (
    <div className="py-3 pl-6">
      <div style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 22, color: 'var(--pencil)', lineHeight: 1.15 }}>
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <span style={{ display: 'inline-block', marginTop: 6, width: 90 }}>
        <ScribbleUnderline seed={seed} color="var(--pencil-soft)" strokeWidth={1.4} amp={1.2} />
      </span>
    </div>
  )
}
