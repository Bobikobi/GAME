// POST /api/feedback: an Astro server route, so the build's one Build Output carries every function.
// Any file under a root api/ folder makes Vercel deploy the static folder and api/ alone and drop the
// Astro functions (the /api/s1/ routes answered 404), so the repository keeps no root api/ folder.
import type { APIRoute } from 'astro';
import { handle, json } from '../../feedback/handler';

export const prerender = false;

export const POST: APIRoute = ({ request }) => handle(request, process.env);

export const GET: APIRoute = () => json(405, { error: 'method' });
