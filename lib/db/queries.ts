import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { db } from './index'
import {
  type Entry,
  entries,
  type Group,
  groups,
  participants,
  shares,
} from './schema'

// The runtime connection uses the privileged server role, which bypasses RLS,
// so every query here scopes to the Creator explicitly via `creatorId`. RLS on
// the tables is defense-in-depth and the basis for the future Viewer path.

export type GroupSummary = {
  id: string
  title: string
  currency: string
  createdAt: Date
  participantCount: number
}

export async function listGroupsForCreator(
  creatorId: string,
): Promise<GroupSummary[]> {
  return db
    .select({
      id: groups.id,
      title: groups.title,
      currency: groups.currency,
      createdAt: groups.createdAt,
      // Active Participants only — removed ones are excluded by the join filter.
      participantCount: sql<number>`count(${participants.id})`.mapWith(Number),
    })
    .from(groups)
    .leftJoin(
      participants,
      and(
        eq(participants.groupId, groups.id),
        isNull(participants.removedAt),
      ),
    )
    .where(eq(groups.creatorId, creatorId))
    .groupBy(groups.id)
    .orderBy(desc(groups.createdAt))
}

export type GroupParticipant = {
  id: string
  displayName: string
  createdAt: Date
}

export type GroupWithParticipants = {
  group: Group
  participants: GroupParticipant[]
}

// Returns null when the Group doesn't exist or isn't owned by this Creator —
// the caller maps both to a 404 so ownership isn't leaked.
export type GroupParticipantWithRemoved = {
  id: string
  displayName: string
  removedAt: Date | null
  createdAt: Date
}

export type GroupWithAllParticipants = {
  group: Group
  participants: GroupParticipantWithRemoved[]
}

export async function getGroupForCreator(
  groupId: string,
  creatorId: string,
): Promise<GroupWithParticipants | null> {
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.creatorId, creatorId)))
    .limit(1)

  if (!group) return null

  const members = await db
    .select({
      id: participants.id,
      displayName: participants.displayName,
      createdAt: participants.createdAt,
    })
    .from(participants)
    .where(
      and(eq(participants.groupId, groupId), isNull(participants.removedAt)),
    )
    .orderBy(participants.createdAt)

  return { group, participants: members }
}

export async function getGroupWithAllParticipantsForCreator(
  groupId: string,
  creatorId: string,
): Promise<GroupWithAllParticipants | null> {
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.creatorId, creatorId)))
    .limit(1)

  if (!group) return null

  const allMembers = await db
    .select({
      id: participants.id,
      displayName: participants.displayName,
      removedAt: participants.removedAt,
      createdAt: participants.createdAt,
    })
    .from(participants)
    .where(eq(participants.groupId, groupId))
    .orderBy(participants.createdAt)

  return { group, participants: allMembers }
}

export async function createGroupWithParticipants(input: {
  creatorId: string
  title: string
  currency: string
  shareToken: string
  // Display names in order; the Creator's own name is expected to be first.
  participantNames: string[]
}): Promise<Group> {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({
        creatorId: input.creatorId,
        title: input.title,
        currency: input.currency,
        shareToken: input.shareToken,
      })
      .returning()

    await tx.insert(participants).values(
      input.participantNames.map((displayName) => ({
        groupId: group.id,
        displayName,
      })),
    )

    return group
  })
}

// Inserts an Expense Entry and its Shares atomically. The deferred sum-guard
// trigger fires at COMMIT, so a Share set that doesn't sum to `totalAmount`
// aborts the whole transaction — the database backstop behind the Zod check.
// Callers must have already verified Group ownership and that every
// `participantId`/`paidBy` belongs to the Group.
export async function createExpenseEntry(input: {
  groupId: string
  title: string
  totalAmount: number
  paidBy: string
  shares: { participantId: string; amount: number }[]
}): Promise<Entry> {
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(entries)
      .values({
        groupId: input.groupId,
        kind: 'expense',
        title: input.title,
        totalAmount: input.totalAmount,
        paidBy: input.paidBy,
      })
      .returning()

    await tx.insert(shares).values(
      input.shares.map((s) => ({
        entryId: entry.id,
        participantId: s.participantId,
        amount: s.amount,
      })),
    )

    return entry
  })
}

// Inserts a Payment Entry: one Participant (the debtor, `paidBy`) settling up
// with another (the recipient). It's an Entry with `kind = 'payment'` and
// exactly one Share, at the full amount, to the recipient — so the deferred
// sum-guard (Share total == Entry total) is satisfied by construction. The
// pairwise balance then derives the squared-up figure at read time; there is no
// stored Debt or `settled` flag (ADR-0001). Callers must have already verified
// Group ownership and that `paidBy` and `recipientId` are distinct Participants
// of the Group.
export async function createPaymentEntry(input: {
  groupId: string
  title: string
  amount: number
  paidBy: string
  recipientId: string
}): Promise<Entry> {
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(entries)
      .values({
        groupId: input.groupId,
        kind: 'payment',
        title: input.title,
        totalAmount: input.amount,
        paidBy: input.paidBy,
      })
      .returning()

    await tx.insert(shares).values({
      entryId: entry.id,
      participantId: input.recipientId,
      amount: input.amount,
    })

    return entry
  })
}

export type EntryShare = {
  participantId: string
  displayName: string
  amount: number
}

export type EntryListItem = {
  id: string
  kind: string
  title: string
  totalAmount: number
  createdAt: Date
  paidBy: string
  payerName: string
  shares: EntryShare[]
}

// Every Entry in a Group, most recent first, each with its payer's name and its
// Shares (participant name + amount). Caller is expected to have verified Group
// ownership via getGroupForCreator; this scopes by groupId.
export async function listEntriesForGroup(
  groupId: string,
): Promise<EntryListItem[]> {
  // `payer` aliases participants so the payer join doesn't collide with the
  // per-Share participant join below.
  const payer = alias(participants, 'payer')
  const rows = await db
    .select({
      id: entries.id,
      kind: entries.kind,
      title: entries.title,
      totalAmount: entries.totalAmount,
      createdAt: entries.createdAt,
      paidBy: entries.paidBy,
      payerName: payer.displayName,
    })
    .from(entries)
    .innerJoin(payer, eq(payer.id, entries.paidBy))
    .where(eq(entries.groupId, groupId))
    .orderBy(desc(entries.createdAt))

  if (rows.length === 0) return []

  const shareRows = await db
    .select({
      entryId: shares.entryId,
      participantId: shares.participantId,
      displayName: participants.displayName,
      amount: shares.amount,
    })
    .from(shares)
    .innerJoin(participants, eq(participants.id, shares.participantId))
    .where(
      inArray(
        shares.entryId,
        rows.map((r) => r.id),
      ),
    )

  const sharesByEntry = new Map<string, EntryShare[]>()
  for (const s of shareRows) {
    const list = sharesByEntry.get(s.entryId) ?? []
    list.push({
      participantId: s.participantId,
      displayName: s.displayName,
      amount: s.amount,
    })
    sharesByEntry.set(s.entryId, list)
  }

  return rows.map((r) => ({ ...r, shares: sharesByEntry.get(r.id) ?? [] }))
}

export type EntryWithShares = {
  entry: Entry
  shares: EntryShare[]
}

// Returns null when the Entry doesn't exist, isn't in a Group owned by this Creator,
// or isn't an Expense (Payments have immutable structure per #16).
export async function getEntryWithSharesForCreator(
  entryId: string,
  creatorId: string,
): Promise<EntryWithShares | null> {
  const payer = alias(participants, 'payer')
  const [row] = await db
    .select({
      entry: entries,
      payerName: payer.displayName,
    })
    .from(entries)
    .innerJoin(payer, eq(payer.id, entries.paidBy))
    .innerJoin(
      groups,
      and(eq(groups.id, entries.groupId), eq(groups.creatorId, creatorId)),
    )
    .where(eq(entries.id, entryId))
    .limit(1)

  if (!row) return null

  const shareRows = await db
    .select({
      participantId: shares.participantId,
      displayName: participants.displayName,
      amount: shares.amount,
    })
    .from(shares)
    .innerJoin(participants, eq(participants.id, shares.participantId))
    .where(eq(shares.entryId, entryId))

  return {
    entry: row.entry,
    shares: shareRows,
  }
}

// Updates an Entry and its Shares atomically. Deletes all old Shares and inserts
// new ones. The deferred sum-guard trigger fires at COMMIT. Caller must have
// verified ownership and that all participantIds/paidBy belong to the Group.
export async function updateExpenseEntry(input: {
  entryId: string
  title: string
  totalAmount: number
  paidBy: string
  shares: { participantId: string; amount: number }[]
}): Promise<Entry> {
  return db.transaction(async (tx) => {
    // Update the entry
    const [updated] = await tx
      .update(entries)
      .set({
        title: input.title,
        totalAmount: input.totalAmount,
        paidBy: input.paidBy,
        updatedAt: new Date(),
      })
      .where(eq(entries.id, input.entryId))
      .returning()

    // Delete old shares
    await tx.delete(shares).where(eq(shares.entryId, input.entryId))

    // Insert new shares
    await tx.insert(shares).values(
      input.shares.map((s) => ({
        entryId: input.entryId,
        participantId: s.participantId,
        amount: s.amount,
      })),
    )

    return updated
  })
}

// Deletes an Entry and cascades its Shares (via FK onDelete). Returns true if
// deleted, false if not found or ownership check failed.
export async function deleteEntryForCreator(
  entryId: string,
  creatorId: string,
): Promise<boolean> {
  const result = await db
    .delete(entries)
    .where(
      and(
        eq(entries.id, entryId),
        // Ownership check: Entry's Group must be owned by this Creator
        sql`exists (select 1 from ${groups} where ${groups.id} = ${entries.groupId} and ${groups.creatorId} = ${creatorId})`,
      ),
    )
    .returning({ id: entries.id })

  return result.length > 0
}
