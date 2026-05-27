import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { currencyLabel } from '@/lib/currencies'
import { getGroupForCreator } from '@/lib/db/queries'
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
