/**
 * The play rules: what docs/design/GAME_RULES.md can test on content. Every
 * line cites its rule and the pattern's name so a creator can read why. They
 * are errors since the core content was rewritten to pass them (GRUNT P-3,
 * 8.10): a breach stops the check, core and extensions alike.
 */
import { campTile, findSlot, inRect, isSafeGround, makeWalkable, type Bundle, type QuestDef } from '@game/kernel';
import { QUEST_TYPES } from '@game/schema';
import type { Issue } from './load';

export const RULES_PAGE = 'docs/design/GAME_RULES.md';

/** The player walks four ways. */
const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** The opening chain teaches each verb by repetition; G2 and G4 apply after it. */
export const OPENING_QUESTS: ReadonlySet<string> = new Set(['core/fix-the-bridge', 'core/first-fire', 'core/into-town']);

/**
 * The opening as the content names it: the shared chain, and each start's own
 * first task, a quest that names its starter (DECISIONS.md, 2026-10-09: each
 * character begins its own way, and the opening chain names each first task).
 */
export function openingQuests(b: Bundle): Set<string> {
  return new Set([...OPENING_QUESTS, ...Object.values(b.quests).flatMap((q) => (q.starter === undefined ? [] : [q.id]))]);
}

/** What a start's own spots give: a gift of the start, which its own first task may name as a find. */
export function startFinds(b: Bundle, starter: string): Set<string> {
  return new Set(Object.values(b.treasures).flatMap((t) => (t.starter === starter ? t.finds.map((f) => f.item) : [])));
}

/** About two lines of dialogue on a phone at the dialogue size (G14). */
export const BOX_CHARS = 80;

/** The longest name a player can type, for a line that says it. */
export const NAME_CHARS = 16;

/** Errors since the pull request that rewrote the core content (P-3, 8.10). */
export const PLAY_LEVEL: Issue['level'] = 'error';

/** Items that only digging gives: never gathered, made or sold. */
export function digOnlyItems(b: Bundle): Set<string> {
  const gathered = new Set(Object.values(b.resources).map((r) => r.output));
  const made = madeItems(b);
  const sold = soldItems(b);
  // a start's own spot is a gift, not a source
  const dug = Object.values(b.treasures).flatMap((t) => (t.starter === undefined ? t.finds.map((f) => f.item) : []));
  return new Set(dug.filter((item) => !gathered.has(item) && !made.has(item) && !sold.has(item)));
}

/**
 * Items a `find` step may name: what only digging gives, and what exactly one
 * timed plant gives (a resource with `hours`), as long as nothing makes or
 * sells it. Bringing one, with a clue, is a find and not a counter (G2).
 */
export function findableItems(b: Bundle): Set<string> {
  const out = digOnlyItems(b);
  const made = madeItems(b);
  const sold = soldItems(b);
  const givers = new Map<string, number>();
  for (const r of Object.values(b.resources)) givers.set(r.output, (givers.get(r.output) ?? 0) + 1);
  for (const r of Object.values(b.resources)) {
    if (r.hours === undefined || givers.get(r.output) !== 1 || made.has(r.output) || sold.has(r.output)) continue;
    out.add(r.output);
  }
  return out;
}

function madeItems(b: Bundle): Set<string> {
  return new Set(Object.values(b.recipes).flatMap((c) => c.outputs.map((o) => o.item)));
}

function soldItems(b: Bundle): Set<string> {
  return new Set(Object.values(b.shops).flatMap((s) => s.sells.map((o) => o.item)));
}

/**
 * The items these rewards give, quests' and expeditions' alike: each stack's
 * item, and its `instead`, which a start whose kit holds the item gets.
 */
export function rewardItems(rewards: readonly { items?: readonly { item: string; instead?: string }[] }[]): Set<string> {
  return new Set(rewards.flatMap((r) => (r.items ?? []).flatMap((s) => (s.instead === undefined ? [s.item] : [s.item, s.instead]))));
}

/**
 * Where a quest step is on the map, for the kinds of step that name a place: a visit's slot, a restore's slot, a build's camp
 * tile, a riddle's props and its answer (the slot to stand in, or the dig spot's slot), and a tend step's fire.
 * A find step is not here: its item may grow in many places, so `findPlaces` lists them and one inside is enough.
 */
function stepPlaces(b: Bundle, st: QuestDef['steps'][number]): { ref: string; x: number; y: number; w: number; h: number }[] {
  const slotOf = (ref: string, id: string | undefined) => {
    const slot = id === undefined ? undefined : findSlot(b.map, id);
    return slot ? [{ ref, x: slot.x, y: slot.y, w: slot.w, h: slot.h }] : [];
  };
  const propOf = (id: string) => {
    const p = b.map.props.find((prop) => prop.id === id);
    return p ? [{ ref: id, x: p.x, y: p.y, w: p.w, h: p.h }] : [];
  };
  switch (st.kind) {
    case 'visit':
      return slotOf(st.slot, st.slot);
    case 'restore':
      return slotOf(st.restore, b.restores[st.restore]?.place.slot);
    case 'build': {
      const c = b.camps[st.camp];
      const tile = c && campTile(b, c.slot);
      return tile ? [{ ref: st.camp, x: tile[0], y: tile[1], w: 1, h: 1 }] : [];
    }
    case 'riddle': {
      const a = st.answer;
      const answer = a.kind === 'visit' ? slotOf(a.slot, a.slot) : slotOf(a.treasure, b.treasures[a.treasure]?.place.slot);
      return [...st.props.flatMap(propOf), ...answer];
    }
    case 'tend':
      return propOf(st.fire);
    default:
      return [];
  }
}

/** Where an item can be found on the map: every node of a resource that yields it and every dig spot that holds it. */
function findPlaces(b: Bundle, item: string): { x: number; y: number; w: number; h: number }[] {
  return Object.values(b.instances).flatMap((inst) => {
    const gives =
      inst.kind === 'resource'
        ? b.resources[inst.source]?.output === item
        : (b.treasures[inst.source]?.finds ?? []).some((f) => f.item === item);
    return gives ? [{ x: inst.x, y: inst.y, w: 1, h: 1 }] : [];
  });
}

/** The first quests a player meets: by the length of their requires chain, then by id. */
export function firstQuests(b: Bundle, n: number): QuestDef[] {
  const depth = new Map<string, number>();
  const depthOf = (id: string, trail: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (trail.has(id)) return 0;
    trail.add(id);
    const q = b.quests[id];
    const d = q ? Math.max(0, ...(q.requires ?? []).map((r) => depthOf(r, trail) + 1)) : 0;
    depth.set(id, d);
    return d;
  };
  return Object.values(b.quests)
    .sort((x, y) => depthOf(x.id, new Set()) - depthOf(y.id, new Set()) || x.id.localeCompare(y.id))
    .slice(0, n);
}

/**
 * A maze asks with its shape and is answered by the route (GAME_RULES.md
 * section 3): its quest is a visit of the place at its heart, and the walk
 * through the dead ends is the beat that G2 asks for.
 */
export function isMazeVisit(q: QuestDef): boolean {
  return q.type === 'maze' && q.steps.length > 0 && q.steps.every((s) => s.kind === 'visit');
}

export function checkPlay(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? 'content';
  const rule = (n: string, name: string) => `${RULES_PAGE} ${n}, "${name}"`;

  // A bring of something only digging or one timed plant gives is a find (G2). The find and riddle steps are beats by kind.
  const findable = findableItems(b);
  const isFind = (item: string) => findable.has(item);

  const opening = openingQuests(b);
  const expeditionRewarded = new Set(
    Object.values(b.expeditions).flatMap((x) =>
      (x.reward.items?.length ?? 0) + (x.reward.opens?.length ?? 0) > 0 ? x.chain : [],
    ),
  );
  for (const q of Object.values(b.quests)) {
    if (opening.has(q.id)) continue;
    const counter = q.steps.every((s) => s.kind === 'visit' || (s.kind === 'bring' && !isFind(s.item)));
    if (counter && !isMazeVisit(q)) {
      issues.push({
        file: at(q.id),
        where: 'quest.steps',
        message: `every step is bring or visit: a counter, not a question (${rule('G2', 'click-until-done')})`,
        level: PLAY_LEVEL,
      });
    }
    const r = q.reward;
    // items, recipes and places opened are all something the player can newly do
    if ((r.items?.length ?? 0) + (r.recipes?.length ?? 0) + (r.opens?.length ?? 0) === 0 && !expeditionRewarded.has(q.id)) {
      issues.push({
        file: at(q.id),
        where: 'quest.reward',
        message: `gold and reputation only: nothing the player can newly do (${rule('G4', 'gold for gold')})`,
        level: PLAY_LEVEL,
      });
    }
  }

  for (const c of Object.values(b.camps)) {
    if (c.provides === undefined && c.bag_bonus === undefined) {
      issues.push({
        file: at(c.id),
        where: 'camp',
        message: `no station and no bag bonus: a build must change play, a panel gets a button (${rule('G10', 'menu in disguise')})`,
        level: PLAY_LEVEL,
      });
    }
  }

  // G14 and G21: talk stays short, counted per character so one line names the problem.
  for (const n of Object.values(b.npcs)) {
    const d = n.dialogue;
    const over: string[] = [];
    if (d.first !== undefined && d.first.length > 3) over.push(`first meeting ${d.first.length} boxes (3 at most)`);
    for (const standing of ['stranger', 'acquaintance', 'friend', 'family'] as const) {
      const lines = d[standing];
      if (lines !== undefined && lines.length > 2) over.push(`${standing} ${lines.length} boxes (2 at most)`);
    }
    for (const t of n.topics ?? []) if (t.lines.length > 4) over.push(`topic "${t.ask}" ${t.lines.length} boxes (4 at most)`);
    const open = (n.topics ?? []).filter((t) => t.when === undefined).length;
    if (open > 4) over.push(`${open} topics with no \`when\` (the menu shows 4)`);
    if (over.length > 0) {
      issues.push({
        file: at(n.id),
        where: 'npc.dialogue',
        message: `${over.join(', ')}: the player pulls, the rest waits behind a topic (${rule('G21', 'lore wall')})`,
        level: PLAY_LEVEL,
      });
    }
    const boxes = [
      d.first ?? [],
      d.stranger,
      d.acquaintance ?? [],
      d.friend ?? [],
      d.family ?? [],
      ...(n.remarks ?? []).map((r) => r.say),
      ...(n.topics ?? []).map((t) => t.lines),
    ].flat();
    const long = boxes.filter((line) => line.length > BOX_CHARS).length;
    if (long > 0) {
      issues.push({
        file: at(n.id),
        where: 'npc.dialogue',
        message: `${long} of ${boxes.length} boxes over ${BOX_CHARS} characters, about two phone lines (${rule('G14', 'lore wall')})`,
        level: PLAY_LEVEL,
      });
    }
  }

  // G14: the lines on a quest and a place are boxes like any other (GRUNT S-2); the schema caps how many.
  const lined: [string, string, readonly string[]][] = [
    ...Object.values(b.quests).flatMap((q) =>
      (['offer', 'waiting', 'done', 'done_bitten'] as const).map((k): [string, string, readonly string[]] => [q.id, `quest.talk.${k}`, q.talk?.[k] ?? []]),
    ),
    ...Object.values(b.restores).map((r): [string, string, readonly string[]] => [r.id, 'restore.done', r.done ?? []]),
  ];
  for (const [id, where, lines] of lined) {
    // "{name}" becomes the player's name, up to a name's 16 characters
    const long = lines.filter((line) => line.replaceAll('{name}', 'x'.repeat(NAME_CHARS)).length > BOX_CHARS).length;
    if (long > 0) {
      issues.push({
        file: at(id),
        where,
        message: `${long} of ${lines.length} boxes over ${BOX_CHARS} characters, about two phone lines (${rule('G14', 'lore wall')})`,
        level: PLAY_LEVEL,
      });
    }
  }

  // G8: an inscription pays only when a riddle cites its prop; a prop without an id cannot be cited.
  const cited = new Set(Object.values(b.quests).flatMap((q) => q.steps.flatMap((st) => (st.kind === 'riddle' ? st.props : []))));
  let unnamed = 0;
  for (const p of b.map.props) {
    if (p.note === undefined) continue;
    if (p.id === undefined) {
      unnamed++;
      continue;
    }
    if (!cited.has(p.id)) {
      issues.push({
        file: at(b.map.id),
        where: `map.props.${p.id}`,
        message: `"${p.id}" has an inscription that no riddle cites (${rule('G8', 'free read')})`,
        level: PLAY_LEVEL,
      });
    }
  }
  if (unnamed > 0) {
    issues.push({
      file: at(b.map.id),
      where: 'map.props',
      message: `${unnamed} inscription${unnamed === 1 ? '' : 's'} on props without an id, so no riddle can cite ${unnamed === 1 ? 'it' : 'them'} (${rule('G8', 'free read')}); give the prop an id and a riddle, or cut the note`,
      level: PLAY_LEVEL,
    });
  }

  // G48: a fire is a named prop kept by hand; tend steps and fire-lit reads point only to one.
  const fireRule = rule('G48', 'A fire is kept by hand');
  const fires = new Set(b.map.props.flatMap((p) => (p.fire === true && p.id !== undefined ? [p.id] : [])));
  b.map.props.forEach((p, i) => {
    if (p.fire === true && p.id === undefined) {
      issues.push({
        file: at(b.map.id),
        where: `map.props.${i}.fire`,
        message: `a fire needs an id so the player and a tending quest can keep it (${fireRule})`,
        level: PLAY_LEVEL,
      });
    }
    if (p.lit_by !== undefined && !fires.has(p.lit_by)) {
      issues.push({
        file: at(b.map.id),
        where: `map.props.${i}.lit_by`,
        message: `"${p.lit_by}" is not a fire prop (${fireRule})`,
        level: PLAY_LEVEL,
      });
    }
  });
  for (const q of Object.values(b.quests)) {
    q.steps.forEach((step, i) => {
      if (step.kind !== 'tend' || fires.has(step.fire)) return;
      issues.push({
        file: at(q.id),
        where: `quest.steps.${i}.fire`,
        message: `"${step.fire}" is not a fire prop (${fireRule})`,
        level: PLAY_LEVEL,
      });
    });
  }

  // A maze is answered by standing at its heart, and the client sends a visit only for an area (or a riddle's place).
  for (const q of Object.values(b.quests)) {
    if (q.type !== 'maze') continue;
    const hearts = q.steps.flatMap((st) => (st.kind === 'visit' ? [st.slot] : []));
    const wrong = hearts.filter((id) => b.map.slots.find((sl) => sl.id === id)?.kind !== 'area');
    if (hearts.length === 0 || wrong.length > 0) {
      issues.push({
        file: at(q.id),
        where: 'quest.steps',
        message: `a maze is answered by a visit of the area at its heart${wrong.length > 0 ? `; not an area: ${wrong.join(', ')}` : ''} (${RULES_PAGE} section 3, maze)`,
        level: PLAY_LEVEL,
      });
    }
  }

  // The maze block names the frame the peek shows (DECISIONS 2026-10-11, the ladder): a maze's own, around its heart.
  for (const q of Object.values(b.quests)) {
    if (!q.maze) continue;
    const complain = (where: string, message: string) =>
      issues.push({ file: at(q.id), where: `quest.maze${where}`, message: `${message} (${RULES_PAGE} section 3, maze)`, level: PLAY_LEVEL });
    if (q.type !== 'maze') complain('', `only a maze quest names a maze; this one is "${q.type ?? 'untyped'}"`);
    const frame = findSlot(b.map, q.maze.area);
    if (!frame || frame.kind !== 'area') {
      complain('.area', `"${q.maze.area}" is not an area slot`);
      continue;
    }
    const outside = q.steps.flatMap((st) => (st.kind === 'visit' ? [st.slot] : [])).filter((id) => {
      const heart = findSlot(b.map, id);
      return !heart || !inRect(heart.x, heart.y, frame) || !inRect(heart.x + heart.w - 1, heart.y + heart.h - 1, frame);
    });
    if (outside.length > 0) complain('.area', `the heart lies outside the frame "${frame.id}": ${outside.join(', ')}`);
    const mark = q.maze.landmark;
    if (mark && !b.map.props.some((p) => p.sprite === mark && inRect(p.x, p.y, frame))) {
      complain('.landmark', `no prop inside "${frame.id}" is drawn with "${mark}"`);
    }
  }

  // G17: every quest names its type; no two of one type in a row along the requires links; five types among the first ten quests.
  for (const q of Object.values(b.quests)) {
    if (q.type === undefined) {
      issues.push({
        file: at(q.id),
        where: 'quest.type',
        message: `no type: name the question it asks, one of ${QUEST_TYPES.join(', ')} (${rule('G17', 'same again')})`,
        level: PLAY_LEVEL,
      });
      continue;
    }
    for (const r of q.requires ?? []) {
      if (b.quests[r]?.type !== q.type) continue;
      issues.push({
        file: at(q.id),
        where: 'quest.type',
        message: `${q.type} right after "${r}", also ${q.type}: two of one kind in a row (${rule('G17', 'same again')})`,
        level: PLAY_LEVEL,
      });
    }
  }
  const first = firstQuests(b, 10);
  const head = first[0];
  if (head && first.length === 10 && first.every((q) => q.type !== undefined)) {
    const types = new Set(first.map((q) => q.type));
    if (types.size < 5) {
      issues.push({
        file: at(head.id),
        where: 'quest.type',
        message: `${types.size} type${types.size === 1 ? '' : 's'} among the first ten quests (${first.map((q) => q.id).join(', ')}): five at least (${rule('G17', 'same again')})`,
        level: PLAY_LEVEL,
      });
    }
  }

  // G36: one clocked place contains a varied, giver-less chain of its own with its problems inside, danger, a climax and a safe way out.
  // G37: a quest in a chain begins only inside the place at night, so the chain takes no quest of the opening or of another creator.
  const expeditionRule = rule('G36', "An expedition is the valley's dungeon");
  const roadRule = rule('G37', 'An expedition is never the only road');
  const contains = (outer: { x: number; y: number; w: number; h: number }, inner: { x: number; y: number; w: number; h: number }) =>
    inRect(inner.x, inner.y, outer) && inRect(inner.x + inner.w - 1, inner.y + inner.h - 1, outer);
  for (const x of Object.values(b.expeditions)) {
    const complain = (where: string, message: string, cites = expeditionRule) =>
      issues.push({ file: at(x.id), where, message: `${message} (${cites})`, level: PLAY_LEVEL });
    const place = findSlot(b.map, x.place);
    if (!place || place.kind !== 'area') {
      complain('expedition.place', `"${x.place}" is not an area slot`);
    }
    if (x.chain.length < 3 || x.chain.length > 5) {
      complain('expedition.chain', `the chain has ${x.chain.length} quests; it needs 3 to 5`);
    }
    const owner = x.id.slice(0, x.id.indexOf('/') + 1);
    const types = new Set<string>();
    x.chain.forEach((id, i) => {
      const q = b.quests[id];
      if (!q) {
        complain(`expedition.chain.${i}`, `no quest "${id}" exists`);
        return;
      }
      if (!id.startsWith(owner)) {
        complain(`expedition.chain.${i}`, `quest "${id}" is not under "${owner}": a chain holds its creator's own quests, since a quest in a chain begins only inside the place at night`, roadRule);
      }
      if (opening.has(id)) complain(`expedition.chain.${i}`, `quest "${id}" is part of the opening: in a chain it would begin only inside the place at night`, roadRule);
      const shared = Object.values(b.expeditions).filter((other) => other.id !== x.id && other.chain.includes(id));
      if (shared.length > 0) {
        complain(`expedition.chain.${i}`, `quest "${id}" is also in the chain of ${shared.map((other) => `"${other.id}"`).join(', ')}: a chain belongs to one place`);
      }
      if (place) {
        for (const st of q.steps) {
          for (const spot of stepPlaces(b, st)) {
            if (!contains(place, spot)) complain(`expedition.chain.${i}`, `quest "${id}" has a ${st.kind} step at "${spot.ref}", outside "${x.place}": the chain's problems are inside its place`);
          }
          if (st.kind === 'find' && !findPlaces(b, st.item).some((spot) => contains(place, spot))) {
            complain(`expedition.chain.${i}`, `quest "${id}" has a find step for "${st.item}", which nothing inside "${x.place}" gives: the chain's problems are inside its place`);
          }
        }
      }
      if (place) {
        for (const opened of q.reward.opens ?? []) {
          const slot = findSlot(b.map, b.restores[opened]?.place.slot ?? '');
          if (slot && !contains(place, slot)) {
            complain(`expedition.chain.${i}`, `quest "${id}" opens "${opened}", outside "${x.place}": a chain opens doors inside its place; the valley's is the expedition's reward`);
          }
        }
      }
      if (q.giver !== undefined) complain(`expedition.chain.${i}`, `quest "${id}" has a giver; expedition quests are giver-less`);
      if (q.type === undefined) complain(`expedition.chain.${i}`, `quest "${id}" has no type`);
      else if (types.has(q.type)) complain(`expedition.chain.${i}`, `quest type "${q.type}" is repeated in the chain`);
      else types.add(q.type);
      const requires = q.requires ?? [];
      if (i === 0) {
        const within = requires.filter((required) => x.chain.includes(required));
        if (within.length > 0) complain(`expedition.chain.${i}`, `the first quest requires a quest inside its own chain: ${within.join(', ')}`);
      } else if (requires.length !== 1 || requires[0] !== x.chain[i - 1]) {
        complain(`expedition.chain.${i}`, `quest "${id}" must require exactly ["${x.chain[i - 1]}"]`);
      }
    });

    const exit = findSlot(b.map, x.exit);
    if (!exit) complain('expedition.exit', `no exit slot "${x.exit}" exists`);
    else {
      // the camp's ground is safe only once a part of the camp stands, which no content can promise
      let safe = true;
      for (let y = exit.y; y < exit.y + exit.h; y++) {
        for (let x2 = exit.x; x2 < exit.x + exit.w; x2++) safe &&= isSafeGround(b, [x2, y], false);
      }
      if (!safe) complain('expedition.exit', `exit slot "${x.exit}" is not safe ground`);
    }

    if (place && exit) {
      // the place is entered from its exit and nowhere else, on the map as it stands by day before anything is mended
      const walkable = makeWalkable(b);
      const byDay = { restored: [] as string[], camp: [] as string[] };
      // the valley as it ends up: every passable restore mended but the place's own doors and what its reward opens
      const own = new Set(x.reward.opens ?? []);
      const mended = {
        restored: Object.values(b.restores)
          .filter((r) => r.passable && !own.has(r.id))
          .filter((r) => {
            const slot = findSlot(b.map, r.place.slot);
            return slot !== undefined && !contains(place, slot);
          })
          .map((r) => r.id),
        camp: [] as string[],
      };
      const ways = new Map<string, boolean>();
      const touched = new Set<string>();
      for (const view of [byDay, mended]) {
        for (let y = place.y; y < place.y + place.h; y++) {
          for (let x2 = place.x; x2 < place.x + place.w; x2++) {
            if (!walkable(x2, y, view)) continue;
            for (const [dx, dy] of STEPS) {
              const [nx, ny] = [x2 + dx, y + dy];
              if (inRect(nx, ny, place) || !walkable(nx, ny, view)) continue;
              ways.set(`${nx},${ny}`, inRect(nx, ny, exit));
              if (view === byDay && inRect(nx, ny, exit)) touched.add(`${nx},${ny}`);
            }
          }
        }
      }
      if (!walkable(exit.x, exit.y, byDay)) {
        complain('expedition.exit', `the walk-out sets the player on (${exit.x},${exit.y}), the corner of "${x.exit}", and no one can stand there`);
      }
      const others = [...ways].filter(([, fromExit]) => !fromExit).map(([tile]) => `(${tile})`);
      if (others.length > 0) {
        complain('expedition.place', `"${x.place}" can be walked into from ${others.join(', ')}, not only from its exit "${x.exit}", by day or once the valley's restores are mended: one way in`);
      }
      if (touched.size === 0) {
        complain('expedition.exit', `no walkable tile of "${x.place}" touches its exit "${x.exit}" before dusk: the way in is open by day`);
      }
    }

    const climax = findSlot(b.map, x.climax.slot);
    if (!place || !climax || !contains(place, climax)) {
      complain('expedition.climax.slot', `climax slot "${x.climax.slot}" is not inside "${x.place}"`);
    }
    if (place && !b.map.props.some((p) => p.hazard !== undefined && contains(place, p))) {
      complain('expedition.place', `place "${x.place}" contains no hazard prop`);
    }

    let previous = -1;
    x.window.bells.forEach((hour, i) => {
      const order = hour >= 20 && hour <= 23 ? hour - 20 : hour >= 0 && hour <= 4 ? hour + 4 : -1;
      if (!Number.isInteger(hour) || order < 0) complain(`expedition.window.bells.${i}`, `bell hour ${hour} is not a night hour`);
      else if (order <= previous) complain(`expedition.window.bells.${i}`, `bell hour ${hour} is out of ring order`);
      previous = order;
    });
    (x.reward.opens ?? []).forEach((id, i) => {
      if (!b.restores[id]) complain(`expedition.reward.opens.${i}`, `"${id}" is not a restore`);
    });
  }

  // G37: an expedition opens places sooner, never alone. What its reward or a quest of its chain gives is no road by day:
  // a restore that needs it by hand needs it from somewhere else too, unless a quest outside every chain opens the place.
  const chained = new Set(Object.values(b.expeditions).flatMap((x) => x.chain));
  // a quest that waits on a chain quest, however far down its requires, is the night's too
  const night = new Set(chained);
  for (let grew = true; grew; ) {
    grew = false;
    for (const q of Object.values(b.quests)) {
      if (!night.has(q.id) && (q.requires ?? []).some((r) => night.has(r))) {
        night.add(q.id);
        grew = true;
      }
    }
  }
  for (const q of Object.values(b.quests)) {
    if (chained.has(q.id)) continue;
    (q.requires ?? []).forEach((r, i) => {
      if (!chained.has(r)) return;
      issues.push({
        file: at(q.id),
        where: `quest.requires.${i}`,
        message: `"${r}" is a quest of an expedition's chain: a quest of the day would wait on the expedition (${roadRule})`,
        level: PLAY_LEVEL,
      });
    });
  }
  const dayQuests = Object.values(b.quests).filter((q) => !night.has(q.id));
  const byDay = rewardItems(dayQuests.map((q) => q.reward));
  const byNight = rewardItems([...Object.values(b.expeditions).map((x) => x.reward), ...Object.values(b.quests).filter((q) => chained.has(q.id)).map((q) => q.reward)]);
  const openedByDay = new Set(dayQuests.flatMap((q) => q.reward.opens ?? []));
  // what a chain quest opens is a door inside the place (the chain alone reaches it); what the expeditions reward opens is the valleys
  const openedByNight = new Set(Object.values(b.expeditions).flatMap((x) => x.reward.opens ?? []));
  const sold = soldItems(b);
  const nightOnly = (item: string) => byNight.has(item) && b.values[item] === undefined && !sold.has(item) && !byDay.has(item);
  for (const q of dayQuests) {
    q.steps.forEach((st, i) => {
      if ((st.kind !== 'bring' && st.kind !== 'find') || !nightOnly(st.item)) return;
      issues.push({
        file: at(q.id),
        where: `quest.steps.${i}`,
        message: `only an expedition gives "${st.item}": a quest of the day would wait on the expedition (${roadRule})`,
        level: PLAY_LEVEL,
      });
    });
  }
  for (const r of Object.values(b.restores)) {
    if (openedByDay.has(r.id)) continue;
    // a restore with no inputs opens only as a reward: named by an expedition's reward alone, the night is its only road
    if (r.inputs.length === 0 && openedByNight.has(r.id)) {
      issues.push({
        file: at(r.id),
        where: 'restore.inputs',
        message: `only an expedition opens "${r.id}": it opens by no hand and no quest of the day names it (${roadRule})`,
        level: PLAY_LEVEL,
      });
    }
    r.inputs.forEach((s, i) => {
      if (!nightOnly(s.item)) return;
      issues.push({
        file: at(r.id),
        where: `restore.inputs.${i}`,
        message: `only an expedition gives "${s.item}": the place would open through the expedition alone (${roadRule})`,
        level: PLAY_LEVEL,
      });
    });
  }

  return issues;
}
