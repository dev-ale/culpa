'use client'

import { Plus, X } from 'lucide-react'
import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CURRENCIES } from '@/lib/currencies'
import { cn } from '@/lib/utils'

import { createGroup, type CreateGroupState } from '../actions'

const initialState: CreateGroupState = { status: 'idle' }

let rowSeq = 0
const newRow = () => ({ key: `p${rowSeq++}`, value: '' })

export function CreateGroupForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState(createGroup, initialState)
  const [rows, setRows] = useState(() => [newRow()])
  const fieldErrors = state.fieldErrors ?? {}

  function updateRow(key: string, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)))
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Group title</Label>
        <Input
          id="title"
          name="title"
          placeholder="Trip to Lisbon"
          required
          maxLength={120}
          disabled={pending}
          aria-invalid={fieldErrors.title ? true : undefined}
        />
        <FieldError message={fieldErrors.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency">Currency</Label>
        <select
          id="currency"
          name="currency"
          defaultValue="EUR"
          disabled={pending}
          aria-invalid={fieldErrors.currency ? true : undefined}
          className={cn(
            'border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Fixed once the group is created.
        </p>
        <FieldError message={fieldErrors.currency} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="creatorName">Your name</Label>
        <Input
          id="creatorName"
          name="creatorName"
          defaultValue={defaultName}
          placeholder="You"
          required
          maxLength={80}
          disabled={pending}
          aria-invalid={fieldErrors.creatorName ? true : undefined}
        />
        <p className="text-muted-foreground text-xs">
          You&apos;re added to the group as a participant.
        </p>
        <FieldError message={fieldErrors.creatorName} />
      </div>

      <fieldset className="space-y-2" disabled={pending}>
        <legend className="text-sm font-medium">Other participants</legend>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.key} className="flex items-center gap-2">
              <Input
                name="participant"
                aria-label={`Participant ${i + 1}`}
                placeholder="Name"
                maxLength={80}
                value={row.value}
                onChange={(e) => updateRow(row.key, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove participant ${i + 1}`}
                disabled={rows.length === 1}
                onClick={() =>
                  setRows((prev) => prev.filter((r) => r.key !== row.key))
                }
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((prev) => [...prev, newRow()])}
        >
          <Plus />
          Add participant
        </Button>
        <FieldError message={fieldErrors.participants} />
      </fieldset>

      {state.status === 'error' && state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Create group'}
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
