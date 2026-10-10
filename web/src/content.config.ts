// The creator guide as pages (docs/team/GRUNT.md, item 13): every markdown file of docs/creators/ from its one
// source, the same file the game's guide panel imports. README.md is /docs/.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const creators = defineCollection({
  loader: glob({ pattern: '**/*.md', base: '../docs/creators' }),
});

export const collections = { creators };
