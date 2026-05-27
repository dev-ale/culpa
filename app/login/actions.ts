'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const signInSchema = z.object({
  email: z.string().trim().email(),
})

export type SignInState = {
  status: 'idle' | 'sent' | 'error'
  email?: string
  message?: string
}

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { status: 'error', message: 'Enter a valid email address.' }
  }
  const { email } = parsed.data

  const origin = (await headers()).get('origin')
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Default email template path; /auth/confirm covers the token_hash template.
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
    },
  })

  if (error) {
    return {
      status: 'error',
      email,
      message: 'Could not send a magic link. Please try again.',
    }
  }

  return { status: 'sent', email }
}
