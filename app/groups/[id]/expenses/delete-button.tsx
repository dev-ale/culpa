'use client'

import { Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { deleteExpense } from './actions'

interface DeleteEntryButtonProps {
  entryId: string
  onDeleted?: () => void
}

export function DeleteEntryButton({ entryId, onDeleted }: DeleteEntryButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteExpense(entryId)
      if (!result.success) {
        setError(result.error || 'Failed to delete')
      } else {
        onDeleted?.()
      }
    })
  }

  if (showConfirm) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Delete this entry? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1"
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowConfirm(false)}
            disabled={isPending}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setShowConfirm(true)}
      disabled={isPending}
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="size-4" />
    </Button>
  )
}
