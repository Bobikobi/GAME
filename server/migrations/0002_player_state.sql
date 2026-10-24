-- The player's game state (NEXT 18 b): the serialized kernel state, the seed the server alone keeps,
-- the versions it was written by, the clock anchor and the unspent movement credit, one row per player.
--
-- The seed is its own column and never part of `state`, so a reply built from the state cannot carry it
-- (kernel-review R4). `clock_anchor_ms` is the wall-clock instant the state's tick stands at, and
-- `movement_at` / `movement_credit_ms` are the movement credit of DECISIONS 2026-10-20; both are what
-- `PlayerRecord` holds, so a resumed row tells the server the same time proof it had before.
--
-- `version` is the optimistic lock: a write names the version it read and the row moves only when that
-- version still stands, so two requests cannot both win.
create table player_state (
  account_id uuid primary key references accounts (id) on delete cascade,
  state jsonb not null,
  seed bigint not null,
  kernel_version text not null,
  content_version text not null,
  clock_anchor_ms bigint not null,
  movement_at bigint not null,
  movement_credit_ms integer not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint player_state_seed_is_32_bit check (seed between 0 and 4294967295),
  constraint player_state_clock_is_not_negative check (clock_anchor_ms >= 0),
  constraint player_state_movement_at_is_not_negative check (movement_at >= 0),
  constraint player_state_credit_is_not_negative check (movement_credit_ms >= 0),
  constraint player_state_version_starts_at_one check (version >= 1),
  -- the state column carries no seed: the column above is the only home of the secret
  constraint player_state_state_has_no_seed check (not (state ? 'seed'))
);

-- The action log is the audit and the verified board's source (NEXT 18 b). `seq` is the state version
-- the action produced, so a log row and a state row line up; nothing is ever changed or removed here.
create table action_log (
  id bigint generated always as identity primary key,
  account_id uuid not null references accounts (id) on delete cascade,
  seq bigint not null,
  action jsonb not null,
  tick bigint not null,
  accepted_at timestamptz not null default now(),
  unique (account_id, seq),
  constraint action_log_tick_is_not_negative check (tick >= 0)
);

create index action_log_account_tick on action_log (account_id, tick);

-- The gold ledger: every grant and every payment, with the action and the tick that made it (rule R6, one
-- ledger). Milli-gold, and an integer: a bigint column cannot hold a fraction, and the kernel's money is
-- integer down to the thousandth.
create table gold_ledger (
  id bigint generated always as identity primary key,
  account_id uuid not null references accounts (id) on delete cascade,
  delta_mg bigint not null,
  action jsonb not null,
  tick bigint not null,
  accepted_at timestamptz not null default now(),
  constraint gold_ledger_delta_is_not_zero check (delta_mg <> 0),
  constraint gold_ledger_tick_is_not_negative check (tick >= 0)
);

create index gold_ledger_account_tick on gold_ledger (account_id, tick);

-- Both books are append-only: a row is written once and never changed or removed, so the audit and the
-- board can be rebuilt from them.
create function append_only() returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only: a row is never changed or removed', tg_table_name;
end;
$$;

create trigger action_log_is_append_only
  before update or delete on action_log
  for each row execute function append_only();

create trigger gold_ledger_is_append_only
  before update or delete on gold_ledger
  for each row execute function append_only();

-- A board ranks the accounts of one week in one measure. It is filled from the action log, not by hand.
create table boards (
  week date not null,
  board text not null,
  rank integer not null,
  account_id uuid not null references accounts (id) on delete cascade,
  score bigint not null,
  primary key (week, board, rank),
  unique (week, board, account_id),
  constraint boards_rank_is_positive check (rank >= 1),
  constraint boards_board_is_not_empty check (length(board) between 1 and 40)
);
