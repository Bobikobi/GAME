import { expect, test } from 'vitest';

import { STEP_MS } from '../src/config';
import { loadBundle } from '../../tools/test/helpers/world';

test('the client walks a tile at the pace the kernel checks a position report against', () => {
  expect(STEP_MS).toBe(loadBundle().params.walk_step_ms);
});
