import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { currencyLabel } from '@/lib/currencies'
import { getGroupForCreator } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'

import { PaymentForm } from './payment-form'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function NewPaymentPage({
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

  if (!UUID_RE.test(id)) {
    notFound()
  }

  const data = await getGroupForCreator(id, user.id)
  if (!data) {
    notFound()
  }

  const { group, participants } = data

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href={`/groups/${group.id}`}>
          <ArrowLeft />
          {group.title}
        </Link>
      </Button>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Record a payment
        </h1>
        <p className="text-muted-foreground text-sm">
          One person settling up with another, in {currencyLabel(group.currency)}
        </p>
      </header>

      <div className="mt-8">
        {participants.length < 2 ? (
          <p className="text-muted-foreground rounded-lg ring-1 ring-foreground/10 px-4 py-6 text-center text-sm">
            A payment goes from one participant to another — this group needs at
            least two.
          </p>
        ) : (
          <PaymentForm
            groupId={group.id}
            currency={group.currency}
            participants={participants.map((p) => ({
              id: p.id,
              displayName: p.displayName,
            }))}
          />
        )}
      </div>
    </div>
  )
}
