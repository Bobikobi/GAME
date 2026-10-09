/** Where the project lives. Bug reports and the creator guide link here. */
export const REPO_URL = 'https://github.com/Bobikobi/GAME';
/** Working title until the community names the game (spec section 16, milestone 0). */
export const GAME_TITLE = 'Mistvale';
export const SAVE_KEY = 'mistvale.save.1';
/** Tile size in pixels. Every tile is 16x16 and every character frame 16x24. */
export const T = 16;
/** Time to walk one tile. */
export const STEP_MS = 190;
/** Art that the kernel does not name but the client draws. */
export const DIG_SPOT_SPRITE = 'core/base-kit:props/dig_spot';
export const FOG_SPRITE = 'core/base-kit:props/fog';

/**
 * The three groups of cosmetic enrichment the renderer can draw on top of the
 * plain valley. None of them changes a rule: the kernel never sees them.
 * - detail: tile variants and edge strips, soft shadows
 * - motion: extra frames, swaying props, ambient life, footstep dust, idles
 * - light: the dusk ramp, glows, dappled light, the mist breathing, fades
 */
export interface Rich {
  detail: boolean;
  motion: boolean;
  light: boolean;
}

export const RICH_OFF: Rich = { detail: false, motion: false, light: false };

/**
 * Reads `?rich=`: absent (or `all`) turns every group on, `none` turns every group
 * off, a comma list such as `detail,light` turns on only the named groups. A reader
 * who asked the browser for reduced motion gets no motion unless the query names
 * `motion` itself.
 */
export function parseRich(query: string | null, reducedMotion = false): Rich {
  const named = new Set(
    (query ?? 'all')
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
  if (named.has('none')) return { ...RICH_OFF };
  const all = named.size === 0 || named.has('all');
  return {
    detail: all || named.has('detail'),
    motion: (all || named.has('motion')) && (!reducedMotion || named.has('motion')),
    light: all || named.has('light'),
  };
}

function richFromPage(): Rich {
  if (typeof window === 'undefined') return parseRich(null);
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return parseRich(new URLSearchParams(window.location.search).get('rich'), reduced);
}

/** What this page draws. Read once at load; `?rich=none` is the plain valley. */
export const RICH: Rich = richFromPage();

/**
 * The trial switch of the pixel-rich gallery: `?warm=0` turns off the faint gold
 * wash the light group lays over the day, so the valley can be compared with and
 * without it. Absent is on. Read once at load.
 */
function warmFromPage(): boolean {
  if (typeof window === 'undefined') return true;
  return new URLSearchParams(window.location.search).get('warm') !== '0';
}

export const WARM: boolean = warmFromPage();
