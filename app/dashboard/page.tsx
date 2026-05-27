import { Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { currencyLabel } from '@/lib/currencies'
import { listGroupsForCreator } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'

import { signOut } from './actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // The proxy already gates this route; this guard keeps the page correct on its
  // own and narrows `user` for the render below.
  if (!user) {
    redirect('/login')
  }

  const groups = await listGroupsForCreator(user.id)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your groups</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {user.email}
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </header>

      {groups.length === 0 ? (
        <section className="mt-10 flex flex-1 items-center justify-center">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              <Users className="size-6" />
            </div>
            <h2 className="text-lg font-medium">No groups yet</h2>
            <p className="text-muted-foreground text-sm">
              Create a group to start tracking who owes whom. You&apos;ll be able
              to add participants and record expenses.
            </p>
            <Button asChild className="mt-1">
              <Link href="/groups/new">
                <Plus />
                New group
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        <section className="mt-8 space-y-4">
          <div className="flex justify-end">
            <Button asChild>
              <Link href="/groups/new">
                <Plus />
                New group
              </Link>
            </Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <li key={group.id}>
                <Link href={`/groups/${group.id}`} className="block">
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardContent>
                      <h2 className="font-medium">{group.title}</h2>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {currencyLabel(group.currency)}
                      </p>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {group.participantCount}{' '}
                        {group.participantCount === 1
                          ? 'participant'
                          : 'participants'}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
