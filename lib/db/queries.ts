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
