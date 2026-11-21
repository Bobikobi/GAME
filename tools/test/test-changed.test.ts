import { describe, expect, it } from 'vitest';
import { parseStage, routeChangedTests } from '../src/test-changed.js';

describe('changed-test routing', () => {
  it('uses related tests for changed source while building', () => {
    const runs = routeChangedTests(['kernel/src/step.ts'], 'build');
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ id: 'root:related' });
    expect(runs[0]!.args).toEqual(['exec', 'vitest', 'related', 'kernel/src/step.ts', '--run', '--maxWorkers=1']);
  });

  it('runs a changed test directly while building', () => {
    const runs = routeChangedTests(['tools/test/check.test.ts'], 'build');
    expect(runs[0]).toMatchObject({ id: 'root:changed-tests' });
    expect(runs[0]!.args).toContain('tools/test/check.test.ts');
  });

  it('runs each touched package suite at handover', () => {
    const runs = routeChangedTests(['game/src/app.ts', 'kernel/src/step.ts'], 'handover');
    expect(runs).toHaveLength(1);
    expect(runs[0]!.args).toEqual(['exec', 'vitest', 'run', 'game/test', 'kernel/test', '--maxWorkers=1']);
  });

  it('keeps the web suite in its workspace', () => {
    const runs = routeChangedTests(['web/src/pages/index.astro'], 'build');
    expect(runs[0]).toMatchObject({ id: 'web:related' });
    expect(runs[0]!.args).toContain('src/pages/index.astro');
  });

  it('widens unknown docs to every suite', () => {
    const runs = routeChangedTests(['docs/design/GAME_RULES.md'], 'build');
    expect(runs.map((run) => run.id)).toEqual(['root:all', 'web:all']);
    expect(runs.every((run) => run.reason.includes('no known test link'))).toBe(true);
  });

  it('runs every suite at the all stage', () => {
    expect(routeChangedTests(['kernel/src/step.ts'], 'all').map((run) => run.id)).toEqual(['root:all', 'web:all']);
  });

  it('parses the stage forms and plan flag', () => {
    expect(parseStage([])).toEqual({ stage: 'build', planOnly: false });
    expect(parseStage(['--stage=handover', '--plan'])).toEqual({ stage: 'handover', planOnly: true });
    expect(parseStage(['--stage', 'all'])).toEqual({ stage: 'all', planOnly: false });
  });
});
