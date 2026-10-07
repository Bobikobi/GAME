/** Checks the important lines in a representative weekly summary. */
import { describe, expect, it } from 'vitest';
import { isoWeek, renderSummary } from '../../src/loop/summary';

describe('weekly summary', () => {
  it('renders requests, review needs, votes, and merged credits', () => {
    const markdown = renderSummary({
      repository: 'mist/vale',
      week: '2026-W41',
      newRequests: [{ number: 1, title: 'Owls', url: 'u1', support: 8 }],
      topRequests: [{ number: 2, title: 'Moss', url: 'u2', support: 12 }],
      openCalls: [{ number: 1, title: 'Owls', url: 'u1', support: 8 }],
      capabilities: [{ number: 3, title: 'Boats', url: 'u3', support: 7 }],
      waiting: [{ number: 10, title: 'Blue moss', url: 'p10', author: 'alice', approvals: 1 }],
      ready: [{ number: 11, title: 'Night owl', url: 'p11', author: 'bob', approvals: 3 }],
      votes: [{ number: 20, title: 'Vote: west', url: 'v20', display: '- Blue: █████\n- Red: ███' }],
      merged: [{ number: 9, title: 'Tea', url: 'p9', author: 'cara', reviewers: ['dana', 'eli'] }],
    });
    expect(markdown).toContain('# Weekly summary: 2026-W41');
    expect(markdown).toContain('[#1 Owls](u1) - 👍 8');
    expect(markdown).toContain('[#10 Blue moss](p10) - 1 approval');
    expect(markdown).toContain('### [Vote: west](v20)');
    expect(markdown).toContain('by @cara; reviewed by @dana, @eli');
    expect(markdown).toContain('sort%3Areactions-%2B1-desc');
  });

  it('computes ISO week labels', () => {
    expect(isoWeek(new Date('2026-10-07T00:00:00Z'))).toBe('2026-W41');
  });
});
