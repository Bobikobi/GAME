-- The starting gold is a bound balance beside the purse (DECISIONS.md, 2026-10-10), so the gold book names
-- the fund each row moves: 'purse' (every row so far) or 'bound' (the starting gold granted and spent).
-- The two funds sum to the state's two balances separately, and never into each other.
alter table gold_ledger add column fund text not null default 'purse';
alter table gold_ledger add constraint gold_ledger_fund_is_known check (fund in ('purse', 'bound'));
