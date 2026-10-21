-- Sign-in (NEXT 18 e): the session a cookie names, the email link, the OAuth round trip, and the sign-up
-- that waits for a name and an age once an identity is proven.
--
-- No secret is stored as it was sent: every token below is kept as the sha-256 of its value in hex, so a
-- copy of this database signs nobody in. Every row carries the instant it stops counting; the server
-- compares it with its own clock and a row past it is refused, then swept.

-- A signed-in browser. The cookie holds the token; the row holds its hash, the account, and the instant it
-- ends. Signing out or closing the account revokes the row, so a stolen cookie stops working at once.
create table sessions (
  token_hash text primary key,
  account_id uuid not null references accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint sessions_token_hash_is_sha256 check (token_hash ~ '^[0-9a-f]{64}$')
);

create index sessions_account on sessions (account_id);

-- A sign-in link sent by email: single-use (`used_at` is set once, by the one request that wins) and short.
create table email_links (
  token_hash text primary key,
  email text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint email_links_token_hash_is_sha256 check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint email_links_email_is_lower_case check (email = lower(email))
);

create index email_links_email on email_links (email, created_at);

-- One OAuth round trip: the `state` it was sent with (hashed), the PKCE verifier and the id token's nonce.
-- The callback takes the row away, so a state is good for one answer.
create table oauth_flows (
  state_hash text primary key,
  provider text not null,
  code_verifier text not null,
  nonce text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  constraint oauth_flows_state_hash_is_sha256 check (state_hash ~ '^[0-9a-f]{64}$'),
  constraint oauth_flows_provider_is_known check (provider in ('google', 'discord'))
);

-- A proven identity with no account yet: the sign-up form names it by a cookie, and the account is made
-- only when the name and the age are given (DECISIONS 2026-10-09, after the opening).
create table signup_tickets (
  ticket_hash text primary key,
  provider text not null,
  subject text not null,
  email text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  constraint signup_tickets_hash_is_sha256 check (ticket_hash ~ '^[0-9a-f]{64}$'),
  constraint signup_tickets_provider_is_known check (provider in ('email', 'google', 'discord')),
  constraint signup_tickets_email_is_lower_case check (email = lower(email))
);

-- The name the world shows is unique in the world, whatever its case (DECISIONS 2026-10-09, superseded in
-- part 10.10).
create unique index accounts_name on accounts (lower(name));

-- Closing an account deletes its rows (NEXT 18 e). The two books refuse a change or a removal, and that
-- refusal also stopped the cascade from the account, so no account could be closed. A removal is let
-- through only once its account is gone, which is the cascade and nothing else: the foreign key keeps an
-- orphan row from existing, so a direct `delete` on a book still raises.
create or replace function append_only() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from accounts where id = old.account_id) then
    return old;
  end if;
  raise exception '% is append-only: a row is never changed or removed', tg_table_name;
end;
$$;
