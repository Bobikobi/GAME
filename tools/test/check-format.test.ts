/** The last line of `pnpm check` tells a creator their own warnings apart from the core's (issue #734). */
import { describe, expect, it } from 'vitest';
import { formatIssues } from '../src/check';
import type { Issue } from '../src/load';

const issue = (file: string, level: Issue['level'] = 'warning'): Issue => ({ file, where: '', message: `${level} in ${file}`, level });

const summary = (issues: Issue[], files: number): string => {
  const text = formatIssues({ files, issues, assembled: { bundle: undefined, issues: [], kits: {}, origin: {} } });
  return text.split('\n').find((line) => line.includes('files checked'))!;
};

describe('formatIssues', () => {
  it('counts the warnings under content/extensions/ apart from the rest', () => {
    const line = summary(
      [
        issue('content/core/one.json'),
        issue('content/core/two.json'),
        issue('content/extensions/alice/fig.json'),
        issue('content/extensions/alice/herb.json'),
        issue('content/extensions/bob/quest.json'),
      ],
      5,
    );
    expect(line).toBe('5 files checked: 0 errors, 5 warnings (3 in content/extensions).');
  });

  it('does not count an error in an extension as a warning', () => {
    const line = summary(
      [
        issue('content/core/one.json'),
        issue('content/extensions/alice/fig.json', 'error'),
        issue('content/extensions/alice/herb.json'),
      ],
      3,
    );
    expect(line).toBe('3 files checked: 1 error, 2 warnings (1 in content/extensions).');
  });

  it('reads zero when every warning is the core\'s', () => {
    const line = summary([issue('content/core/one.json'), issue('content/core/two.json')], 2);
    expect(line).toBe('2 files checked: 0 errors, 2 warnings (0 in content/extensions).');
  });
});
