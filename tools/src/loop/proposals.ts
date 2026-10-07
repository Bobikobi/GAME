/** Finds proposal metadata and resolves connected groups competing for one place. */
import type { RuleResult } from './merge';
export interface ProposalIdentity {
  number: number;
  slots: string[];
  request?: number;
}

export function answeredRequest(body: string | null): number | undefined {
  const match = body?.match(/\b(?:answers|closes|fixes|resolves)\s+#(\d+)\b/i);
  return match ? Number(match[1]) : undefined;
}

const SLOT_ID = /^[a-z0-9][a-z0-9/_.-]{0,79}$/i;

export function collectSlots(value: unknown): string[] {
  const slots = new Set<string>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    const object = node as Record<string, unknown>;
    const place = object.place;
    if (typeof place === 'object' && place !== null && !Array.isArray(place)) {
      const slot = (place as Record<string, unknown>).slot;
      // slot names come from a pull request's JSON and end up in a bot comment, so only plain ids pass
      if (typeof slot === 'string' && SLOT_ID.test(slot)) slots.add(slot);
    }
    for (const child of Object.values(object)) visit(child);
  };
  visit(value);
  return [...slots].sort();
}

export function competingGroups(proposals: ProposalIdentity[]): ProposalIdentity[][] {
  const seen = new Set<number>();
  const groups: ProposalIdentity[][] = [];
  const competes = (a: ProposalIdentity, b: ProposalIdentity) =>
    (a.request !== undefined && a.request === b.request) || a.slots.some((slot) => b.slots.includes(slot));
  for (const proposal of proposals) {
    if (seen.has(proposal.number)) continue;
    const group: ProposalIdentity[] = [];
    const queue = [proposal];
    seen.add(proposal.number);
    while (queue.length > 0) {
      const current = queue.shift()!;
      group.push(current);
      for (const candidate of proposals) {
        if (!seen.has(candidate.number) && group.some((member) => competes(member, candidate))) {
          seen.add(candidate.number);
          queue.push(candidate);
        }
      }
    }
    if (group.length > 1) groups.push(group.sort((a, b) => a.number - b.number));
  }
  return groups;
}

export function groupKey(group: ProposalIdentity[]): string {
  const requests = [...new Set(group.flatMap((proposal) => proposal.request === undefined ? [] : [proposal.request]))].sort((a, b) => a - b);
  if (requests.length === 1) return `request-${requests[0]}`;
  const slots = [...new Set(group.flatMap((proposal) => proposal.slots))].sort();
  if (slots.length > 0) return `slot-${slots.join('+')}`;
  return `proposals-${group.map((proposal) => proposal.number).sort((a, b) => a - b).join('+')}`;
}

export function groupTitle(group: ProposalIdentity[]): string {
  const request = group.find((proposal) => proposal.request !== undefined)?.request;
  if (request !== undefined && group.every((proposal) => proposal.request === request)) return `request #${request}`;
  const slot = group.flatMap((proposal) => proposal.slots)[0];
  return slot ?? `proposals ${group.map((proposal) => `#${proposal.number}`).join(', ')}`;
}

export function competitionRule(number: number, readyNumbers: number[], labels: string[], voteIssue?: number): RuleResult | undefined {
  if (readyNumbers.length > 1 && !labels.includes('vote won') && !labels.includes('vote lost')) {
    return {
      name: 'Competing',
      state: 'fail',
      text: voteIssue ? `Waiting for the vote in #${voteIssue}` : 'Waiting for a vote to open',
    };
  }
  if (readyNumbers.length === 1 && readyNumbers[0] === number) {
    return { name: 'Competing', state: 'pass', text: 'No other competing proposal is ready' };
  }
  return undefined;
}
