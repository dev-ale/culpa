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

export type AddParticipantState = {
  status: 'idle' | 'error'
  error?: string
}

export async function addParticipant(
  groupId: string,
  _prevState: AddParticipantState,
  formData: FormData,
): Promise<AddParticipantState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const displayName = String(formData.get('displayName')).trim()

  if (!displayName) {
    return { status: 'error', error: 'Enter a participant name.' }
  }

  if (displayName.length > 80) {
    return { status: 'error', error: 'Name is too long.' }
  }

  try {
    const { db } = await import('@/lib/db')
    const { groups, participants } = await import('@/lib/db/schema')
    const { and, eq } = await import('drizzle-orm')

    // Verify ownership
    const [group] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.creatorId, user.id)))
      .limit(1)

    if (!group) {
      return { status: 'error', error: 'Group not found.' }
    }

    await db.insert(participants).values({
      groupId,
      displayName,
    })
  } catch {
    return {
      status: 'error',
      error: 'Could not add participant. Please try again.',
    }
  }

  revalidatePath(`/groups/${groupId}`)
  return { status: 'idle' }
}

export type RemoveParticipantState = {
  status: 'idle' | 'error'
  error?: string
}

export async function removeParticipant(
  groupId: string,
  participantId: string,
  _prevState: RemoveParticipantState,
): Promise<RemoveParticipantState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  try {
    const { db } = await import('@/lib/db')
    const { groups, participants, entries, shares } = await import(
      '@/lib/db/schema'
    )
    const { and, eq, desc, inArray, isNull } = await import('drizzle-orm')
    const { alias } = await import('drizzle-orm/pg-core')
    const { computePairwiseBalances } = await import('@/lib/balances')

    // Verify ownership
    const [group] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.creatorId, user.id)))
      .limit(1)

    if (!group) {
      return { status: 'error', error: 'Group not found.' }
    }

    // Verify participant exists and belongs to this group
    const [participant] = await db
      .select()
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.groupId, groupId)))
      .limit(1)

    if (!participant) {
      return { status: 'error', error: 'Participant not found.' }
    }

    // Get all entries for this group to compute balances
    const entryRows = await db
      .select({
        id: entries.id,
        paidBy: entries.paidBy,
      })
      .from(entries)
      .where(eq(entries.groupId, groupId))

    const shareRows =
      entryRows.length > 0
        ? await db
            .select({
              entryId: shares.entryId,
              participantId: shares.participantId,
              amount: shares.amount,
            })
            .from(shares)
            .where(
              inArray(
                shares.entryId,
                entryRows.map((r) => r.id),
              ),
            )
        : []

    // Compute all pairwise balances
    const balances = computePairwiseBalances(entryRows, shareRows)

    // Check if this participant has any non-zero balances
    const hasNonZeroBalance = balances.some(
      (b) => b.from === participantId || b.to === participantId,
    )

    if (hasNonZeroBalance) {
      return {
        status: 'error',
        error:
          'This participant has outstanding balances. Settle all debts before removing.',
      }
    }

    // Safe to remove: set removed_at
    await db
      .update(participants)
      .set({ removedAt: new Date() })
      .where(eq(participants.id, participantId))
  } catch {
    return {
      status: 'error',
      error: 'Could not remove participant. Please try again.',
    }
  }

  revalidatePath(`/groups/${groupId}`)
  return { status: 'idle' }
}
