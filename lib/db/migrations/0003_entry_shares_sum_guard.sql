-- Database-level guarantee that an Entry's Shares sum exactly to its total.
--
-- The amount on each Share is the source of truth; the invariant is
-- `sum(shares.amount) = entries.total_amount` for every Entry. Zod enforces this
-- on write, but a crafted request that bypasses the app must not be able to
-- break it — so we also enforce it in the database.
--
-- This is a cross-row invariant (it spans an Entry and all its Shares), so it
-- can't be a CHECK constraint. We use DEFERRABLE INITIALLY DEFERRED constraint
-- triggers that fire at COMMIT, after an Entry and its Shares have all been
-- inserted within one transaction. Not expressible in the Drizzle schema, so it
-- lives here and is applied out of band like the GRANTs.

CREATE OR REPLACE FUNCTION public.assert_entry_shares_sum()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_entry uuid;
  entry_total bigint;
  shares_total bigint;
BEGIN
  -- NEW/OLD are typed to the firing table, so the column referenced differs:
  -- `shares` carries entry_id, `entries` carries id. (A bare COALESCE across
  -- both would raise "record has no field" instead of yielding NULL.)
  IF TG_TABLE_NAME = 'shares' THEN
    target_entry := COALESCE(NEW.entry_id, OLD.entry_id);
  ELSE
    target_entry := COALESCE(NEW.id, OLD.id);
  END IF;
  -- If the Entry itself is gone (e.g. deleted, cascading its Shares away),
  -- there is nothing left to validate.
  SELECT total_amount INTO entry_total FROM public.entries WHERE id = target_entry;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO shares_total
  FROM public.shares
  WHERE entry_id = target_entry;

  IF shares_total <> entry_total THEN
    RAISE EXCEPTION 'shares for entry % sum to % but entry total is %',
      target_entry, shares_total, entry_total
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

-- Fires when Shares change (insert/update/delete).
CREATE CONSTRAINT TRIGGER shares_sum_matches_entry
  AFTER INSERT OR UPDATE OR DELETE ON public.shares
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_entry_shares_sum();

-- Fires when an Entry's total changes (or on insert), so an Entry can never be
-- left without matching Shares.
CREATE CONSTRAINT TRIGGER entry_total_matches_shares
  AFTER INSERT OR UPDATE OF total_amount ON public.entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_entry_shares_sum();
