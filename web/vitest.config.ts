import { defineConfig } from 'vitest/config';

// the site's tests read the built output in web/dist, so they run after `astro build` and the copy of the game
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // a hook gets the same 30 s as the root config's: the default 10 s fails on a busy machine (15.11)
    hookTimeout: 30000,
  },
});
