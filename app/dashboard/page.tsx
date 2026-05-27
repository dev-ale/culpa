import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CulpaLogo } from '@/components/culpa'
import { ScribbleBox, ScribbleButton, ScribblePlus } from '@/components/scribble'
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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <CulpaLogo size={30} seed={1} />
          <h1 className="c-h1 mt-3 text-[clamp(40px,9vw,56px)]">your groups</h1>
          <p className="c-tiny mt-1">signed in as {user.email}</p>
        </div>
        <form action={signOut}>
          <ScribbleButton type="submit" variant="ghost" seed={7} fontSize={15} padding="8px 16px">
            sign out
          </ScribbleButton>
        </form>
      </header>

      {groups.length === 0 ? (
        <section className="mt-12 flex flex-1 items-center justify-center">
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <div style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 30, fontWeight: 600 }}>nothing on the table yet.</div>
            <p className="c-tiny" style={{ lineHeight: 1.55 }}>
              Start a group to track who fronted what. Add the people splitting costs, then jot down the spending.
            </p>
            <ScribbleButton variant="ink" seed={8} asChild>
              <Link href="/groups/new">
                <ScribblePlus color="var(--paper)" size={14} seed={9} /> new group
              </Link>
            </ScribbleButton>
          </div>
        </section>
      ) : (
        <section className="mt-8">
          <div className="flex justify-end">
            <ScribbleButton variant="ink" seed={8} asChild>
              <Link href="/groups/new">
                <ScribblePlus color="var(--paper)" size={14} seed={9} /> new group
              </Link>
            </ScribbleButton>
          </div>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {groups.map((group, i) => (
              <li key={group.id}>
                <Link href={`/groups/${group.id}`} className="block" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                  <ScribbleBox seed={20 + i * 3} strokeWidth={1.6} amp={1.5} color="var(--ink)" padding="16px 18px" style={{ background: 'rgba(255,255,255,0.45)' }}>
                    <div style={{ fontFamily: 'var(--font-hand), cursive', fontSize: 28, fontWeight: 600, lineHeight: 1.05 }}>{group.title}</div>
                    <div className="c-tiny mt-1">{currencyLabel(group.currency)}</div>
                    <div className="c-tiny mt-3">
                      {group.participantCount} {group.participantCount === 1 ? 'person' : 'people'}
                    </div>
                  </ScribbleBox>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
