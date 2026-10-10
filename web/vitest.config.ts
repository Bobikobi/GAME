import { defineConfig } from 'vitest/config';

// the site's tests read the built output in web/dist, so they run after `astro build` and the copy of the game
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
