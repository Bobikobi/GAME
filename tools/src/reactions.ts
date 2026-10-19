/**
 * The reaction rules of `pnpm check` (docs/design/REACTIONS.md, section 6). The schema already
 * holds the closed lists and the numbers (a reach of 8 at most, a wait inside 500-2000, a spread
 * of 2); this adds what needs the whole world: the thing a reaction hangs on exists, its
 * conditions fit that thing, an appear node is a fair node on a free tile, and a quicker respawn
 * never raises a rare node past its budget.
 *
 * Every phase-A condition comes back by itself (an hour, the night, a node left full, a tile, a
 * walk near, a find not yet seen, a day's roll), so an appear node is always a gate and never a
 * last chance (G42). A condition that could hold once and never again is a new condition, and
 * comes with its own check.
 */
import { type Bundle, activitiesOf, anchorsOf, appearSlots, inRect, staticSolid } from '@game/kernel';
import type { Issue } from './load';

export function checkReactions(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const bonus = new Set(activitiesOf(b).filter((a) => a.b > 0).map((a) => a.id));
  const solid = staticSolid(b.map);
  // the tiles taken by a placed node or spot, and by every appear node so far
  const taken = new Map<string, string>();
  for (const [id, inst] of Object.entries(b.instances)) taken.set(`${inst.x},${inst.y}`, id);

  for (const id of Object.keys(b.reactions).sort()) {
    const r = b.reactions[id]!;
    const err = (where: string, message: string) => issues.push({ file: origin[id] ?? r.file, where: `reaction.${where}`, message, level: 'error' });
    const on = r.on;
    const kind = 'resource' in on ? 'resource' : 'treasure' in on ? 'treasure' : 'tag';
    const source = 'resource' in on ? on.resource : 'treasure' in on ? on.treasure : undefined;
    if (kind === 'resource' && source !== '*' && !b.resources[source!]) err('on.resource', `no resource "${source}"`);
    if (kind === 'treasure' && source !== '*' && !b.treasures[source!]) err('on.treasure', `no treasure "${source}"`);
    if (anchorsOf(b, r).length === 0) err('on', 'hangs on nothing that is on the map');

    const w = r.when;
    if (w.ready_for_ms !== undefined && kind === 'tag') err('when.ready_for_ms', 'a tile is never full or empty: hang it on a resource or a treasure');
    if (w.unseen === true && kind !== 'treasure') err('when.unseen', 'only a treasure lies hidden: hang it on a treasure');
    if (w.on_tag !== undefined && kind === 'tag') err('when.on_tag', 'a reaction on a ground tag is on that tag already');

    const then = r.then;
    if ('appear' in then) {
      const n = then.appear;
      if (kind !== 'resource') err('then.appear', 'a node appears beside a resource node only, for now');
      if (!b.items[n.output]) err('then.appear.output', `no item "${n.output}" exists`);
      if (!b.sprites[n.sprite]) err('then.appear.sprite', `no sprite "${n.sprite}" in any kit`);
      if (n.active_ms < b.params.t_min_ms || n.active_ms > b.params.max_action_ms) {
        err('then.appear.active_ms', `active time ${n.active_ms} ms is outside [${b.params.t_min_ms}, ${b.params.max_action_ms}] ms`);
      }
      for (const slot of appearSlots(b).values()) {
        if (slot.reaction.id !== id) continue;
        const { x, y } = slot;
        const at = `${x},${y}`;
        if (x < 0 || y < 0 || x >= b.map.width || y >= b.map.height) {
          err('then.appear.at', `beside ${slot.parent.id} it would lie off the map`);
        } else if (solid[y * b.map.width + x]) {
          err('then.appear.at', `beside ${slot.parent.id} it would lie on solid ground (${at})`);
        } else if (taken.has(at)) {
          err('then.appear.at', `beside ${slot.parent.id} it would lie on ${taken.get(at)} (${at})`);
        } else if (b.map.slots.some((s) => s.kind === 'camp' && inRect(x, y, s))) {
          err('then.appear.at', `beside ${slot.parent.id} it would lie inside the camp (${at})`);
        } else {
          taken.set(at, slot.id);
        }
      }
    } else if ('wait' in then) {
      if (kind === 'tag') err('then.wait', 'a tile does not grow back: hang a wait on a resource or a treasure');
      // a quicker respawn of a node that carries a rarity bonus would spend the shared budget (kernel review 8.2)
      if (then.wait < 1000) {
        const quick = Object.keys(kind === 'resource' ? b.resources : b.treasures).filter((s) => (source === '*' || s === source) && bonus.has(s));
        if (quick.length > 0) err('then.wait', `a wait under 1000 would bring a rare node back sooner: ${quick.join(', ')}`);
      }
    }
  }
  return issues;
}

