-- IF NOT EXISTS, like the migrations before it: a database that already
-- carries this takes the migration without failing.
--
-- One row per fixture once it has kicked off: the seed the server drew for
-- it, how it is being played, the setup frozen at kickoff and each decision
-- as it is played. The primary key is what makes a fixture's seed one seed.
CREATE TABLE IF NOT EXISTS "fixture_kickoffs" (
	"user_id" text NOT NULL,
	"round" integer NOT NULL,
	"seed" text NOT NULL,
	"mode" text NOT NULL,
	"setup" jsonb NOT NULL,
	"decisions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"kicked_off_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fixture_kickoffs_user_id_round_pk" PRIMARY KEY("user_id","round")
);
