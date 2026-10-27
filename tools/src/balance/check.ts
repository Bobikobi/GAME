/**
 * The balance rows `pnpm check` holds the content to (NEXT 19 b). Only the
 * rows that pass on the content as it stands are wired (WIRED_ROWS); the rest
 * of the prover reports through `pnpm balance` until the catalogue lands.
 */
import type { Bundle } from '@game/kernel';
import type { ParamsBody } from '@game/schema';
import type { Issue } from '../load';
import { realCatalogue } from './catalogue';
import { WIRED_ROWS, prove } from './prove';
import { readRules } from './rules';

const PARAMS_FILE = 'content/core/params.json';

export function checkBalance(b: Bundle, params: ParamsBody | undefined): Issue[] {
  if (!params) return [];
  const rules = readRules(params);
  if (!rules) return [{ file: PARAMS_FILE, where: 'balance', message: 'the difficulty and balance blocks are missing (NEXT 19 b)', level: 'error' }];
  const proof = prove(rules, realCatalogue(b, rules), b, { top: false });
  const wired = new Set<string>(WIRED_ROWS);
  return proof.rows
    .filter((r) => wired.has(r.id) && r.status === 'fail')
    .map((r) => ({ file: PARAMS_FILE, where: `balance.${r.id}`, message: `balance: ${r.detail} (pnpm balance)`, level: 'error' as const }));
}
