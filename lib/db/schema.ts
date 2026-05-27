import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { authenticatedRole, authUid, authUsers } from 'drizzle-orm/supabase'

// Mirrors a public.profiles table referencing Supabase auth.users.id.
// Dormant scaffolding (not yet read or written); RLS is enabled with no policies
// so it stays locked down — only the privileged server role can touch it.
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS()

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert

// A Group: a container for a fixed currency, its Participants, and (later) its
// Entries. Owned by one Creator. `share_token` grants read-only Viewer access;
// its read path lands in a later slice.
export const groups = pgTable(
  'groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // ISO 4217 code, fixed at creation. No edit path is exposed.
    currency: text('currency').notNull(),
    shareToken: text('share_token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check('groups_currency_len_chk', sql`length(${t.currency}) = 3`),
    index('groups_creator_id_idx').on(t.creatorId),
    // Creator owns their Groups. Defense-in-depth + the basis for the future
    // anonymous Viewer path; the runtime server role bypasses RLS and scopes
    // every query by creator_id explicitly.
    pgPolicy('groups_creator_all', {
      for: 'all',
      to: authenticatedRole,
      using: sql`${authUid} = ${t.creatorId}`,
      withCheck: sql`${authUid} = ${t.creatorId}`,
    }),
  ],
)

export type Group = typeof groups.$inferSelect
export type NewGroup = typeof groups.$inferInsert

// A Participant: a named person inside a Group. Not authenticated — identified
// by display name only. `removed_at` soft-removes (forward-only adds, balance-
// guarded removes) so historical Entries can still render the name.
export const participants = pgTable(
  'participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('participants_group_id_idx').on(t.groupId),
    // A Participant is reachable iff the caller owns its Group.
    pgPolicy('participants_creator_all', {
      for: 'all',
      to: authenticatedRole,
      using: sql`exists (select 1 from ${groups} where ${groups.id} = ${t.groupId} and ${groups.creatorId} = ${authUid})`,
      withCheck: sql`exists (select 1 from ${groups} where ${groups.id} = ${t.groupId} and ${groups.creatorId} = ${authUid})`,
    }),
  ],
)

export type Participant = typeof participants.$inferSelect
export type NewParticipant = typeof participants.$inferInsert

// An Entry: one recorded transaction in a Group. Two `kind`s — `expense` (the
// payer fronted a real-world cost, split across one Share per Participant who
// owes a piece) and `payment` (one Participant settling up with another). Both
// share this schema; #14 introduces only `expense`. Amounts are integer minor
// units (cents) — never floats — so no rounding drift is possible. The sum of an
// Entry's Shares equals `total_amount`, enforced by a deferred constraint
// trigger (see the entry-shares sum-guard migration) on top of Zod on write.
export const entries = pgTable(
  'entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    // Integer minor units (cents). Must be strictly positive.
    totalAmount: bigint('total_amount', { mode: 'number' }).notNull(),
    // Who fronted the money for this Entry. No onDelete: Participants are only
    // ever soft-removed (`removed_at`); a hard delete happens solely via Group
    // cascade, where the Entry is removed in the same statement, so the default
    // NO ACTION check passes while still blocking stray Participant deletes.
    paidBy: uuid('paid_by')
      .notNull()
      .references(() => participants.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check('entries_kind_chk', sql`${t.kind} in ('expense', 'payment')`),
    check('entries_total_amount_pos_chk', sql`${t.totalAmount} > 0`),
    // Entry list (most recent first) and pairwise-balance recompute both scan
    // by Group.
    index('entries_group_id_idx').on(t.groupId),
    index('entries_paid_by_idx').on(t.paidBy),
    // An Entry is reachable iff the caller owns its Group. Runtime queries scope
    // by creator_id explicitly; this is defense-in-depth + the Viewer basis.
    pgPolicy('entries_creator_all', {
      for: 'all',
      to: authenticatedRole,
      using: sql`exists (select 1 from ${groups} where ${groups.id} = ${t.groupId} and ${groups.creatorId} = ${authUid})`,
      withCheck: sql`exists (select 1 from ${groups} where ${groups.id} = ${t.groupId} and ${groups.creatorId} = ${authUid})`,
    }),
  ],
)

export type Entry = typeof entries.$inferSelect
export type NewEntry = typeof entries.$inferInsert

// A Share: "this Participant owes this much to the Entry's payer." The `amount`
// (integer minor units) is the source of truth; the percentage is derived for
// display only. One row per (entry, participant). A Participant may have a Share
// on an Entry they paid (their own portion) — that nets to zero in the balance
// computation, which is where "never owes themselves" lives, not here.
export const shares = pgTable(
  'shares',
  {
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    // No onDelete, for the same reason as entries.paid_by above.
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participants.id),
    amount: bigint('amount', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.participantId] }),
    check('shares_amount_pos_chk', sql`${t.amount} > 0`),
    // Pairwise balance sums Shares by participant across the Group.
    index('shares_participant_id_idx').on(t.participantId),
    // A Share is reachable iff the caller owns the Group of its Entry.
    pgPolicy('shares_creator_all', {
      for: 'all',
      to: authenticatedRole,
      using: sql`exists (select 1 from ${entries} join ${groups} on ${groups.id} = ${entries.groupId} where ${entries.id} = ${t.entryId} and ${groups.creatorId} = ${authUid})`,
      withCheck: sql`exists (select 1 from ${entries} join ${groups} on ${groups.id} = ${entries.groupId} where ${entries.id} = ${t.entryId} and ${groups.creatorId} = ${authUid})`,
    }),
  ],
)

export type Share = typeof shares.$inferSelect
export type NewShare = typeof shares.$inferInsert
