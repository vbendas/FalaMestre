-- IF NOT EXISTS, like the baseline's CREATE TABLE IF NOT EXISTS: a database
-- that already carries the column (pushed by hand, or by an earlier run that
-- was not recorded) takes this migration without failing. The function and
-- the trigger below are written the same way.
ALTER TABLE "game_states" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Every write that changes a save bumps its version, whether or not the
-- writer knows about versions. The routes bump it themselves through
-- `commitSave` and `adjustMoney` (src/lib/save-store.ts) and check it in the
-- UPDATE's WHERE; this trigger is the backstop for any write that sets
-- current_state without them (a hand-run fix, a route added later), so a
-- guarded write that read the save before such a write is refused instead
-- of overwriting it. Assigning OLD.version + 1 rather than incrementing
-- NEW.version keeps the two bumps from stacking.
CREATE OR REPLACE FUNCTION game_states_bump_version() RETURNS trigger AS $$
BEGIN
  IF NEW.current_state IS DISTINCT FROM OLD.current_state THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS game_states_bump_version ON "game_states";
--> statement-breakpoint
CREATE TRIGGER game_states_bump_version
  BEFORE UPDATE ON "game_states"
  FOR EACH ROW
  EXECUTE FUNCTION game_states_bump_version();
