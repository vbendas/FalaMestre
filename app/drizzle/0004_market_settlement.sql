-- IF NOT EXISTS throughout, like the migrations before it: a database that
-- already carries any of this takes the migration without failing.
--
-- A market stops taking bets when its fixture kicks off, and is settled
-- against the result written onto it when the match is banked.
ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "kicked_off_at" timestamp;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "home_score" integer;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "away_score" integer;--> statement-breakpoint
-- What a settled bet actually paid, and the claim a settlement run holds on a
-- bet while it pays it, so two runs at once cannot both pay.
ALTER TABLE "user_bets" ADD COLUMN IF NOT EXISTS "payout" integer;--> statement-breakpoint
ALTER TABLE "user_bets" ADD COLUMN IF NOT EXISTS "settling_at" timestamp;
