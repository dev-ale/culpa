import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { currencyLabel } from '@/lib/currencies'
import {
  type EntryListItem,
  getGroupForCreator,
  listEntriesForGroup,
} from '@/lib/db/queries'
import { formatMoney } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // A malformed id would throw on the uuid comparison; treat it as not found.
  if (!UUID_RE.test(id)) {
    notFound()
  }

  const data = await getGroupForCreator(id, user.id)
  if (!data) {
    notFound()
  }

  const { group, participants } = data
  const entries = await listEntriesForGroup(group.id)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/dashboard">
          <ArrowLeft />
          All groups
        </Link>
      </Button>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">{group.title}</h1>
        <p className="text-muted-foreground text-sm">
          {currencyLabel(group.currency)}
        </p>
      </header>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Entries ({entries.length})</h2>
          <Button asChild size="sm">
            <Link href={`/groups/${group.id}/expenses/new`}>
              <Plus />
              Record expense
            </Link>
          </Button>
        </div>

        {entries.length === 0 ? (
          <p className="text-muted-foreground mt-3 rounded-lg ring-1 ring-foreground/10 px-4 py-6 text-center text-sm">
            No entries yet. Record an expense to start tracking who owes whom.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                currency={group.currency}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium">
          Participants ({participants.length})
        </h2>
        <ul className="mt-3 divide-y rounded-lg ring-1 ring-foreground/10">
          {participants.map((p) => (
            <li key={p.id} className="px-4 py-3 text-sm">
              {p.displayName}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function EntryCard({
  entry,
  currency,
}: {
  entry: EntryListItem
  currency: string
}) {
  return (
    <li className="rounded-lg ring-1 ring-foreground/10">
      <div className="flex items-baseline justify-between gap-3 px-4 py-3">
        <div>
          <p className="font-medium">{entry.title}</p>
          <p className="text-muted-foreground text-xs">
            Fronted by {entry.payerName}
          </p>
        </div>
        <p className="font-medium tabular-nums">
          {formatMoney(entry.totalAmount, currency)}
        </p>
      </div>
      <ul className="divide-y border-t text-sm">
        {entry.shares.map((share) => (
          <li
            key={share.participantId}
            className="flex items-center justify-between gap-3 px-4 py-2"
          >
            <span>{share.displayName}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatMoney(share.amount, currency)}
              <span className="ml-2 text-xs">
                ({Math.round((share.amount / entry.totalAmount) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </li>
  )
}
