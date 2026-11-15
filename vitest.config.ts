import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['kernel/test/**/*.test.ts', 'tools/test/**/*.test.ts', 'schema/test/**/*.test.ts', 'mcp/test/**/*.test.ts', 'game/test/**/*.test.ts', 'server/test/**/*.test.ts'],
    testTimeout: 30000,
    // a hook gets as long as a test: a beforeAll that loads the bundle passed 10 s on a busy machine and lost 32 files (15.11)
    hookTimeout: 30000,
  },
});
