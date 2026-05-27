import { type NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// Handles magic-link emails that use the default ConfirmationURL template: under
// the PKCE flow the Supabase verify endpoint redirects here with a ?code=… that we
// exchange for a session. Complements /auth/confirm (token_hash) so auth completes
// regardless of how the email template is configured.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
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
