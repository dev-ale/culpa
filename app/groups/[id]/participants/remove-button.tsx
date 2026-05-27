'use client'

import { useActionState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { type RemoveParticipantState, removeParticipant } from '@/app/groups/actions'

export function RemoveParticipantButton({
  groupId,
  participantId,
}: {
  groupId: string
  participantId: string
}) {
  const [state, formAction, isPending] = useActionState(
    (prevState: RemoveParticipantState) =>
      removeParticipant(groupId, participantId, prevState),
    { status: 'idle' as const },
  )

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          disabled={isPending}
          title="Remove participant"
        >
          <X className="size-4" />
        </Button>
      </form>
      {state.status === 'error' && state.error && (
        <p className="text-destructive text-xs">{state.error}</p>
      )}
    </div>
  )
}
