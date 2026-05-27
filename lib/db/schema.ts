import { sql } from 'drizzle-orm'
import {
  check,
  index,
  pgPolicy,
  pgTable,
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
