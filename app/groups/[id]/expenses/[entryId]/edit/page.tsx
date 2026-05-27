import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { currencyLabel } from '@/lib/currencies'
import {
  getEntryWithSharesForCreator,
  getGroupForCreator,
} from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'
import { EditExpenseForm } from './edit-expense-form'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>
}) {
  const { id: groupId, entryId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  if (!UUID_RE.test(groupId) || !UUID_RE.test(entryId)) {
    notFound()
  }

  const group = await getGroupForCreator(groupId, user.id)
  if (!group) {
    notFound()
  }

  const entryData = await getEntryWithSharesForCreator(entryId, user.id)
  if (!entryData) {
    notFound()
  }

  const { entry, shares } = entryData

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href={`/groups/${groupId}`}>
          <ArrowLeft />
          Back to group
        </Link>
      </Button>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Edit expense</h1>
        <p className="text-muted-foreground text-sm">
          {currencyLabel(group.group.currency)}
        </p>
      </header>

      <div className="mt-8 max-w-md">
        <EditExpenseForm
          entryId={entry.id}
          groupId={groupId}
          currency={group.group.currency}
          participants={group.participants}
          initialTitle={entry.title}
          initialTotal={entry.totalAmount}
          initialPaidBy={entry.paidBy}
          initialShares={shares}
        />
      </div>
    </div>
  )
}
