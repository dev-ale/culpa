'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { signIn, type SignInState } from './actions'

const initialState: SignInState = { status: 'idle' }

export function SignInForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState)

  if (state.status === 'sent') {
    return (
      <div className="space-y-2 text-sm" role="status" aria-live="polite">
        <p className="font-medium">Check your email</p>
        <p className="text-muted-foreground">
          We sent a magic link to{' '}
          <span className="text-foreground font-medium">{state.email}</span>.
          Open it on this device to sign in.
        </p>
      </div>
    )
  }

  const errorMessage =
    state.status === 'error' ? state.message : resolveError(initialError)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          defaultValue={state.email}
          aria-invalid={state.status === 'error' || undefined}
          disabled={pending}
        />
      </div>
      {errorMessage ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send magic link'}
      </Button>
    </form>
  )
}

function resolveError(code?: string) {
  if (code === 'auth-link-invalid') {
    return 'That magic link is invalid or has expired. Request a new one.'
  }
  return undefined
}
