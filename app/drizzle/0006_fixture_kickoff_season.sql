-- Every season of a save reuses rounds 1 to 38, so a kickoff is keyed on the
-- season as well as the round: without it a second season's round 1 found
-- the first season's kickoff and replayed its seed and decisions. Rows from
-- before the column are the first season.
--
-- Safe to run again, like the migrations before it.
ALTER TABLE "fixture_kickoffs" ADD COLUMN IF NOT EXISTS "season" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "fixture_kickoffs" DROP CONSTRAINT IF EXISTS "fixture_kickoffs_user_id_round_pk";--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fixture_kickoffs_user_id_season_round_pk'
  ) THEN
    ALTER TABLE "fixture_kickoffs"
      ADD CONSTRAINT "fixture_kickoffs_user_id_season_round_pk" PRIMARY KEY ("user_id", "season", "round");
  END IF;
END $$;
