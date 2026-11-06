-- IF NOT EXISTS throughout, like the baseline and 0001: a database that
-- already carries any of this takes the migration without failing.
--
-- `yield_date` is the UTC day a yield pays for; the unique index on
-- (investment_id, yield_date) is what makes the daily yield cron idempotent —
-- a second run on the same day conflicts and inserts nothing.
ALTER TABLE "investment_yields" ADD COLUMN IF NOT EXISTS "yield_date" date;--> statement-breakpoint
-- Money lost to the 7-day claim window gets its own flag. The expiry sweep
-- used to mark a lost yield claimed, with a claimed_at, which made it
-- indistinguishable from money actually paid to the player.
ALTER TABLE "investment_yields" ADD COLUMN IF NOT EXISTS "expired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill, so the day the old job paid on is a day the new job will not pay
-- again. Without this every pre-existing yield keeps a null yield_date, which
-- the unique index ignores, and a cron run later on the changeover day would
-- pay that day a second time — the exact double payment this migration exists
-- to stop, surviving across the deploy that fixed it.
--
-- Exactly one row per (investment, day) is dated. The old job could pay one
-- day several times, and those duplicates are left null on purpose: dating
-- them would collide with the index below, and deleting them would take back
-- money the player has already been granted and may be about to claim. They
-- stay claimable, out of the index, and no further row can join them.
--
-- Re-runnable: the NOT EXISTS skips any (investment, day) that already has a
-- dated row, so a second application of this migration dates nothing twice.
UPDATE "investment_yields" AS y
SET "yield_date" = y."created_at"::date
WHERE y."yield_date" IS NULL
  AND y."created_at" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "investment_yields" e
    WHERE e."investment_id" = y."investment_id"
      AND e."yield_date" = y."created_at"::date
  )
  AND y."id" = (
    SELECT d."id" FROM "investment_yields" d
    WHERE d."investment_id" = y."investment_id"
      AND d."created_at"::date = y."created_at"::date
      AND d."yield_date" IS NULL
    ORDER BY d."created_at" ASC, d."id" ASC
    LIMIT 1
  );--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "investment_yields_one_per_day" ON "investment_yields" USING btree ("investment_id","yield_date");
