-- Split users.name into firstName / lastName.
-- Added as nullable first so the existing row can be backfilled, then made
-- NOT NULL. Dropping `name` outright would lose data.

ALTER TABLE "users" ADD COLUMN "firstName" TEXT;
ALTER TABLE "users" ADD COLUMN "lastName"  TEXT;

-- Everything before the first space becomes the first name; the remainder is
-- the surname. A single-word name leaves lastName empty rather than null.
UPDATE "users"
SET "firstName" = COALESCE(NULLIF(split_part("name", ' ', 1), ''), "email"),
    "lastName"  = COALESCE(NULLIF(substring("name" from position(' ' in "name") + 1), "name"), '')
WHERE "firstName" IS NULL;

UPDATE "users" SET "lastName" = '' WHERE "lastName" IS NULL;

ALTER TABLE "users" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "lastName"  SET NOT NULL;

ALTER TABLE "users" DROP COLUMN "name";

-- OAuth accounts keep the provider-reported email for auditing.
ALTER TABLE "oauth_accounts" ADD COLUMN "email" TEXT;
ALTER TABLE "oauth_accounts" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
