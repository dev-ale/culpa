'use client'

import { useActionState, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCents, parseAmountToCents } from '@/lib/money'
import { splitEqually } from '@/lib/split'
import { cn } from '@/lib/utils'

import { editExpense, type EditExpenseState } from '../../actions'

type Participant = { id: string; displayName: string }

type ShareRow = Participant & { included: boolean; amount: string }

export function EditExpenseForm({
  entryId,
  groupId,
  currency,
  participants,
  initialTitle,
  initialTotal,
  initialPaidBy,
  initialShares,
}: {
  entryId: string
  groupId: string
  currency: string
  participants: Participant[]
  initialTitle: string
  initialTotal: number
  initialPaidBy: string
  initialShares: { participantId: string; amount: number }[]
}) {
  const [state, formAction, pending] = useActionState(
    editExpense.bind(null, entryId),
    { status: 'idle' } as EditExpenseState,
  )
  const fieldErrors = state.fieldErrors ?? {}

  // Convert back to display format
  const [total, setTotal] = useState(formatCents(initialTotal))
  const [paidBy, setPaidBy] = useState(initialPaidBy)

  // Create initial share rows from the initial shares
  const initialSharesMap = new Map(
    initialShares.map((s) => [s.participantId, s.amount]),
  )

  const [rows, setRows] = useState<ShareRow[]>(() =>
    participants.map((p) => ({
      ...p,
      included: initialSharesMap.has(p.id),
      amount: initialSharesMap.has(p.id)
        ? formatCents(initialSharesMap.get(p.id)!)
        : '',
    })),
  )

  function setRow(id: string, patch: Partial<ShareRow>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )
  }

  function splitEqual() {
    const totalCents = parseAmountToCents(total)
    const includedIds = rows.filter((r) => r.included).map((r) => r.id)
    if (totalCents === null || includedIds.length === 0) return

    const amounts = splitEqually(totalCents, includedIds, paidBy)
    setRows((prev) =>
      prev.map((r) =>
        r.included && amounts[r.id] !== undefined
          ? { ...r, amount: formatCents(amounts[r.id]) }
          : r,
      ),
    )
  }

  const { sumCents, totalCents, matches } = useMemo(() => {
    const totalCents = parseAmountToCents(total)
    let sumCents = 0
    let valid = true
    for (const r of rows) {
      if (!r.included) continue
      const cents = parseAmountToCents(r.amount)
      if (cents === null) {
        valid = false
        continue
      }
      sumCents += cents
    }
    return {
      sumCents,
      totalCents,
      matches: valid && totalCents !== null && sumCents === totalCents,
    }
  }, [rows, total])

  const includedCount = rows.filter((r) => r.included).length

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="groupId" value={groupId} />

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          placeholder="Dinner"
          defaultValue={initialTitle}
          required
          maxLength={120}
          disabled={pending}
          aria-invalid={fieldErrors.title ? true : undefined}
        />
        <FieldError message={fieldErrors.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="total">Total</Label>
        <div className="flex items-center gap-2">
          <Input
            id="total"
            name="total"
            inputMode="decimal"
            placeholder="90.00"
            required
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            disabled={pending}
            aria-invalid={fieldErrors.total ? true : undefined}
            className="max-w-40"
          />
          <span className="text-muted-foreground text-sm">{currency}</span>
        </div>
        <FieldError message={fieldErrors.total} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="paidBy">Fronted by</Label>
        <select
          id="paidBy"
          name="paidBy"
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          disabled={pending}
          aria-invalid={fieldErrors.paidBy ? true : undefined}
          className={cn(
            'border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.paidBy} />
      </div>

      <fieldset className="space-y-3" disabled={pending}>
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">Shares</legend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={splitEqual}
          >
            Split equally
          </Button>
        </div>

        <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 px-3 py-2.5 text-sm"
            >
              <input
                type="checkbox"
                aria-label={`Include ${row.displayName}`}
                checked={row.included}
                onChange={(e) => setRow(row.id, { included: e.target.checked })}
                className="size-4"
              />
              {row.included ? (
                <>
                  <input type="hidden" name="shareParticipantId" value={row.id} />
                  <input type="hidden" name="shareAmount" value={row.amount} />
                </>
              ) : null}
              <span
                className={cn(
                  'flex-1',
                  !row.included && 'text-muted-foreground line-through',
                )}
              >
                {row.displayName}
              </span>
              <Input
                aria-label={`${row.displayName} share`}
                inputMode="decimal"
                placeholder="0.00"
                value={row.amount}
                disabled={!row.included}
                onChange={(e) => setRow(row.id, { amount: e.target.value })}
                className="max-w-28 text-right"
              />
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {includedCount} {includedCount === 1 ? 'share' : 'shares'}
          </span>
          <span
            className={cn(
              matches ? 'text-muted-foreground' : 'text-destructive',
            )}
          >
            {formatCents(sumCents)}
            {totalCents !== null ? ` / ${formatCents(totalCents)}` : ''}{' '}
            {currency}
          </span>
        </div>
        <FieldError message={fieldErrors.shares} />
      </fieldset>

      {state.status === 'error' && state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={() => window.history.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="text-destructive text-sm" role="alert">
      {message}
    </p>
  )
}
