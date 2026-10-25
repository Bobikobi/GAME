-- Closing an account keeps 30 days to change one's mind (owner's answer of 23.10, recorded in #305;
-- the rule of 10.10 "Closing an account").
--
-- A closed account is marked with the instant it was closed and is hidden at once. Signing in within 30
-- days clears the mark. After 30 days the personal details are erased and the row stays as a bare number,
-- so the gold ledger and the action log keep their rows under it with no name.
alter table accounts add column closed_at timestamptz;
alter table accounts add column erased_at timestamptz;

-- An erased account has no email and no name to hold.
alter table accounts alter column email drop not null;
alter table accounts alter column name drop not null;

-- The name stays unique in the world while it is anybody's: an erased account gives its name up.
drop index accounts_name;
create unique index accounts_name on accounts (lower(name)) where erased_at is null;

-- The sign-up keeps only that the age check passed, and the country (the proxy's, nullable when unknown);
-- the birth band is no longer stored. Every existing row passed the check to be made.
alter table accounts add column age_checked boolean not null default true;
alter table accounts add column country text;
alter table accounts add constraint accounts_age_was_checked check (age_checked);
alter table accounts add constraint accounts_country_is_two_letters check (country ~ '^[A-Z]{2}$');
alter table accounts drop column birth_band;

alter table accounts add constraint accounts_erased_has_no_details
  check (erased_at is null or (email is null and name is null));
alter table accounts add constraint accounts_erased_was_closed
  check (erased_at is null or closed_at is not null);

-- The sweep of erasures finds the accounts closed long enough ago.
create index accounts_closed on accounts (closed_at) where closed_at is not null and erased_at is null;
