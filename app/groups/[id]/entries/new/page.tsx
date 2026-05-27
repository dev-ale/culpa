import { notFound, redirect } from 'next/navigation'

import { getGroupForCreator } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'

import { EntryForm } from './entry-form'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function NewEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ kind?: string }>
}) {
  const { id } = await params
  const { kind } = await searchParams

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
    <EntryForm
      groupId={group.id}
      currency={group.currency}
      initialKind={kind === 'payment' ? 'payment' : 'expense'}
      participants={participants.map((p) => ({
        id: p.id,
        displayName: p.displayName,
      }))}
    />
  )
}
