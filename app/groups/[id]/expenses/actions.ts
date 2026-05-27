'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createExpenseEntry, getGroupForCreator } from '@/lib/db/queries'
import { parseAmountToCents } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'

const expenseSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(120),
  totalCents: z
    .number()
    .int()
    .positive('Enter a total greater than zero.'),
  paidBy: z.string().uuid(),
  shares: z
    .array(
      z.object({
        participantId: z.string().uuid(),
        amount: z.number().int().positive(),
      }),
    )
    .min(1, 'Add at least one share.'),
})

export type CreateExpenseFieldErrors = {
  title?: string
  total?: string
  paidBy?: string
  shares?: string
}

export type CreateExpenseState = {
  status: 'idle' | 'error'
  error?: string
  fieldErrors?: CreateExpenseFieldErrors
}

const FIELD_KEYS: Record<string, keyof CreateExpenseFieldErrors> = {
  title: 'title',
  totalCents: 'total',
  paidBy: 'paidBy',
  shares: 'shares',
}

export async function createExpense(
  _prevState: CreateExpenseState,
  formData: FormData,
): Promise<CreateExpenseState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const groupId = String(formData.get('groupId') ?? '')

  // Ownership + the authoritative Participant set come from the database, never
  // from the request — so a crafted form can't reference another Group or
  // smuggle in a Participant that isn't in this one.
  const group = await getGroupForCreator(groupId, user.id)
  if (!group) {
    redirect('/dashboard')
  }
  const validParticipantIds = new Set(group.participants.map((p) => p.id))

  // Share rows arrive as parallel arrays (one entry per selected Participant).
  const shareParticipantIds = formData
    .getAll('shareParticipantId')
    .map(String)
  const shareAmountInputs = formData.getAll('shareAmount').map(String)

  const fieldErrors: CreateExpenseFieldErrors = {}

  const totalCents = parseAmountToCents(String(formData.get('total') ?? ''))
  if (totalCents === null) {
    fieldErrors.total = 'Enter a valid amount, e.g. 90.00.'
  }

  const parsedShares: { participantId: string; amount: number }[] = []
  let badShareAmount = false
  for (let i = 0; i < shareParticipantIds.length; i++) {
    const amount = parseAmountToCents(shareAmountInputs[i] ?? '')
    if (amount === null) {
      badShareAmount = true
      continue
    }
    parsedShares.push({ participantId: shareParticipantIds[i], amount })
  }
  if (badShareAmount) {
    fieldErrors.shares = 'Each share must be a valid amount of at least 0.01.'
  }

  const parsed = expenseSchema.safeParse({
    title: formData.get('title'),
    totalCents: totalCents ?? undefined,
    paidBy: formData.get('paidBy'),
    shares: parsedShares,
  })

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = FIELD_KEYS[String(issue.path[0])]
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
  }

  // Cross-field rules that need the Group's Participant set.
  if (parsed.success) {
    const { paidBy, shares } = parsed.data

    if (!validParticipantIds.has(paidBy)) {
      fieldErrors.paidBy = 'Choose who fronted the expense.'
    }

    const seen = new Set<string>()
    for (const s of shares) {
      if (!validParticipantIds.has(s.participantId)) {
        fieldErrors.shares = 'A share references someone not in this group.'
      }
      if (seen.has(s.participantId)) {
        fieldErrors.shares = 'A participant has more than one share.'
      }
      seen.add(s.participantId)
    }

    const shareSum = shares.reduce((sum, s) => sum + s.amount, 0)
    if (!fieldErrors.shares && shareSum !== parsed.data.totalCents) {
      fieldErrors.shares = 'Shares must add up to the total.'
    }
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      error: 'Check the highlighted fields.',
      fieldErrors,
    }
  }

  const data = parsed.data
  try {
    await createExpenseEntry({
      groupId,
      title: data.title,
      totalAmount: data.totalCents,
      paidBy: data.paidBy,
      shares: data.shares,
    })
  } catch {
    // Includes the deferred sum-guard trigger firing if the invariant is
    // somehow violated past the checks above.
    return {
      status: 'error',
      error: 'Could not record the expense. Please try again.',
    }
  }

  revalidatePath(`/groups/${groupId}`)
  redirect(`/groups/${groupId}`)
}
