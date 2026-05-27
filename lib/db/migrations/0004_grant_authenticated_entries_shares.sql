-- Base table privileges for the `authenticated` role on the new Entry tables.
--
-- Same rationale as 0001: RLS policies filter rows, but a role must first hold
-- table-level privileges to reach a table at all. Tables created through the
-- MCP migration path don't inherit Supabase's default grants, so we grant
-- explicitly. Not expressible in the Drizzle schema (no GRANT model).
-- The anonymous Viewer (`anon`) read grant lands with the share-link slice.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shares TO authenticated;
