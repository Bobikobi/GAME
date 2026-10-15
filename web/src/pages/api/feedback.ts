// POST /api/feedback: an Astro server route, so the build's one Build Output carries every function.
// A file under the root api/ folder made Vercel deploy the static folder and the api/ functions only,
// dropping the Astro functions (the /api/s1/ routes). The work stays in api/_feedback.ts.
import type { APIRoute } from 'astro';
import { handle, json } from '../../../../api/_feedback';

export const prerender = false;

export const POST: APIRoute = ({ request }) => handle(request, process.env);

export const GET: APIRoute = () => json(405, { error: 'method' });
