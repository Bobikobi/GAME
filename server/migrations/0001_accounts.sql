-- Accounts and the identities they sign in with (NEXT 18 b; DECISIONS 2026-10-09 "An account asks for
-- little", CR-49 the age, CR-53 one person one account).
--
-- An account holds what the sign-up asks for and nothing else: a name and an email. The age is kept as
-- the band CR-49 needs (13 or the country's higher age of digital consent; a younger player is pointed
-- to the demo), never as a birth date, so the row cannot become a birthday.
create table accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  birth_band text not null,
  created_at timestamptz not null default now(),
  constraint accounts_email_is_lower_case check (email = lower(email)),
  constraint accounts_email_has_one_at check (position('@' in email) > 1),
  constraint accounts_email_is_not_empty check (length(email) between 3 and 320),
  constraint accounts_name_is_not_empty check (length(name) between 1 and 80),
  constraint accounts_birth_band_is_known check (birth_band in ('13-15', '16-17', '18+'))
);

-- One person, one account: an email signs in once (CR-53).
create unique index accounts_email on accounts (email);

-- A sign-in identity: the provider and its subject, either an OAuth subject or the email link's address.
create table sign_in_identities (
  provider text not null,
  subject text not null,
  account_id uuid not null references accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, subject),
  constraint sign_in_identities_provider_is_known check (provider in ('email', 'google', 'discord')),
  constraint sign_in_identities_subject_is_not_empty check (length(subject) between 1 and 320)
);

create index sign_in_identities_account on sign_in_identities (account_id);
