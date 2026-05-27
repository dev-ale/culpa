import { Users } from 'lucide-react'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
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
        </div>
      </section>
    </div>
  )
}
