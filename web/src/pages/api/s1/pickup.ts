// POST /api/s1/pickup (docs/team/GRUNT.md, item 17): the one route of the site that is not a file.
import { s1Route } from '../../../s1/route';

export const prerender = false;
export const ALL = s1Route('pickup');
