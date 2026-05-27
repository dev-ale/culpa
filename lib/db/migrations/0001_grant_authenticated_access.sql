-- Base table privileges for the `authenticated` role.
--
-- RLS policies filter *rows*, but a role must first hold table-level privileges
-- to reach a table at all — otherwise every query errors with "permission
-- denied" and the policy never runs. Supabase normally grants these via default
-- privileges; tables created through the MCP migration path did not inherit
-- them, so we grant explicitly here.
--
-- Not expressible in the Drizzle schema (it has no GRANT model), so this lives
-- as a standalone migration applied out of band. The anonymous Viewer (`anon`)
-- read grant lands with the share-link slice.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.participants TO authenticated;
