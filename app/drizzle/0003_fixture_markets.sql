-- IF NOT EXISTS throughout, like the migrations before it: a database that
-- already carries any of this takes the migration without failing.
--
-- A market is on one player's fixture. Nullable so rows from before the
-- column (nothing created markets until now, but a hand-seeded one could
-- exist) do not stop the migration; Postgres treats NULLs as distinct, so
-- such rows stay out of the index below.
ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "user_id" text;--> statement-breakpoint
-- One market per fixture, however many times creation runs. Markets are
-- opened on a new save, on every banked match and by the bets screen
-- catching up; whichever lands second conflicts here and inserts nothing.
CREATE UNIQUE INDEX IF NOT EXISTS "predictions_one_per_fixture" ON "predictions" USING btree ("user_id","match_id");
