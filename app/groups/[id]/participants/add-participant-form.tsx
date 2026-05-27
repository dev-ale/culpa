'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type AddParticipantState, addParticipant } from '@/app/groups/actions'

export function AddParticipantForm({ groupId }: { groupId: string }) {
  const [state, formAction, isPending] = useActionState(
    (prevState: AddParticipantState, formData: FormData) =>
      addParticipant(groupId, prevState, formData),
    { status: 'idle' as const },
  )

  return (
    <form action={formAction} className="space-y-3">
      <Input
        name="displayName"
        placeholder="Enter participant name"
        disabled={isPending}
        autoFocus
      />
      {state.status === 'error' && state.error && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Adding...' : 'Add Participant'}
      </Button>
    </form>
  )
}
