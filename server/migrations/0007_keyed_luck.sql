-- The luck is keyed (finding 3 of the 27.10 security review; kernel 0.20, state format 3): the secret behind
-- every draw is a 128-bit key, 16 bytes, where it was a 32-bit number. A player sees drawn outcomes, and a
-- 32-bit seed fell to a search over them; the draw is now SipHash-2-4 under the key (kernel/src/rng.ts).
--
-- A row from before widens the way the kernel widens an old save (`widenSeed`): the old number is the first
-- of the four little-endian words and the rest are zero, so the same seed gives the same key everywhere.
-- Its draws differ from before, because the draw itself changed. The column stays the only home of the
-- key: `player_state_state_has_no_seed` is untouched.
alter table player_state drop constraint player_state_seed_is_32_bit;

alter table player_state alter column seed type bytea using decode(
  substr(lpad(to_hex(seed), 8, '0'), 7, 2) || substr(lpad(to_hex(seed), 8, '0'), 5, 2)
    || substr(lpad(to_hex(seed), 8, '0'), 3, 2) || substr(lpad(to_hex(seed), 8, '0'), 1, 2)
    || repeat('00', 12),
  'hex'
);

alter table player_state add constraint player_state_seed_is_128_bit check (octet_length(seed) = 16);

-- The state beside the key is now of format 3: format 2 differs from it only in the seed's shape, and the
-- seed lives in the column above, so the row's own text changes in nothing but the number.
update player_state set state = jsonb_set(state, '{format}', '3') where state->'format' = '2'::jsonb;
