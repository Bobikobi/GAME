import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['kernel/test/**/*.test.ts', 'tools/test/**/*.test.ts', 'schema/test/**/*.test.ts', 'game/test/**/*.test.ts'],
    testTimeout: 30000,
  },
});
