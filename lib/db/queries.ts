import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from './index'
import { type Group, groups, participants } from './schema'

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
