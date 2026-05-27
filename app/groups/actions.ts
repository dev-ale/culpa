'use server'

import { randomBytes } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { CURRENCY_CODES } from '@/lib/currencies'
import { createGroupWithParticipants } from '@/lib/db/queries'
import { createClient } from '@/lib/supabase/server'

const createGroupSchema = z.object({
  title: z.string().trim().min(1, 'Enter a group title.').max(120),
  currency: z.enum(CURRENCY_CODES),
  creatorName: z.string().trim().min(1, 'Enter your name.').max(80),
  participantNames: z
    .array(z.string().trim().min(1).max(80))
    .min(1, 'Add at least one other participant.')
    .max(50, 'That is too many participants.'),
})

export type CreateGroupFieldErrors = {
  title?: string
  currency?: string
  creatorName?: string
  participants?: string
}

export type CreateGroupState = {
  status: 'idle' | 'error'
  error?: string
  fieldErrors?: CreateGroupFieldErrors
}

// Maps `participantNames` issues onto the single `participants` field the form renders.
const FIELD_KEYS: Record<string, keyof CreateGroupFieldErrors> = {
  title: 'title',
  currency: 'currency',
  creatorName: 'creatorName',
  participantNames: 'participants',
}

export async function createGroup(
  _prevState: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Drop blank participant rows before validating the count.
  const participantNames = formData
    .getAll('participant')
    .map((v) => String(v).trim())
    .filter(Boolean)

  const parsed = createGroupSchema.safeParse({
    title: formData.get('title'),
    currency: formData.get('currency'),
    creatorName: formData.get('creatorName'),
    participantNames,
  })

  if (!parsed.success) {
    const fieldErrors: CreateGroupFieldErrors = {}
    for (const issue of parsed.error.issues) {
      const key = FIELD_KEYS[String(issue.path[0])]
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { status: 'error', error: 'Check the highlighted fields.', fieldErrors }
  }

  const { title, currency, creatorName, participantNames: others } = parsed.data

  let group
  try {
    group = await createGroupWithParticipants({
      creatorId: user.id,
      title,
      currency,
      // Unguessable, URL-safe token. Its read path lands in a later slice.
      shareToken: randomBytes(24).toString('base64url'),
      // The Creator is always a Participant in their own Group, listed first.
      participantNames: [creatorName, ...others],
    })
  } catch {
    return {
      status: 'error',
      error: 'Could not create the group. Please try again.',
    }
  }

  revalidatePath('/dashboard')
  redirect(`/groups/${group.id}`)
}
