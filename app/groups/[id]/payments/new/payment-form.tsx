'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { createPayment, type CreatePaymentState } from '../actions'

const initialState: CreatePaymentState = { status: 'idle' }

type Participant = { id: string; displayName: string }

const selectClass =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50'

export function PaymentForm({
  groupId,
  currency,
  participants,
}: {
  groupId: string
  currency: string
  participants: Participant[]
}) {
  const [state, formAction, pending] = useActionState(
    createPayment,
    initialState,
  )
  const fieldErrors = state.fieldErrors ?? {}

  // Default payer/recipient to the first two Participants so they start
  // distinct; the server rejects equal ones regardless.
  const [paidBy, setPaidBy] = useState(participants[0]?.id ?? '')
  const [recipientId, setRecipientId] = useState(
    participants[1]?.id ?? participants[0]?.id ?? '',
  )

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="groupId" value={groupId} />

      <div className="space-y-2">
        <Label htmlFor="paidBy">Who paid</Label>
        <select
          id="paidBy"
          name="paidBy"
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          disabled={pending}
          aria-invalid={fieldErrors.paidBy ? true : undefined}
          className={selectClass}
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.paidBy} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipientId">Paid to</Label>
        <select
          id="recipientId"
          name="recipientId"
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          disabled={pending}
          aria-invalid={fieldErrors.recipient ? true : undefined}
          className={selectClass}
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.recipient} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <div className="flex items-center gap-2">
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="10.00"
            required
            disabled={pending}
            aria-invalid={fieldErrors.amount ? true : undefined}
            className="max-w-40"
          />
          <span className="text-muted-foreground text-sm">{currency}</span>
        </div>
        <FieldError message={fieldErrors.amount} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">
          Note <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="title"
          name="title"
          placeholder="Settling up"
          maxLength={120}
          disabled={pending}
        />
      </div>

      {state.status === 'error' && state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Recording…' : 'Record payment'}
      </Button>
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
