import { redirect } from 'next/navigation'

import { CulpaLogo } from '@/components/culpa'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

import { SignInForm } from './sign-in-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    redirect('/dashboard')
  }

  const { error } = await searchParams

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-7 px-4 py-16">
      <div className="text-center">
        <CulpaLogo size={44} seed={3} />
        <p className="c-tiny mt-3">a kept ledger for who owes who.</p>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">sign in</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a magic link to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm initialError={error} />
        </CardContent>
      </Card>
    </main>
  )
}
