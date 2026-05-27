import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

// Mirrors a public.profiles table referencing Supabase auth.users.id.
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
