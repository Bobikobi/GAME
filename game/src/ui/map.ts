/**
 * The chart: only the ground the player has walked and the places they have
 * stood in (G5, G8). Drawn as SVG so it scales from a pocket chart to the
 * window; the list beside it carries the names a small screen cannot fit.
 */
import { tagAt, type Bundle, type Slot } from '@game/kernel';
import { MAP_CHUNK, PLACE_KIND, STALL_SLOT, chunkKey, mapPlaces, type MapPlace } from '../places';

const INK = '#1b1a2e';
const PAPER = '#ebd3a2';
const GOLD = '#eda83a';
const GOLD_DARK = '#c99a5e';
const RED = '#a8302f';
const CREAM = '#f5f4ef';

const TERRAIN: Record<string, string> = {
  meadow: '#84c450',
  grove: '#4c9a3f',
  water: '#3f8fd1',
  riverbank: '#c99a5e',
  path: '#c99a5e',
  town: '#8f94a8',
  ruin: '#5d6177',
};

const KIND_FILL: Record<Slot['kind'], string> = {
  area: GOLD,
  ruin: '#5d6177',
  npc: '#5d6177',
  building: '#c99a5e',
  restore: '#3f8fd1',
  camp: '#4c9a3f',
  resource: '#84c450',
};

export interface MapDraw {
  seen: ReadonlySet<string>;
  chunks: ReadonlySet<string>;
  at: readonly [number, number];
  stall?: string;
  selected?: string;
  compact?: boolean;
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

function chunkAt(key: string): [number, number] | undefined {
  if (!/^\d+,\d+$/.test(key)) return undefined;
  const [x, y] = key.split(',').map(Number) as [number, number];
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : undefined;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Priority on the chart: the stall and the player come before the rest, and a name before a dot. */
function rank(p: MapPlace): number {
  if (p.stall || p.id === STALL_SLOT) return 0;
  if (p.current) return 1;
  if (p.kind === 'area' || p.kind === 'camp' || p.kind === 'restore') return 2;
  if (p.kind === 'ruin' || p.kind === 'building') return 3;
  if (p.kind === 'npc') return 4;
  return 5;
}

/** A small token for a place: a shape before a glyph, because the chart is drawn at 7 px a tile. */
function token(p: MapPlace, x: number, y: number, selected: boolean): string {
  const fill = p.stall ? GOLD : p.id === STALL_SLOT ? GOLD_DARK : KIND_FILL[p.kind];
  const ring = selected ? `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="${CREAM}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="12" fill="none" stroke="${INK}" stroke-width="1"/>` : '';
  if (p.stall) {
    // the stall is an awning, not a pin: the one thing on the chart a player may move
    return `${ring}<g transform="translate(${x} ${y})"><rect x="-9" y="-6" width="18" height="12" fill="${fill}" stroke="${INK}" stroke-width="2"/><path d="M-11 -6 H11 L8 1 H-8 Z" fill="${CREAM}" stroke="${INK}" stroke-width="1.5"/><path d="M-6 6 V10 M6 6 V10" stroke="${INK}" stroke-width="1.5"/></g>`;
  }
  if (p.id === STALL_SLOT) {
    // before it is placed: a marked empty corner, not a stall that is already there
    return `${ring}<circle cx="${x}" cy="${y}" r="8" fill="${CREAM}" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4" fill="${GOLD}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  if (p.kind === 'camp') {
    return `${ring}<path d="M${x - 9} ${y + 7} L${x} ${y - 9} L${x + 9} ${y + 7} Z" fill="${fill}" stroke="${INK}" stroke-width="2"/>`;
  }
  if (p.kind === 'restore') {
    return `${ring}<g transform="translate(${x} ${y})"><path d="M-9 -3 H9 M-9 3 H9" stroke="${INK}" stroke-width="4"/><path d="M-9 -3 H9 M-9 3 H9" stroke="${fill}" stroke-width="2"/><path d="M-6 -6 V6 M6 -6 V6" stroke="${INK}" stroke-width="1.5"/></g>`;
  }
  if (p.kind === 'ruin') {
    return `${ring}<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="${fill}" stroke="${INK}" stroke-width="2"/><path d="M${x - 3} ${y - 7} V${y - 1} H${x + 3} V${y + 7}" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
  }
  if (p.kind === 'building') {
    return `${ring}<rect x="${x - 7}" y="${y - 5}" width="14" height="12" fill="${fill}" stroke="${INK}" stroke-width="2"/><path d="M${x - 9} ${y - 5} L${x} ${y - 12} L${x + 9} ${y - 5}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  }
  const r = p.kind === 'area' ? 7 : 6;
  return `${ring}<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="2"/>`;
}

export function mapSvg(b: Bundle, o: MapDraw): string {
  if (o.compact) return miniSvg(b, o);
  const W = b.map.width;
  const H = b.map.height;
  const S = 10;
  const places = mapPlaces(b, o.seen, o.at, o.stall);
  const named = places.filter((p) => p.label !== undefined).sort((a, c) => rank(a) - rank(c));
  const names = named.map((p) => (p.stall ? 'your stall' : p.label!));
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * S} ${H * S}" role="img" aria-label="${esc(
      `A chart of the valley: ${names.length ? names.join(', ') : 'nothing walked yet'}${o.stall ? ', with your stall at the empty corner' : ''}.`,
    )}">`,
  ];

  // the walked ground: 8x8 chunks, drawn tile by tile so rivers and roads keep their shape
  parts.push('<g shape-rendering="crispEdges">');
  for (const key of o.chunks) {
    const at = chunkAt(key);
    if (!at) continue;
    const [cx, cy] = at;
    if (cx < 0 || cy < 0 || cx * MAP_CHUNK >= W || cy * MAP_CHUNK >= H) continue;
    const end = Math.min(W, (cx + 1) * MAP_CHUNK);
    for (let y = cy * MAP_CHUNK; y < Math.min(H, (cy + 1) * MAP_CHUNK); y++) {
      let runStart = -1;
      let runFill = '';
      for (let x = cx * MAP_CHUNK; x <= end; x++) {
        const tag = x < end ? tagAt(b.map, x, y) : undefined;
        const fill = tag ? (TERRAIN[tag] ?? '#c99a5e') : '';
        if (fill !== runFill) {
          if (runStart >= 0 && runFill) parts.push(`<rect x="${runStart * S}" y="${y * S}" width="${(x - runStart) * S}" height="${S}" fill="${runFill}" opacity=".42"/>`);
          runStart = x;
          runFill = fill;
        }
      }
    }
  }
  parts.push('</g>');

  // the few built things a chart would mark: a roof, a well, a trader's awning
  for (const prop of b.map.props) {
    const cx = prop.x + prop.w / 2;
    const cy = prop.y + prop.h / 2;
    if (!o.chunks.has(chunkKey(cx, cy))) continue;
    const ref = prop.sprite.split(':').pop() ?? '';
    const x = cx * S;
    const y = cy * S;
    if (ref.includes('house')) {
      parts.push(
        `<g transform="translate(${x} ${y})"><rect x="-7" y="-4" width="14" height="11" fill="#ebd3a2" stroke="${INK}" stroke-width="1.6"/><path d="M-10 -4 L0 -12 L10 -4" fill="#6e4226" stroke="${INK}" stroke-width="1.6"/></g>`,
      );
    } else if (ref.includes('well')) {
      parts.push(`<circle cx="${x}" cy="${y}" r="5" fill="#3f8fd1" stroke="${INK}" stroke-width="1.6"/>`);
    } else if (ref.includes('market_stall')) {
      parts.push(
        `<g transform="translate(${x} ${y})"><path d="M-8 -5 H8 L6 1 H-6 Z" fill="#a8302f" stroke="${INK}" stroke-width="1.3"/><path d="M-6 1 V7 M6 1 V7" stroke="${INK}" stroke-width="1.3"/></g>`,
      );
    } else if (ref.includes('ruin_pillar') || ref.includes('ruin_wall')) {
      parts.push(`<rect x="${x - 6}" y="${y - 4}" width="12" height="8" fill="#5d6177" stroke="${INK}" stroke-width="1.4"/>`);
    }
  }

  // one wash of paper over the whole chart: the ground is drawn in the core colours, then
  // faded into the sheet, so the pins and names are what the eye reads first
  parts.push(`<rect width="${W * S}" height="${H * S}" fill="${PAPER}" opacity=".24"/>`);

  // a quiet mark on the paper the walk has not reached yet
  const chunksAcross = Math.ceil(W / MAP_CHUNK);
  const chunksDown = Math.ceil(H / MAP_CHUNK);
  if (o.chunks.size < chunksAcross * chunksDown) {
    parts.push(
      `<g transform="translate(${W * S / 2} ${H * S * 0.8}) rotate(-6)" opacity=".32"><text text-anchor="middle" font-family="Atkinson Hyperlegible Next, sans-serif" font-size="13" font-weight="700" letter-spacing="2" fill="#6e4226">NOT YET WALKED</text></g>`,
    );
  }

  // the names the chart can fit; the list has the rest
  const boxes: Box[] = [];
  const placeLabel = (text: string, x: number, y: number, preferred: 'above' | 'below' = 'above'): boolean => {
    const w = Math.min(150, text.length * 7.6 + 8);
    const h = 16;
    const spots: [number, number][] =
      preferred === 'above'
        ? [[0, -14], [0, 20], [28, 4], [-28, 4], [0, -28], [0, 34]]
        : [[0, 20], [0, -14], [28, 4], [-28, 4], [0, 34], [0, -28]];
    for (const [dx, dy] of spots) {
      const bx = Math.max(w / 2 + 4, Math.min(W * S - w / 2 - 4, x + dx));
      const by = Math.max(h / 2 + 4, Math.min(H * S - h / 2 - 4, y + dy));
      const box = { x: bx - w / 2, y: by - h / 2, w, h };
      if (boxes.some((other) => overlaps(box, other))) continue;
      boxes.push(box);
      parts.push(
        `<text x="${bx}" y="${by + 5}" text-anchor="middle" font-family="Atkinson Hyperlegible Next, sans-serif" font-size="15" font-weight="700" fill="${INK}" stroke="${PAPER}" stroke-width="4" paint-order="stroke">${esc(text)}</text>`,
      );
      return true;
    }
    return false;
  };

  for (const p of places) {
    const isStall = p.stall || p.id === STALL_SLOT;
    if (p.current && !isStall) continue;
    // the player's pin stands on the same tile as the stall when they are at it:
    // move the awning aside and keep a leader to the corner, so both stay readable
    const dx = isStall && p.current ? 20 : 0;
    const dy = isStall && p.current ? 14 : 0;
    if (dx || dy) {
      parts.push(`<path d="M${p.x * S} ${p.y * S} L${p.x * S + dx} ${p.y * S + dy}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 3"/>`);
    }
    parts.push(token(p, p.x * S + dx, p.y * S + dy, o.selected === p.id));
  }

  // the player is a pin on the tile they stand on, not on the slot's centre
  const px = o.at[0] * S + S / 2;
  const py = o.at[1] * S + S / 2;
  parts.push(
    `<g transform="translate(${px} ${py})"><path d="M0 0 C-10 -12 -14 -19 -14 -25 A14 14 0 1 1 14 -25 C14 -19 10 -12 0 0 Z" fill="${RED}" stroke="${INK}" stroke-width="2.2"/><circle cx="0" cy="-25" r="5" fill="${CREAM}" stroke="${INK}" stroke-width="1.6"/></g>`,
  );

  // names: the stall and the place under the player first, then the rest
  for (const p of named) {
    const isStall = p.stall || p.id === STALL_SLOT;
    const dx = isStall && p.current ? 20 : 0;
    const dy = isStall && p.current ? 14 : 0;
    const text = p.stall ? 'Your stall' : p.label!;
    const lx = p.stall && p.current ? p.x * S + 20 : p.x * S + dx;
    const ly = p.stall && p.current ? p.y * S + 18 : p.y * S + dy;
    placeLabel(text, lx, ly, p.stall || p.current ? 'below' : 'above');
  }
  if (!named.some((p) => p.current)) {
    // the pin has no place name: it is on the road
    placeLabel('You', px, py, 'below');
  }

  // compass and frame
  parts.push(
    `<g transform="translate(${W * S - 34} ${H * S - 38})" opacity=".9"><circle r="19" fill="${PAPER}" fill-opacity=".7" stroke="#6e4226" stroke-width="2"/><path d="M0 -17 L5 0 L0 17 L-5 0 Z" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="1.2"/><path d="M-17 0 L0 -4 L17 0 L0 4 Z" fill="#6e4226" opacity=".5"/><text y="-24" text-anchor="middle" font-family="Atkinson Hyperlegible Next, sans-serif" font-size="12" font-weight="700" fill="#6e4226">N</text></g>`,
    `<rect x="5" y="5" width="${W * S - 10}" height="${H * S - 10}" fill="none" stroke="#6e4226" stroke-width="2" stroke-opacity=".55"/>`,
  );
  parts.push('</svg>');
  return parts.join('');
}

/** The pocket chart: ground as chunks, the player and the stall; no names, because there is no room. */
function miniSvg(b: Bundle, o: MapDraw): string {
  const W = b.map.width;
  const H = b.map.height;
  const S = 10;
  const places = mapPlaces(b, o.seen, o.at, o.stall);
  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * S} ${H * S}" role="img" aria-label="A small chart of the valley">`];
  parts.push('<g shape-rendering="crispEdges">');
  for (const key of o.chunks) {
    const at = chunkAt(key);
    if (!at) continue;
    const [cx, cy] = at;
    if (cx < 0 || cy < 0 || cx * MAP_CHUNK >= W || cy * MAP_CHUNK >= H) continue;
    const tag = tagAt(b.map, cx * MAP_CHUNK + 4, cy * MAP_CHUNK + 4);
    const fill = tag ? (TERRAIN[tag] ?? '#c99a5e') : '#c99a5e';
    parts.push(
      `<rect x="${cx * MAP_CHUNK * S}" y="${cy * MAP_CHUNK * S}" width="${Math.min(MAP_CHUNK, W - cx * MAP_CHUNK) * S}" height="${Math.min(MAP_CHUNK, H - cy * MAP_CHUNK) * S}" fill="${fill}" opacity=".5"/>`,
    );
  }
  parts.push('</g>');
  for (const p of places) {
    if (p.current || p.id === STALL_SLOT || p.stall) continue;
    parts.push(`<circle cx="${p.x * S}" cy="${p.y * S}" r="7" fill="${KIND_FILL[p.kind]}" stroke="${INK}" stroke-width="2"/>`);
  }
  if (o.stall) {
    const slot = b.map.slots.find((s) => s.id === o.stall);
    if (slot) {
      const sx = (slot.x + slot.w / 2) * S;
      const sy = (slot.y + slot.h / 2) * S;
      const atStall = places.some((p) => p.current && (p.stall || p.id === STALL_SLOT));
      if (atStall) parts.push(`<circle cx="${sx}" cy="${sy}" r="18" fill="none" stroke="${GOLD}" stroke-width="4"/>`);
      else parts.push(`<rect x="${sx - 9}" y="${sy - 9}" width="18" height="18" fill="${GOLD}" stroke="${INK}" stroke-width="2.5"/>`);
    }
  }
  parts.push(`<circle cx="${o.at[0] * S + S / 2}" cy="${o.at[1] * S + S / 2}" r="12" fill="${RED}" stroke="${INK}" stroke-width="3"/>`);
  parts.push(`<rect x="5" y="5" width="${W * S - 10}" height="${H * S - 10}" fill="none" stroke="#6e4226" stroke-width="3" stroke-opacity=".6"/>`);
  parts.push('</svg>');
  return parts.join('');
}

/** The place's kind, in the list's words. */
export function placeKind(p: MapPlace): string {
  return PLACE_KIND[p.kind];
}

/** The pocket chart for the desktop's corner. */
export function miniMapSvg(b: Bundle, o: MapDraw): string {
  return miniSvg(b, o);
}
