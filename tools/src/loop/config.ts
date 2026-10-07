/** Loads and validates the public parameters for the community loop. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LoopConfig {
  open_call_votes: number;
  approvals_to_merge: number;
  required_checks: string[];
  approvals_must_match_head: boolean;
  quota: { new_creator: number; per_accepted: number; cap: number };
  vote_days: number;
  min_votes_to_decide: number;
  min_votes_for_percent: number;
  min_account_age_days: number;
}

export function loadConfig(file = join(process.cwd(), '.github', 'loop.json')): LoopConfig {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read loop configuration ${file}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return validateConfig(value);
}

export function validateConfig(value: unknown): LoopConfig {
  if (!record(value)) throw new Error('Invalid loop configuration: expected a JSON object.');
  const positive = (name: string, input: unknown, allowZero = false): number => {
    if (!Number.isInteger(input) || typeof input !== 'number' || input < (allowZero ? 0 : 1)) {
      throw new Error(`Invalid loop configuration: ${name} must be ${allowZero ? 'a non-negative' : 'a positive'} integer.`);
    }
    return input;
  };
  if (!Array.isArray(value.required_checks) || value.required_checks.length === 0 || value.required_checks.some((v) => typeof v !== 'string' || v.length === 0)) {
    throw new Error('Invalid loop configuration: required_checks must be a non-empty array of strings.');
  }
  if (typeof value.approvals_must_match_head !== 'boolean') {
    throw new Error('Invalid loop configuration: approvals_must_match_head must be a boolean.');
  }
  if (!record(value.quota)) throw new Error('Invalid loop configuration: quota must be an object.');
  const config: LoopConfig = {
    open_call_votes: positive('open_call_votes', value.open_call_votes),
    approvals_to_merge: positive('approvals_to_merge', value.approvals_to_merge),
    required_checks: [...value.required_checks] as string[],
    approvals_must_match_head: value.approvals_must_match_head,
    quota: {
      new_creator: positive('quota.new_creator', value.quota.new_creator, true),
      per_accepted: positive('quota.per_accepted', value.quota.per_accepted, true),
      cap: positive('quota.cap', value.quota.cap),
    },
    vote_days: positive('vote_days', value.vote_days),
    min_votes_to_decide: positive('min_votes_to_decide', value.min_votes_to_decide),
    min_votes_for_percent: positive('min_votes_for_percent', value.min_votes_for_percent),
    min_account_age_days: positive('min_account_age_days', value.min_account_age_days, true),
  };
  if (config.quota.new_creator > config.quota.cap) {
    throw new Error('Invalid loop configuration: quota.new_creator may not exceed quota.cap.');
  }
  return config;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
