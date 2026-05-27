import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// Handles magic-link emails whose template points at /auth/confirm?token_hash=…&type=…
// (the @supabase/ssr-recommended pattern; works across devices since there is no
// PKCE code verifier to match).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(
    new URL('/login?error=auth-link-invalid', request.url),
  )
}

// Only allow same-origin relative paths as the post-login destination.
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//')
    ? next
    : '/dashboard'
}
