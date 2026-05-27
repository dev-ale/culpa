'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createPaymentEntry, getGroupForCreator } from '@/lib/db/queries'
import { parseAmountToCents } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'

const paymentSchema = z.object({
  // Title is optional on a Payment; default it so the Entry (and its list row)
  // always reads sensibly.
  title: z.string().trim().max(120).optional(),
  amountCents: z.number().int().positive('Enter an amount greater than zero.'),
  paidBy: z.string().uuid(),
  recipientId: z.string().uuid(),
})

export type CreatePaymentFieldErrors = {
  amount?: string
  paidBy?: string
  recipient?: string
}

export type CreatePaymentState = {
  status: 'idle' | 'error'
  error?: string
  fieldErrors?: CreatePaymentFieldErrors
}

const FIELD_KEYS: Record<string, keyof CreatePaymentFieldErrors> = {
  amountCents: 'amount',
  paidBy: 'paidBy',
  recipientId: 'recipient',
}

export async function createPayment(
  _prevState: CreatePaymentState,
  formData: FormData,
): Promise<CreatePaymentState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const groupId = String(formData.get('groupId') ?? '')

  // Ownership + the authoritative Participant set come from the database, never
  // from the request — so a crafted form can't reference another Group or a
  // Participant that isn't in this one.
  const group = await getGroupForCreator(groupId, user.id)
  if (!group) {
    redirect('/dashboard')
  }
  const validParticipantIds = new Set(group.participants.map((p) => p.id))

  const fieldErrors: CreatePaymentFieldErrors = {}

  const amountCents = parseAmountToCents(String(formData.get('amount') ?? ''))
  if (amountCents === null) {
    fieldErrors.amount = 'Enter a valid amount, e.g. 10.00.'
  }

  const parsed = paymentSchema.safeParse({
    title: formData.get('title') ?? undefined,
    amountCents: amountCents ?? undefined,
    paidBy: formData.get('paidBy'),
    recipientId: formData.get('recipientId'),
  })

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = FIELD_KEYS[String(issue.path[0])]
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
  }

  // Cross-field rules that need the Group's Participant set.
  if (parsed.success) {
    const { paidBy, recipientId } = parsed.data

    if (!validParticipantIds.has(paidBy)) {
      fieldErrors.paidBy = 'Choose who paid.'
    }
    if (!validParticipantIds.has(recipientId)) {
      fieldErrors.recipient = 'Choose who was paid.'
    }
    if (
      !fieldErrors.paidBy &&
      !fieldErrors.recipient &&
      paidBy === recipientId
    ) {
      fieldErrors.recipient = 'A payment must be between two different people.'
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
  const payerName =
    group.participants.find((p) => p.id === data.paidBy)?.displayName ?? ''
  const recipientName =
    group.participants.find((p) => p.id === data.recipientId)?.displayName ?? ''

  try {
    await createPaymentEntry({
      groupId,
      title: data.title || `${payerName} paid ${recipientName}`,
      amount: data.amountCents,
      paidBy: data.paidBy,
      recipientId: data.recipientId,
    })
  } catch {
    return {
      status: 'error',
      error: 'Could not record the payment. Please try again.',
    }
  }

  revalidatePath(`/groups/${groupId}`)
  redirect(`/groups/${groupId}`)
}
