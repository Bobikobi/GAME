/**
 * pnpm valley:inventory - one row per thing a player meets in the valley, and the state of its art as the repo says it
 * (Track #899: the valley stage exits when everything a player meets is built at final quality; this turns "not done" into a count).
 *
 * Rows come from the content and the kit, never from a hand list: every prop, node, stone, creature spot and ground sprite
 * of the valley map (`content/core/map.json`, `core/world`), every NPC, camp, restore and passage, every item that something
 * gives, makes or sells, every quest, every clip the figure and the creatures can play, and every sound the game makes.
 * Nothing here judges quality: a state is what the repo says.
 *
 * Art states (`State`):
 *   16px        the sprite is drawn at 16 px a tile (density 1); the core kit's own waiting list is `SIXTEEN_PX_LEFT`
 *   rich        drawn at 64 art px a tile (density 4)
 *   drawn clip  a sheet that plays a clip (a verb's take or a walk cycle), with its frame count
 *   code-drawn  no sheet: the code draws it (a figure with no clip for a verb keeps its walk sheet or code-drawn motion,
 *               game/src/clips.ts)
 *   missing     the thing needs art and nothing in the repo supplies it (a reference that does not resolve, a PNG that is not
 *               on disk, a creature with no still and no clip)
 *   n/a         no art to speak of: a quest, a restore's rule, a sound. Not counted
 * `where`: `x,y` a tile (`x,y WxH` an area), `N tiles` ground a sprite covers, `carried` an item (no fixed tile),
 * `-` a thing with no tile (a quest with no giver, a sound, a clip).
 *
 * Not covered by a row, said so the count is not read as complete: the worn sets' sheets (`chars/<race>_<set>_*`), the shop
 * room's interior, the title and the UI frames, and the painted engine's blended ground. `sixteen_px_left` in the JSON says
 * which names on `SIXTEEN_PX_LEFT` no row reaches, so an understated `16px` count is visible.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSlot, npcTile, type Bundle } from '@game/kernel';
import { CLIP_VERBS, CLIP_VIEWS, CREATURE_CLIP_VERBS, CUES } from '@game/schema';
import { jingles, songs } from '../../game/src/audio/songs';
import { BED_IDS } from '../../game/src/audio/beds';
import { CUE_LOOK } from '../../game/src/cues';
import { DIG_SPOT_SPRITE, FOG_SPRITE } from '../../game/src/config';
import { emptySlots } from '../../game/src/places';
import { canopyGroups } from '../../game/src/richground';
import type { Assembled } from './assemble';
import { rewardItems } from './play';
import { REPO_ROOT } from './load';
import { SIXTEEN_PX_LEFT } from './kit/rich';

export const STATES = ['16px', 'rich', 'drawn clip', 'code-drawn', 'missing', 'n/a'] as const;
export type State = (typeof STATES)[number];
/** The states that count as art; a row in `n/a` is listed and never counted. */
export const COUNTED: readonly State[] = ['16px', 'rich', 'drawn clip', 'code-drawn', 'missing'];

export interface Row {
  id: string;
  kind: string;
  where: string;
  state: State;
  /** frames of the sheet, when it has more than one */
  frames: number | null;
  /** what else to know: the sprite it resolves to, a how-it-is-had line */
  note: string;
  /** the content file that declares the thing */
  source: string;
  /** the PNG that draws it, when there is one */
  sheet: string | null;
}

export interface Inventory {
  rows: Row[];
  counts: Record<string, number>;
  /** counts per kind, then per state */
  byKind: Record<string, Record<string, number>>;
  sixteen_px_left: { total: number; reached: number; not_reached: string[] };
  /** items nothing gives, makes or sells: not met in the valley, so not rows */
  unsourced_items: string[];
}

export interface Reads {
  /** whether a file exists on disk; the default asks the file system */
  fileExists?: (abs: string) => boolean;
  /** the text of game/src/audio/sfx.ts; the default reads it */
  sfxSource?: string;
  /** the repo's root, where the kits and sources are named from */
  root?: string;
}

type Kits = Assembled['kits'];

function splitRef(ref: string): [string, string] {
  const i = ref.indexOf(':');
  return [ref.slice(0, i), ref.slice(i + 1)];
}

interface Art {
  state: State;
  frames: number | null;
  note: string;
  sheet: string | null;
}

/** The state of one sprite reference (`kit:name`) as the kit and the disk say it. */
export function artOf(kits: Kits, ref: string | undefined, reads: Reads = {}): Art {
  if (!ref) return { state: 'missing', frames: null, note: 'no sprite named', sheet: null };
  const [kitId, name] = splitRef(ref);
  const kit = kits[kitId];
  const s = kit?.sprites[name];
  if (!kit || !s) return { state: 'missing', frames: null, note: `${ref}: not in a kit`, sheet: null };
  const sheet = `${kit.rel}/${s.file}`;
  const exists = reads.fileExists ?? existsSync;
  if (!exists(join(kit.dir, s.file))) return { state: 'missing', frames: s.frames > 1 ? s.frames : null, note: `${ref}: the PNG is not on disk`, sheet };
  const frames = s.frames > 1 ? s.frames : null;
  if (s.clip || s.creature_clip || s.stride) return { state: 'drawn clip', frames: s.frames, note: ref, sheet };
  // a creature's fallback still (kit `still_of`): the world draws the creature from its sheets when they all load (DECISIONS 2026-11-27), so the still shows only when one is missing
  if (s.still_of) {
    const sheets = Object.values(kits).flatMap((k) => Object.values(k.sprites).filter((o) => o.creature_clip?.creature === s.still_of).map((o) => ({ k, o })));
    if (sheets.length > 0 && sheets.every(({ k, o }) => exists(join(k.dir, o.file)))) {
      return { state: 'drawn clip', frames: Math.max(...sheets.map(({ o }) => o.frames)), note: `${ref}; drawn from ${sheets.length} sheets of ${s.still_of}, this still is the fallback`, sheet };
    }
  }
  // the core kit's redraw list is the one place 16 px is allowed; a 16 px sprite elsewhere is `16px` too (the check refuses it)
  if ((s.density ?? 1) === 1) return { state: '16px', frames, note: ref, sheet };
  return { state: 'rich', frames, note: ref, sheet };
}

const rowOf = (id: string, kind: string, where: string, art: Pick<Art, 'state' | 'frames' | 'note' | 'sheet'>, source: string, note?: string): Row => ({
  id,
  kind,
  where,
  state: art.state,
  frames: art.frames,
  note: note === undefined ? art.note : art.note && art.note !== note ? `${note}; ${art.note}` : note,
  source,
  sheet: art.sheet,
});

const noArt = (id: string, kind: string, where: string, source: string, note: string, state: State = 'n/a'): Row => ({ id, kind, where, state, frames: null, note, source, sheet: null });

const tile = (x: number, y: number, w = 1, h = 1): string => (w === 1 && h === 1 ? `${x},${y}` : `${x},${y} ${w}x${h}`);

/** The ids of `export type SfxId = ...` and the ids `playSfx` has a `case` for, read from the source. */
export function sfxIdsOf(source: string): { ids: string[]; cased: Set<string> } {
  const start = source.indexOf('export type SfxId');
  const end = start < 0 ? -1 : source.indexOf(';', start);
  const ids = start < 0 || end < 0 ? [] : [...source.slice(start, end).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
  const cased = new Set([...source.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]!));
  return { ids, cased };
}

const SIDES: readonly [string, number, number][] = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];
const baseName = (ref: string): string => ref.split('/').pop() ?? ref;
const kitPrefix = (ref: string): string => ref.slice(0, ref.indexOf(':') + 1);

/**
 * The ground-edge sprites the world lays over the map: bank, fringe, worn and shore pieces by the neighbour's tag, counted by
 * tile. The rule is game/src/scenes/world.ts `drawEdges` (the plain, un-blended branch); a change there changes this, and
 * tools/test/valley-inventory.test.ts holds the rule to the real map.
 */
export function edgeCounts(b: Bundle): Map<string, number> {
  const m = b.map;
  const out = new Map<string, number>();
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const t = m.legend[m.ground[y]?.[x] ?? ''];
      if (!t) continue;
      const floor = t.tag === 'ruin' && baseName(t.sprite) === 'ruin_floor';
      const kind = t.tag === 'water' ? 'bank' : t.tag === 'path' || t.tag === 'town' || t.tag === 'riverbank' || floor ? 'fringe' : t.tag === 'meadow' ? 'worn' : undefined;
      if (!kind) continue;
      const kit = kitPrefix(t.sprite);
      for (const [side, dx, dy] of SIDES) {
        const near = m.legend[m.ground[y + dy]?.[x + dx] ?? ''];
        if (!near) continue;
        let ref: string | undefined;
        if (kind === 'bank' && near.tag !== 'water') ref = `${kit}tiles/bank_${side}`;
        else if (kind === 'fringe' && (near.tag === 'meadow' || near.tag === 'grove')) ref = `${kit}tiles/fringe_${side}`;
        else if (kind === 'worn' && near.tag === 'path') ref = `${kit}tiles/worn_${side}`;
        else if (t.tag === 'riverbank' && near.tag === 'water') ref = `${kit}tiles/shore_${side}`;
        if (!ref || !b.sprites[ref]) continue;
        out.set(ref, (out.get(ref) ?? 0) + 1);
      }
    }
  }
  return out;
}

/** The sprite a dig spot shows: its first find's picture when it is found by hand, the dig-spot mark when a tool digs (world.ts, the instances loop). */
function digSprite(b: Bundle, source: string): string {
  const t = b.treasures[source];
  return t && !t.tool ? (b.items[t.finds[0]!.item]?.sprite ?? DIG_SPOT_SPRITE) : DIG_SPOT_SPRITE;
}

/** Items some source gives, with the sources named: found, made, bought, a quest's reward, a pocket's ground, a creature's drop. */
export function itemSources(b: Bundle): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (item: string | undefined, how: string) => {
    if (item === undefined) return;
    if (!out.has(item)) out.set(item, new Set());
    out.get(item)!.add(how);
  };
  for (const r of Object.values(b.resources)) add(r.output, 'gathered');
  for (const t of Object.values(b.treasures)) for (const f of t.finds) add(f.item, 'dug');
  for (const s of Object.values(b.searchables)) for (const r of s.rows) add(r.item, 'searched');
  for (const c of Object.values(b.recipes)) for (const o of c.outputs) add(o.item, 'made');
  for (const s of Object.values(b.shops)) for (const o of s.sells) add(o.item, 'bought');
  for (const q of Object.values(b.quests)) for (const i of rewardItems([q.reward])) add(i, 'quest reward');
  for (const e of Object.values(b.expeditions)) for (const i of rewardItems([e.reward])) add(i, 'expedition reward');
  for (const p of Object.values(b.pockets)) for (const g of p.ground ?? []) add(g.item, 'wake ground');
  for (const k of Object.values(b.map.creatures?.kinds ?? {})) for (const d of k.hunt?.drops ?? []) add(d.item, 'hunted');
  return out;
}

function sixteenCheck(rows: Row[]): Inventory['sixteen_px_left'] {
  const reached = new Set<string>();
  for (const r of rows) {
    for (const m of r.note.matchAll(/:((?:tiles|props|chars|items|creatures)\/[A-Za-z0-9_-]+)/g)) reached.add(m[1]!);
  }
  const hit = SIXTEEN_PX_LEFT.filter((n) => reached.has(n));
  return { total: SIXTEEN_PX_LEFT.length, reached: hit.length, not_reached: SIXTEEN_PX_LEFT.filter((n) => !reached.has(n)) };
}

function count(rows: Row[]): Pick<Inventory, 'counts' | 'byKind'> {
  const counts: Record<string, number> = Object.fromEntries(STATES.map((s) => [s, 0]));
  const byKind: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    counts[r.state] = (counts[r.state] ?? 0) + 1;
    const k = (byKind[r.kind] ??= Object.fromEntries(STATES.map((s) => [s, 0])));
    k[r.state] = (k[r.state] ?? 0) + 1;
  }
  return { counts, byKind };
}

/** Walk-sheet references of a race: the `down` sheet names the others (`_up`, `_left`) by its suffix. */
function viewSheets(ref: string): [string, string][] {
  const m = /^(.*)_down$/.exec(ref);
  return m ? [['front', ref], ['back', `${m[1]}_up`], ['left', `${m[1]}_left`]] : [['front', ref]];
}

export function buildInventory(a: Assembled, reads: Reads = {}): Inventory {
  const b = a.bundle;
  if (!b) throw new Error('The content does not assemble; run "pnpm check" first.');
  const kits = a.kits;
  const art = (ref: string | undefined) => artOf(kits, ref, reads);
  const mapFile = a.origin[b.map.id] ?? 'content/core/map.json';
  const originOf = (id: string): string => a.origin[id] ?? mapFile;
  const rows: Row[] = [];
  const m = b.map;

  // --- the ground: one row per sprite the legend lays, and the edges and crowns the world lays over it
  const legendCount = new Map<string, { n: number; tags: Set<string> }>();
  for (const line of m.ground) {
    for (const ch of line) {
      const t = m.legend[ch];
      if (!t) continue;
      const e = legendCount.get(t.sprite) ?? { n: 0, tags: new Set() };
      e.n += 1;
      e.tags.add(t.tag);
      legendCount.set(t.sprite, e);
    }
  }
  for (const [ref, e] of [...legendCount].sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    rows.push(rowOf(ref, 'tile', `${e.n} tiles`, art(ref), mapFile, [...e.tags].sort().join('/')));
  }
  for (const [ref, n] of [...edgeCounts(b)].sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    rows.push(rowOf(ref, 'edge', `${n} tile sides`, art(ref), mapFile, 'laid over the ground by game/src/scenes/world.ts drawEdges'));
  }
  const forest = Object.values(m.legend).find((t) => t.tag === 'grove' && t.solid);
  if (forest) {
    const crowns = canopyGroups(m.width, m.height, (x, y) => m.legend[m.ground[y]?.[x] ?? '']?.sprite === forest.sprite);
    const by = new Map<number, number>();
    for (const c of crowns) by.set(c.i, (by.get(c.i) ?? 0) + 1);
    for (const [i, n] of [...by].sort((p, q) => p[0] - q[0])) {
      rows.push(rowOf(`${kitPrefix(forest.sprite)}props/canopy_${i + 1}`, 'canopy', `${n} crowns`, art(`${kitPrefix(forest.sprite)}props/canopy_${i + 1}`), mapFile, 'one over each block of four forest tiles'));
    }
  }

  // --- the mist over the slots nothing fills (world.ts buildFog): one baked sprite, drawn over each
  const fogSlots = emptySlots(b);
  if (fogSlots.length > 0) rows.push(rowOf(FOG_SPRITE, 'fog', `${fogSlots.length} slots`, art(FOG_SPRITE), mapFile, 'baked into a soft patch over each slot nothing fills'));

  // --- placed props
  const seen = new Map<string, number>();
  const unique = (id: string): string => {
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return n === 1 ? id : `${id}#${n}`;
  };
  for (const p of m.props) {
    const base = p.id ?? `${p.sprite.slice(p.sprite.indexOf(':') + 1)}@${p.x},${p.y}`;
    const tags = [p.hazard ? `hazard ${p.hazard.kind}` : '', p.fire ? 'fire' : '', p.sign ? 'sign' : '', p.note ? 'note' : '', p.crossing ? 'crossing' : ''].filter(Boolean).join(', ');
    rows.push(rowOf(unique(base), 'prop', tile(p.x, p.y, p.w, p.h), art(p.sprite), mapFile, tags || undefined));
  }
  // cover the plan scatters over a region: the sprite and the region, counted by the plan's own weights
  for (const r of m.plan?.regions ?? []) {
    for (const ref of Object.keys(r.cover ?? {}).sort()) {
      rows.push(rowOf(unique(`${r.id}/${baseName(ref)}`), 'cover', `region ${r.id}`, art(ref), mapFile, `scattered ${r.cover![ref]}`));
    }
  }

  // --- nodes (gathered plants and trees, dig spots) and the stages a node passes through
  for (const [id, inst] of Object.entries(b.instances).sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    if (inst.kind === 'resource') {
      const r = b.resources[inst.source];
      rows.push(rowOf(id, 'node', tile(inst.x, inst.y), art(r?.sprite), originOf(inst.source), r ? `gives ${r.output}` : 'resource not found'));
    } else {
      const t = b.treasures[inst.source];
      const ref = digSprite(b, inst.source);
      rows.push(rowOf(id, 'dig spot', tile(inst.x, inst.y), art(ref), originOf(inst.source), t?.tool ? `dug with ${t.tool}` : 'found by hand'));
    }
  }
  for (const r of Object.values(b.resources).sort((p, q) => (p.id < q.id ? -1 : 1))) {
    const placed = Object.values(b.instances).filter((i) => i.source === r.id).length;
    if (placed === 0) continue;
    for (const [role, ref] of [['empty', r.sprite_empty], ...(r.growth ?? []).map((g, i) => [`growth ${i + 1}`, g] as const)] as [string, string | undefined][]) {
      if (ref) rows.push(rowOf(`${r.id}:${role}`, 'node stage', `${placed} nodes`, art(ref), originOf(r.id)));
    }
  }

  // --- stones the map lays on the ground
  for (const s of m.stones?.spots ?? []) {
    rows.push(rowOf(unique(`${s.kind}@${s.x},${s.y}`), 'stone', tile(s.x, s.y), art(b.params.liftables[s.kind]?.sprite), mapFile, s.kind));
  }

  // --- people and creatures
  for (const [id, n] of Object.entries(b.npcs).sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    const t = npcTile(b, id);
    rows.push(rowOf(id, 'npc', t ? tile(t[0], t[1]) : '-', art(n.sprite), originOf(id)));
    // a blink sheet beside the figure replaces its image when it exists (world.ts, the NPC loop)
    const blink = `${n.sprite}_blink`;
    if (kits[splitRef(blink)[0]]?.sprites[splitRef(blink)[1]]) rows.push(rowOf(`${id}:blink`, 'npc clip', t ? tile(t[0], t[1]) : '-', art(blink), originOf(id)));
  }
  const creatureArt = (kind: string): Art => {
    const still = Object.entries(kits).flatMap(([kitId, k]) => Object.entries(k.sprites).filter(([name, s]) => s.still_of === kind || name === `creatures/${kind.slice(kind.indexOf('/') + 1)}`).map(([name]) => `${kitId}:${name}`))[0];
    const clip = Object.entries(kits).flatMap(([kitId, k]) => Object.entries(k.sprites).filter(([, s]) => s.creature_clip?.creature === kind).map(([name]) => `${kitId}:${name}`))[0];
    if (still) return art(still);
    if (clip) return art(clip);
    return { state: 'missing', frames: null, note: 'no still (still_of or creatures/<name>) and no creature clip in a kit', sheet: null };
  };
  for (const [i, s] of (m.creatures?.spots ?? []).entries()) {
    const kind = m.creatures!.kinds[s.kind];
    rows.push(rowOf(unique(`${s.kind}@${s.x},${s.y}`), 'creature', tile(s.x, s.y), creatureArt(s.kind), mapFile, `spot ${i}, ${kind?.look ?? '?'}`));
  }

  // --- what is built or mended on the map: camps, restores, passages
  const campSlot = m.slots.find((s) => s.kind === 'camp');
  for (const c of Object.values(b.camps).sort((p, q) => (p.id < q.id ? -1 : 1))) {
    rows.push(rowOf(c.id, 'camp', campSlot ? tile(campSlot.x, campSlot.y, campSlot.w, campSlot.h) : '-', art(c.sprite), originOf(c.id), c.slot));
  }
  for (const r of Object.values(b.restores).sort((p, q) => (p.id < q.id ? -1 : 1))) {
    const slot = 'slot' in r.place ? findSlot(m, r.place.slot) : undefined;
    const where = slot ? tile(slot.x, slot.y, slot.w, slot.h) : '-';
    rows.push(rowOf(`${r.id}:before`, 'restore', where, art(r.before), originOf(r.id)));
    rows.push(rowOf(`${r.id}:after`, 'restore', where, art(r.after), originOf(r.id)));
  }
  for (const p of Object.values(b.passages).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    rows.push(noArt(p.id, 'passage', '-', originOf(p.id), `by sea from ${p.from}, ${p.segments} segments`));
  }

  // --- items: every one something gives, makes or sells
  const sources = itemSources(b);
  const unsourced: string[] = [];
  for (const [id, it] of Object.entries(b.items).sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    const how = sources.get(id);
    if (!how) {
      unsourced.push(id);
      continue;
    }
    rows.push(rowOf(id, 'item', 'carried', art(it.sprite), it.file, [...how].sort().join(', ')));
  }

  // --- quests: given at their giver's tile, or at the wake tile of the pocket that starts them
  for (const q of Object.values(b.quests).sort((p, q2) => (p.id < q2.id ? -1 : 1))) {
    const t = q.giver ? npcTile(b, q.giver) : undefined;
    const pocket = q.pocket ? b.pockets[q.pocket] : undefined;
    const where = t ? tile(t[0], t[1]) : pocket?.wake ? tile(pocket.wake.x, pocket.wake.y) : '-';
    rows.push(noArt(q.id, 'quest', where, q.file, [q.type ?? '', q.giver ? `given by ${q.giver}` : pocket ? `wake pocket ${q.pocket}` : 'no giver'].filter(Boolean).join(', ')));
  }

  // --- clips: the figure's, race by race, and the creatures'
  const clipSheets = new Map<string, string>();
  const creatureClips = new Map<string, string>();
  for (const [kitId, k] of Object.entries(kits)) {
    for (const [name, s] of Object.entries(k.sprites)) {
      if (s.clip && (s.clip.take ?? 1) === 1) clipSheets.set(`${s.clip.verb}|${s.clip.race}|${s.clip.view}`, `${kitId}:${name}`);
      if (s.creature_clip) creatureClips.set(`${s.creature_clip.creature}|${s.creature_clip.verb}|${s.creature_clip.view}`, `${kitId}:${name}`);
    }
  }
  for (const race of Object.values(b.races).sort((p, q) => (p.id < q.id ? -1 : 1))) {
    for (const [label, base] of [['walk', race.sprite], ...(race.sprite_alt ? [['walk-alt', race.sprite_alt] as [string, string]] : [])] as [string, string][]) {
      const [kitId, name] = splitRef(base);
      for (const [view, sheet] of viewSheets(name)) {
        rows.push(rowOf(`${race.id}:${label}:${view}`, 'figure clip', '-', art(`${kitId}:${sheet}`), originOf(race.id)));
      }
    }
    for (const verb of CLIP_VERBS) {
      for (const view of CLIP_VIEWS) {
        const ref = clipSheets.get(`${verb}|${race.id}|${view}`);
        const id = `${race.id}:${verb}:${view}`;
        if (ref) rows.push(rowOf(id, 'figure clip', '-', art(ref), originOf(race.id)));
        else rows.push(noArt(id, 'figure clip', '-', originOf(race.id), 'no sheet: the figure keeps its walk sheet or code-drawn motion', 'code-drawn'));
      }
    }
  }
  for (const kind of Object.keys(m.creatures?.kinds ?? {}).sort()) {
    for (const verb of CREATURE_CLIP_VERBS) {
      for (const view of CLIP_VIEWS) {
        const ref = creatureClips.get(`${kind}|${verb}|${view}`);
        const id = `${kind}:${verb}:${view}`;
        if (ref) rows.push(rowOf(id, 'creature clip', '-', art(ref), mapFile));
        else rows.push(noArt(id, 'creature clip', '-', mapFile, 'no clip: the creature keeps its still sprite', 'missing'));
      }
    }
  }

  // --- sounds: all made by code in game/src/audio; a sound the type names but playSfx has no case for is missing
  const sfxFile = 'game/src/audio/sfx.ts';
  const { ids, cased } = sfxIdsOf(reads.sfxSource ?? readFileSync(join(reads.root ?? REPO_ROOT, sfxFile), 'utf8'));
  for (const id of [...ids].sort()) {
    rows.push(cased.has(id) ? noArt(`sfx:${id}`, 'sound', '-', sfxFile, 'synthesized') : noArt(`sfx:${id}`, 'sound', '-', sfxFile, 'named in SfxId, no case in playSfx', 'missing'));
  }
  for (const id of Object.keys(songs).sort()) rows.push(noArt(`song:${id}`, 'sound', '-', 'game/src/audio/songs.ts', 'a tune written as notes'));
  for (const id of Object.keys(jingles).sort()) rows.push(noArt(`jingle:${id}`, 'sound', '-', 'game/src/audio/songs.ts', 'a short tune written as notes'));
  for (const id of [...BED_IDS].sort()) rows.push(noArt(`bed:${id}`, 'sound', '-', 'game/src/audio/beds.ts', 'a bed that follows the player\'s distance'));
  const ambience = new Set((m.cards ?? []).flatMap((c) => Object.values(c.ambience ?? {})));
  for (const id of [...ambience].sort()) rows.push(noArt(`ambience:${id}`, 'sound', '-', mapFile, 'a region card\'s day or night air'));
  for (const id of [...CUES].sort()) rows.push(noArt(`cue:${id}`, 'sound', '-', 'game/src/cues.ts', `shape and sound: ${CUE_LOOK[id].sfx}`));

  // a stable order: kind, then id
  rows.sort((p, q) => (p.kind === q.kind ? (p.id < q.id ? -1 : p.id > q.id ? 1 : 0) : p.kind < q.kind ? -1 : 1));
  return { rows, ...count(rows), sixteen_px_left: sixteenCheck(rows), unsourced_items: unsourced.sort() };
}

/** The summary line: counts per state over the counted rows. */
export function summaryLine(inv: Inventory): string {
  const counted = inv.rows.filter((r) => COUNTED.includes(r.state)).length;
  const per = COUNTED.map((s) => `${inv.counts[s]} ${s}`).join(', ');
  return `${inv.rows.length} rows (${counted} with art, ${inv.counts['n/a']} n/a): ${per}`;
}

/** The `pnpm check` line. */
export function checkLine(inv: Inventory): string {
  return `valley inventory: ${summaryLine(inv)}; pnpm valley:inventory writes docs/design/VALLEY_INVENTORY.md`;
}

const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export const MD_PATH = 'docs/design/VALLEY_INVENTORY.md';
export const JSON_PATH = 'docs/design/VALLEY_INVENTORY.json';

export function renderMarkdown(inv: Inventory): string {
  const out: string[] = [];
  out.push('<!-- GENERATED by `pnpm valley:inventory`: do not edit by hand. Rerun the command to refresh it. -->');
  out.push('');
  out.push('# The valley inventory');
  out.push('');
  out.push('Generated by `pnpm valley:inventory` from the content and the kit (Track #899). One row per thing a player meets in the valley, and the state of its art as the repo says it. It does not judge quality. A JSON copy is beside it (`VALLEY_INVENTORY.json`).');
  out.push('');
  out.push(`**${summaryLine(inv)}**`);
  out.push('');
  out.push('| State | Meaning |');
  out.push('|---|---|');
  out.push('| `16px` | drawn at 16 px a tile; the core kit\'s own waiting list is `SIXTEEN_PX_LEFT` in `tools/src/kit/rich.ts` |');
  out.push('| `rich` | drawn at 64 art px a tile |');
  out.push('| `drawn clip` | a sheet that plays a clip or a walk cycle, with its frame count |');
  out.push('| `code-drawn` | no sheet: the figure keeps its walk sheet or code-drawn motion for that verb |');
  out.push('| `missing` | needs art and nothing in the repo supplies it: a reference that does not resolve, a PNG not on disk, a creature with no still and no clip, a sound with no case |');
  out.push('| `n/a` | no art to speak of (a quest, a passage, a sound); listed, never counted |');
  out.push('');
  out.push('`where`: `x,y` a tile (`x,y WxH` an area); `N tiles` the ground a sprite covers; `carried` an item, no fixed tile; `-` no tile (a quest with no giver, a sound, a clip).');
  out.push('');
  out.push('## Counts by kind');
  out.push('');
  out.push(`| kind | ${STATES.join(' | ')} | rows |`);
  out.push(`|---|${STATES.map(() => '---:').join('|')}|---:|`);
  for (const kind of Object.keys(inv.byKind).sort()) {
    const k = inv.byKind[kind]!;
    out.push(`| ${kind} | ${STATES.map((s) => k[s]).join(' | ')} | ${STATES.reduce((n, s) => n + (k[s] ?? 0), 0)} |`);
  }
  out.push('');
  out.push('## What the rows do not reach');
  out.push('');
  out.push(`- \`SIXTEEN_PX_LEFT\` holds ${inv.sixteen_px_left.total} names; ${inv.sixteen_px_left.reached} are reached by a row above. The other ${inv.sixteen_px_left.not_reached.length} are drawn by nothing the valley's content or map places (the old figures' sheets, edge pieces the shoreline does not use) and are listed in the JSON under \`sixteen_px_left.not_reached\`.`);
  out.push(`- ${inv.unsourced_items.length} items have no source in the content (nothing gives, makes or sells them), so they are not rows: see \`unsourced_items\` in the JSON.`);
  out.push('- Not covered: the worn sets\' sheets, the shop room\'s interior, the title and the UI frames, the painted engine\'s blended ground.');
  out.push('');
  out.push('## Rows');
  out.push('');
  out.push('| id | kind | where | art | note | source |');
  out.push('|---|---|---|---|---|---|');
  for (const r of inv.rows) {
    const art = r.state === 'drawn clip' && r.frames !== null ? `drawn clip, ${r.frames} frames` : r.state === 'rich' && r.frames !== null ? `rich, ${r.frames} frames` : r.state;
    out.push(`| ${cell(r.id)} | ${r.kind} | ${cell(r.where)} | ${art} | ${cell(r.note)} | ${cell(r.source)} |`);
  }
  out.push('');
  return out.join('\n');
}

export function renderJson(inv: Inventory): string {
  return `${JSON.stringify({ generated_by: 'pnpm valley:inventory', summary: summaryLine(inv), counts: inv.counts, by_kind: inv.byKind, sixteen_px_left: inv.sixteen_px_left, unsourced_items: inv.unsourced_items, rows: inv.rows }, null, 2)}\n`;
}
