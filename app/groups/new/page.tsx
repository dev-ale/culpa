import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CulpaLogo } from '@/components/culpa'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

import { CreateGroupForm } from './create-group-form'

export default async function NewGroupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Sensible default for the Creator's own Participant name.
  const defaultName = user.email?.split('@')[0] ?? ''

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/dashboard">
          <ArrowLeft />
          Back
        </Link>
      </Button>

      <div className="mt-4">
        <CulpaLogo size={26} seed={5} />
      </div>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="text-2xl">new group</CardTitle>
          <CardDescription>
            Pick a currency and add the people splitting costs. You can add more
            participants later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateGroupForm defaultName={defaultName} />
        </CardContent>
      </Card>
    </main>
  )
}
