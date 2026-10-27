/**
 * The prompt a builder gives their AI (docs/team/GRUNT.md, item 7). It names llms.txt by its full address when
 * the build knows the site's address (astro.config.mjs takes it from Vercel), and by its path otherwise.
 */
export function prompt(site: URL | undefined): string {
  const llms = site ? new URL('/llms.txt', site).href : '/llms.txt on the Loomvale site';
  return (
    `You are helping me add content to Loomvale. Read llms.txt at ${llms}, then the guide it links to. ` +
    'Content lives in content/extensions/<my-handle>/. Run pnpm check before you tell me it is done.'
  );
}
