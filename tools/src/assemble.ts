/**
 * Turns the loaded files into one Bundle and reports every structural
 * problem on the way: who may write which type where, duplicate ids, and
 * references to things that do not exist.
 */
import { dirname } from 'node:path';
import {
  type BoardEntry,
  type Bundle,
  type ClassInfo,
  type Credit,
  type ItemInfo,
  type MapDef,
  type Meta,
  type Params,
  type RecipeDef,
  type SpriteInfo,
  canonical,
  computeValues,
  hashText,
  layoutInstances,
} from '@game/kernel';
import { BASE_CLASSES, CORE_ONLY_TYPES, type CreatorProfile, type ParamsBody, type Template, type WhenDef } from '@game/schema';
import { toRepoPath, type Issue, type Loaded } from './load';
import { findableItems, startFinds } from './play';

export interface Assembled {
  bundle: Bundle | undefined;
  issues: Issue[];
  /** kit id -> folder (absolute) and sprite list, for the PNG checks and the copy */
  kits: Record<string, { dir: string; rel: string; sprites: Record<string, { file: string; w: number; h: number; frames: number }>; palette?: string[] }>;
  /** record id -> the file it came from */
  origin: Record<string, string>;
}

type RecordKey = 'resources' | 'treasures' | 'recipes' | 'npcs' | 'quests' | 'restores' | 'camps' | 'starters' | 'professions' | 'shops';
const KEY_OF: Record<string, RecordKey | undefined> = {
  resource: 'resources',
  treasure: 'treasures',
  recipe: 'recipes',
  npc: 'npcs',
  quest: 'quests',
  restore: 'restores',
  camp: 'camps',
  starter: 'starters',
  profession: 'professions',
  shop: 'shops',
};
const BODY_OF: Record<string, string> = {
  resource: 'node',
  treasure: 'dig',
  recipe: 'recipe',
  template: 'template',
  npc: 'npc',
  quest: 'quest',
  restore: 'restore',
  camp: 'camp',
  starter: 'starter',
  profession: 'profession',
  shop: 'shop',
  params: 'params',
  kit: 'kit',
  map: 'map',
};

/** Which slot kinds each placed type may fill. */
const SLOT_KINDS_FOR: Record<string, string[]> = {
  resource: ['resource'],
  treasure: ['ruin'],
  npc: ['npc'],
  restore: ['restore', 'building'],
};

export function flattenParams(p: ParamsBody): Params {
  return {
    k_permille: p.k_permille.value,
    k_craft_permille: p.k_craft_permille.value,
    r_mg_per_value_ms: p.r_mg_per_value_ms.value,
    t_min_ms: p.t_min_ms.value,
    max_action_ms: p.max_action_ms.value,
    effort_permille: {
      easy: p.effort_permille.easy.value,
      medium: p.effort_permille.medium.value,
      craft: p.effort_permille.craft.value,
      hard: p.effort_permille.hard.value,
    },
    power_cap_permille: [...p.power_cap_permille],
    rarity_budget_permille: p.rarity_budget_permille.value,
    rarity_bonus_ms: { ...p.rarity_bonus_ms },
    open_tiers: p.open_tiers.value,
    tier_min_level: [...p.tier_min_level],
    template_max_recipes: p.template_max_recipes.value,
    craft_chance_bp: [...p.craft_chance_bp],
    craft_level_step_bp: p.craft_level_step_bp.value,
    craft_luck_max_permille: p.craft_luck_max_permille.value,
    craft_miss_keep_pct: p.craft_miss_keep_pct.value,
    wear_effect_max_pct: [...p.wear_effect_max_pct],
    wear_set_bonus_pct: p.wear_set_bonus_pct.value,
    drift_budget_permille: p.drift_budget_permille.value,
    satiety_cap: p.satiety_cap.value,
    satiety_drain_per_min: p.satiety_drain_per_min.value,
    day_length_ms: p.day_length_ms.value,
    walk_step_ms: p.walk_step_ms.value,
    hp_low_pct: p.hp_low_pct.value,
    hazard: {
      predator: {
        reach: p.hazard.predator.reach.value,
        catch_ms: p.hazard.predator.catch_ms.value,
        bite_ms: p.hazard.predator.bite_ms.value,
        bite_pct: p.hazard.predator.bite_pct.value,
      },
      pit: { harm_pct: p.hazard.pit.harm_pct.value },
      trap: { harm_pct: p.hazard.trap.harm_pct.value },
      deep_water: { harm_pct: p.hazard.deep_water.harm_pct.value },
    },
    bag_base: p.bag_base.value,
    starting_gold_mg: p.starting_gold_mg.value,
    per_point: {
      carry: p.per_point.carry.value,
      senses: p.per_point.senses.value,
      agility_pct: p.per_point.agility_pct.value,
      luck_permille: p.per_point.luck_permille.value,
      stamina: p.per_point.stamina.value,
    },
  };
}

export function assemble(files: Loaded[], board: Record<string, BoardEntry> = {}): Assembled {
  const issues: Issue[] = [];
  const err = (f: Loaded | string, where: string, message: string) =>
    issues.push({ file: typeof f === 'string' ? f : toRepoPath(f.abs), where, message, level: 'error' });

  const items: Record<string, ItemInfo> = {};
  const classes: Record<string, ClassInfo> = {};
  const templates: TemplateDef[] = [];
  const records: Record<RecordKey, Record<string, unknown>> = {
    resources: {},
    treasures: {},
    recipes: {},
    npcs: {},
    quests: {},
    restores: {},
    camps: {},
    starters: {},
    professions: {},
    shops: {},
  };
  const origin: Record<string, string> = {};
  const credits: Credit[] = [];
  const kits: Assembled['kits'] = {};
  let params: Params | undefined;
  let map: MapDef | undefined;
  const creators: Record<string, CreatorProfile> = {};

  for (const f of files) {
    const d = f.data;
    const file = toRepoPath(f.abs);
    const top = f.rel.split('/')[0];
    // where a file lives decides who may have written it
    if (top === 'core') {
      if (d.creator !== 'core') err(f, 'creator', 'files under content/core are written by "core"');
    } else if (top === 'extensions') {
      const handle = f.rel.split('/')[1];
      if (d.creator !== handle) err(f, 'creator', `files under content/extensions/${handle}/ must have creator "${handle}"`);
      if ((CORE_ONLY_TYPES as readonly string[]).includes(d.type)) err(f, 'type', `"${d.type}" files are part of the core and cannot be extensions`);
    } else if (top === 'kit') {
      if (d.type !== 'kit') err(f, 'type', 'content/kit holds kit files only');
    } else {
      err(f, '', 'content files go under content/core, content/extensions/<your handle>/ or content/kit');
    }
    if (d.type === 'kit' && top !== 'kit') err(f, 'type', 'kit files go under content/kit/<creator>/');
    if (!d.id.startsWith(`${d.creator}/`)) err(f, 'id', `ids start with your creator handle: "${d.creator}/..."`);
    if (origin[d.id]) err(f, 'id', `"${d.id}" is already used by ${origin[d.id]}`);
    origin[d.id] = file;

    for (const [i, item] of (d.items ?? []).entries()) {
      if (!item.id.startsWith(`${d.creator}/`)) err(f, `items.${i}.id`, `item ids start with "${d.creator}/"`);
      if (items[item.id]) err(f, `items.${i}.id`, `item "${item.id}" is already defined in ${items[item.id]!.file}`);
      items[item.id] = { ...item, creator: d.creator, file };
    }
    for (const [i, c] of (d.classes ?? []).entries()) {
      if (!c.id.startsWith(`${d.creator}/`)) err(f, `classes.${i}.id`, `class ids start with "${d.creator}/"`);
      if (classes[c.id]) err(f, `classes.${i}.id`, `class "${c.id}" is already defined in ${classes[c.id]!.file}`);
      classes[c.id] = { ...c, creator: d.creator, file };
    }
    if (d.type !== 'creator') credits.push({ id: d.id, type: d.type, title: d.title, creator: d.creator, file, ai_tools: d.ai_tools ?? [] });

    const body = (d as unknown as Record<string, unknown>)[BODY_OF[d.type] ?? ''];
    const meta = { id: d.id, creator: d.creator, title: d.title, file, ...(d.ai_tools ? { ai_tools: d.ai_tools } : {}) };
    const key = KEY_OF[d.type];
    if (key) {
      records[key][d.id] = { ...meta, ...(body as object) };
    } else if (d.type === 'template') {
      templates.push({ ...meta, ...d.template });
    } else if (d.type === 'creator') {
      if (d.id !== `${d.creator}/profile`) err(f, 'id', `a creator profile has the id "${d.creator}/profile"`);
      if (creators[d.creator]) err(f, '', `"${d.creator}" already has a profile`);
      creators[d.creator] = d.profile;
    } else if (d.type === 'params') {
      if (params) err(f, '', 'there is more than one params file');
      params = flattenParams(d.params);
    } else if (d.type === 'map') {
      if (map) err(f, '', 'there is more than one map file (a second region comes later)');
      map = { ...meta, ...d.map };
    } else if (d.type === 'kit') {
      kits[d.id] = {
        dir: dirname(f.abs),
        rel: toRepoPath(dirname(f.abs)),
        sprites: Object.fromEntries(
          Object.entries(d.kit.sprites).map(([name, s]) => [name, { file: s.file, w: s.w, h: s.h, frames: s.frames ?? 1 }]),
        ),
        ...(d.kit.palette ? { palette: d.kit.palette } : {}),
      };
    }
  }

  if (!params) err('content/core/params.json', '', 'the params file is missing');
  if (!map) err('content/core/map.json', '', 'the map file is missing');
  if (!params || !map) return { bundle: undefined, issues, kits, origin };

  const sprites: Record<string, SpriteInfo> = {};
  for (const [kitId, kit] of Object.entries(kits)) {
    for (const [name, s] of Object.entries(kit.sprites)) {
      sprites[`${kitId}:${name}`] = { url: `kit/${kitId}/${s.file}`, w: s.w, h: s.h, frames: s.frames };
    }
  }

  const r = records as unknown as Pick<Bundle, RecordKey>;
  // one profession per gathering verb; the one craft verb has a profession per station family
  // (DECISIONS.md, 2026-10-09), and the check reports a station worked twice
  const verbs = { gather: '', fell: '', dig: '', craft: '' };
  const stations: Record<string, string> = {};
  const crafters: string[] = [];
  for (const id of Object.keys(r.professions).sort()) {
    const pr = r.professions[id]!;
    if (pr.verb === 'craft') {
      crafters.push(id);
      for (const station of pr.stations ?? []) stations[station] ??= id;
    } else if (verbs[pr.verb]) err(origin[id]!, 'profession.verb', `"${pr.verb}" is already trained by ${verbs[pr.verb]}`);
    else verbs[pr.verb] = id;
  }
  // the craft verb's own profession is the one at the fire, where crafting starts
  verbs.craft = stations.fire ?? crafters[0] ?? '';
  for (const v of Object.keys(verbs) as (keyof typeof verbs)[]) {
    if (!verbs[v]) err('content/core', '', `no profession trains "${v}"`);
  }

  expandTemplates(templates, { params, items, classes, recipes: r.recipes }, origin, issues);

  const content = { params, items, classes, ...r, map, sprites, verbs, stations, credits };
  const tag = hashText(canonical(content));
  const instances = layoutInstances(map, r.resources, r.treasures);
  const { values, made } = computeValues({ params, items, resources: r.resources, treasures: r.treasures, recipes: r.recipes });
  const bundle: Bundle = { format: 1, tag, ...content, instances, values, made, creators, board };
  checkReferences(bundle, origin, issues);
  return { bundle, issues, kits, origin };
}

type TemplateDef = Meta & Template;

/**
 * Whether an item of class `cls` fits an input that asks for class `want`.
 * A base class takes its own items and every class declared under it; a
 * declared class takes only its own items.
 */
export function classFits(classes: Record<string, ClassInfo>, cls: string | undefined, want: string): boolean {
  if (cls === undefined) return false;
  if (cls === want) return true;
  return (BASE_CLASSES as readonly string[]).includes(want) && classes[cls]?.base === want;
}

/**
 * Recipe templates (DECISIONS.md, 2026-10-09): each becomes one concrete
 * recipe for every combination of items that fit its class inputs, in id
 * order, so the kernel and the value table see concrete recipes only. A
 * template that would make more than `template_max_recipes` makes none.
 */
function expandTemplates(
  templates: TemplateDef[],
  world: { params: Params; items: Record<string, ItemInfo>; classes: Record<string, ClassInfo>; recipes: Record<string, RecipeDef> },
  origin: Record<string, string>,
  issues: Issue[],
): void {
  const { params, items, classes, recipes } = world;
  const ids = Object.keys(items).sort();
  for (const t of [...templates].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const err = (where: string, message: string) => issues.push({ file: t.file, where, message, level: 'error' });
    if (!t.inputs.some((input) => 'class' in input)) {
      err('template.inputs', 'no input names a class: write a recipe instead of a template');
      continue;
    }
    const choices = t.inputs.map((input, i) => {
      if (!('class' in input)) return [input.item];
      const fit = ids.filter((id) => {
        const it = items[id]!;
        return classFits(classes, it.class, input.class) && (input.family === undefined || it.family === input.family) && (it.tier ?? 1) >= input.min_tier;
      });
      if (fit.length === 0) {
        const family = input.family === undefined ? '' : ` and family "${input.family}"`;
        err(`template.inputs.${i}`, `no item of class "${input.class}"${family} at tier ${input.min_tier} or above`);
      }
      return fit;
    });
    if (choices.some((c) => c.length === 0)) continue;
    const count = choices.reduce((n, c) => n * c.length, 1);
    if (count > params.template_max_recipes) {
      err(
        'template.inputs',
        `fits ${count} combinations, more than template_max_recipes (${params.template_max_recipes}): name a family, a narrower class or a higher min_tier`,
      );
      continue;
    }
    let combos: string[][] = [[]];
    for (const c of choices) combos = combos.flatMap((combo) => c.map((id) => [...combo, id]));
    for (const combo of combos) {
      const picked = combo.filter((_, i) => 'class' in t.inputs[i]!);
      // "+" is outside the id alphabet, so no two templates or item lists can make the same id
      const id = `${t.id}+${picked.join('+')}`;
      if (origin[id]) {
        err('template', `makes the recipe "${id}", an id already used by ${origin[id]}`);
        continue;
      }
      const inputs: { item: string; qty: number }[] = [];
      combo.forEach((item, i) => {
        const same = inputs.find((s) => s.item === item);
        if (same) same.qty += t.inputs[i]!.qty;
        else inputs.push({ item, qty: t.inputs[i]!.qty });
      });
      origin[id] = t.file;
      recipes[id] = {
        id,
        creator: t.creator,
        title: `${t.title} (${picked.map((item) => items[item]!.name).join(', ')})`,
        file: t.file,
        ...(t.ai_tools ? { ai_tools: t.ai_tools } : {}),
        station: t.station,
        active_ms: t.active_ms,
        level: t.level,
        ...(t.profession ? { profession: t.profession } : {}),
        inputs,
        outputs: t.outputs.map((o) => ({ ...o })),
        ...(t.miss ? { miss: structuredClone(t.miss) } : {}),
        known: 'start',
        template: t.id,
      };
    }
  }
}

function checkReferences(b: Bundle, origin: Record<string, string>, issues: Issue[]): void {
  const err = (id: string, where: string, message: string) =>
    issues.push({ file: origin[id] ?? b.items[id]?.file ?? 'content', where, message, level: 'error' });
  const item = (owner: string, where: string, id: string) => {
    if (!b.items[id]) err(owner, where, `no item "${id}" exists`);
  };
  const sprite = (owner: string, where: string, ref: string) => {
    if (!b.sprites[ref]) err(owner, where, `no sprite "${ref}" in any kit`);
  };
  const slotFill: Record<string, string[]> = {};
  const place = (owner: string, type: string, slotId: string) => {
    const slot = b.map.slots.find((s) => s.id === slotId);
    if (!slot) return err(owner, 'place.slot', `no slot "${slotId}" on the map`);
    const allowed = SLOT_KINDS_FOR[type] ?? [];
    if (!allowed.includes(slot.kind)) err(owner, 'place.slot', `"${slotId}" is a ${slot.kind} slot; a ${type} needs one of: ${allowed.join(', ')}`);
    (slotFill[slotId] ??= []).push(owner);
  };

  for (const [id, it] of Object.entries(b.items)) {
    sprite(id, 'sprite', it.sprite);
    if (it.class !== undefined && !(BASE_CLASSES as readonly string[]).includes(it.class) && !b.classes[it.class]) {
      err(id, 'class', `no class "${it.class}": use a base class (${BASE_CLASSES.join(', ')}) or declare it under "classes"`);
    }
    if (it.fragment && !b.recipes[it.fragment.unlocks]) err(id, 'fragment.unlocks', `no recipe "${it.fragment.unlocks}"`);
    if (it.kind === 'food' && !it.food) err(id, 'food', 'a food item needs "food": { "satiety": n }');
    if (it.food && it.food.satiety === 0 && it.food.hurt === undefined) err(id, 'food', 'a food feeds ("satiety" above 0) or hurts ("hurt"): this one does neither');
    if (it.kind === 'tool' && !it.tool) err(id, 'tool', 'a tool item needs "tool": { kind, tier }, and "uses" when it wears out');
    if (it.kind === 'fragment' && !it.fragment) err(id, 'fragment', 'a fragment item needs "fragment": { "unlocks": recipe id }');
  }
  for (const [id, res] of Object.entries(b.resources)) {
    item(id, 'node.output', res.output);
    sprite(id, 'node.sprite', res.sprite);
    if (res.sprite_empty) sprite(id, 'node.sprite_empty', res.sprite_empty);
    res.growth?.forEach((g, i) => sprite(id, `node.growth.${i}`, g));
    if (res.growth && !res.sprite_empty) err(id, 'node.growth', 'growth stages come after "sprite_empty": name the stump or the bare ground first');
    place(id, 'resource', res.place.slot);
    for (const extra of res.place.scatter ?? []) place(id, 'resource', extra);
  }
  for (const [id, t] of Object.entries(b.treasures)) {
    t.finds.forEach((f, i) => item(id, `dig.finds.${i}.item`, f.item));
    const chance = t.finds.reduce((n, f) => n + f.chance_pct, 0);
    if (chance > 100) err(id, 'dig.finds', `chances add up to ${chance}%, at most 100%`);
    if (t.starter !== undefined && !b.starters[t.starter]) err(id, 'dig.starter', `no starter "${t.starter}"`);
    place(id, 'treasure', t.place.slot);
  }
  for (const [id, c] of Object.entries(b.recipes)) {
    c.inputs.forEach((s, i) => item(id, `recipe.inputs.${i}.item`, s.item));
    c.outputs.forEach((s, i) => item(id, `recipe.outputs.${i}.item`, s.item));
    if (c.profession && !b.professions[c.profession]) err(id, 'recipe.profession', `no profession "${c.profession}"`);
  }
  // a line that waits for the world names only things that exist (GRUNT S-1)
  const when = (owner: string, where: string, w: WhenDef) => {
    const named: [keyof WhenDef, string, (ref: string) => boolean][] = [
      ['done', 'quest', (r) => !!b.quests[r]],
      ['active', 'quest', (r) => !!b.quests[r]],
      ['not_done', 'quest', (r) => !!b.quests[r]],
      ['restored', 'restore', (r) => !!b.restores[r]],
      ['built', 'camp part', (r) => !!b.camps[r]],
      ['has', 'item', (r) => !!b.items[r]],
      ['visited', 'slot', (r) => b.map.slots.some((sl) => sl.id === r)],
    ];
    for (const [key, kind, exists] of named) {
      const refs = w[key];
      if (!Array.isArray(refs)) continue;
      refs.forEach((r, i) => {
        if (!exists(r)) err(owner, `${where}.${key}.${i}`, `no ${kind} "${r}"`);
      });
    }
  };
  for (const [id, n] of Object.entries(b.npcs)) {
    sprite(id, 'npc.sprite', n.sprite);
    place(id, 'npc', n.place.slot);
    if (n.shop && !b.shops[n.shop]) err(id, 'npc.shop', `no shop "${n.shop}"`);
    (n.remarks ?? []).forEach((r, i) => when(id, `npc.remarks.${i}.when`, r.when));
    (n.topics ?? []).forEach((t, i) => {
      if (t.when) when(id, `npc.topics.${i}.when`, t.when);
    });
  }
  for (const [id, s] of Object.entries(b.shops)) s.sells.forEach((o, i) => item(id, `shop.sells.${i}.item`, o.item));
  const findable = findableItems(b);
  const propIds = new Set(b.map.props.flatMap((p) => (p.id === undefined ? [] : [p.id])));
  for (const [id, q] of Object.entries(b.quests)) {
    if (q.giver && !b.npcs[q.giver]) err(id, 'quest.giver', `no npc "${q.giver}"`);
    if (q.starter !== undefined && !b.starters[q.starter]) err(id, 'quest.starter', `no starter "${q.starter}"`);
    const gifts = q.starter === undefined ? new Set<string>() : startFinds(b, q.starter);
    (q.requires ?? []).forEach((r, i) => {
      if (!b.quests[r]) err(id, `quest.requires.${i}`, `no quest "${r}"`);
    });
    q.steps.forEach((st, i) => {
      const w = `quest.steps.${i}`;
      if (st.kind === 'bring') item(id, w, st.item);
      if (st.kind === 'make' && !b.recipes[st.recipe]) err(id, w, `no recipe "${st.recipe}"`);
      if (st.kind === 'restore' && !b.restores[st.restore]) err(id, w, `no restore "${st.restore}"`);
      if (st.kind === 'build' && !b.camps[st.camp]) err(id, w, `no camp part "${st.camp}"`);
      if (st.kind === 'visit' && !b.map.slots.some((s) => s.id === st.slot)) err(id, w, `no slot "${st.slot}"`);
      if (st.kind === 'find') {
        item(id, w, st.item);
        // a start's own first task may find the gift of its own spot
        if (b.items[st.item] && !findable.has(st.item) && !gifts.has(st.item)) {
          err(id, w, `"${st.item}" is sold, made or grows in more than one place: a find must be found, dug up or picked in one timed place`);
        }
      }
      if (st.kind === 'riddle') {
        st.props.forEach((p, j) => {
          if (!propIds.has(p)) err(id, `${w}.props.${j}`, `no map prop with id "${p}"`);
        });
        const a = st.answer;
        if (a.kind === 'dig' && !b.treasures[a.treasure]) err(id, `${w}.answer`, `no dig spot "${a.treasure}"`);
        if (a.kind === 'visit' && !b.map.slots.some((s) => s.id === a.slot)) err(id, `${w}.answer`, `no slot "${a.slot}"`);
      }
    });
    (q.reward.items ?? []).forEach((s, i) => {
      const w = `quest.reward.items.${i}`;
      item(id, w, s.item);
      if (s.instead !== undefined) item(id, `${w}.instead`, s.instead);
      // no reward repeats a kit: a start whose kit holds the item gets `instead`, which that kit lacks
      for (const [sid, st] of Object.entries(b.starters)) {
        const kit = (st.kit ?? []).map((k) => k.item);
        if (!kit.includes(s.item)) continue;
        if (s.instead === undefined) err(id, w, `the kit of "${sid}" holds "${s.item}": name an item for it in "instead"`);
        else if (kit.includes(s.instead)) err(id, `${w}.instead`, `the kit of "${sid}" holds "${s.instead}" too`);
      }
    });
    (q.reward.recipes ?? []).forEach((rid, i) => {
      if (!b.recipes[rid]) err(id, `quest.reward.recipes.${i}`, `no recipe "${rid}"`);
    });
    (q.reward.opens ?? []).forEach((rid, i) => {
      if (!b.restores[rid]) err(id, `quest.reward.opens.${i}`, `no restore "${rid}"`);
    });
  }
  const opened = new Set(Object.values(b.quests).flatMap((q) => q.reward.opens ?? []));
  for (const [id, r] of Object.entries(b.restores)) {
    if (r.inputs.length === 0 && !opened.has(id)) err(id, 'restore.inputs', 'no inputs and no quest opens it: it could never open');
    r.inputs.forEach((s, i) => item(id, `restore.inputs.${i}.item`, s.item));
    sprite(id, 'restore.before', r.before);
    sprite(id, 'restore.after', r.after);
    place(id, 'restore', r.place.slot);
  }
  for (const [id, c] of Object.entries(b.camps)) {
    c.inputs.forEach((s, i) => item(id, `camp.inputs.${i}.item`, s.item));
    sprite(id, 'camp.sprite', c.sprite);
    if (c.upgrades !== undefined && !b.camps[c.upgrades]) err(id, 'camp.upgrades', `no camp part "${c.upgrades}"`);
  }
  const totals = Object.entries(b.starters).map(([id, s]) => [id, Object.values(s.attributes).reduce((n, v) => n + v, 0)] as const);
  for (const [id, total] of totals) {
    sprite(id, 'starter.sprite', b.starters[id]!.sprite);
    const alt = b.starters[id]!.sprite_alt;
    if (alt) sprite(id, 'starter.sprite_alt', alt);
    b.starters[id]!.kit?.forEach((k, i) => item(id, `starter.kit.${i}.item`, k.item));
    if (total !== STARTER_POINTS) err(id, 'starter.attributes', `attributes add up to ${total}; every starter has exactly ${STARTER_POINTS}`);
  }
  for (const [slotId, owners] of Object.entries(slotFill)) {
    if (owners.length > 1) {
      for (const owner of owners) err(owner, 'place.slot', `slot "${slotId}" is taken by more than one extension: ${owners.join(', ')}`);
    }
  }
  checkMap(b, origin, issues);
}

/** Every starter gets the same number of attribute points: different, never better. */
export const STARTER_POINTS = 6;

function checkMap(b: Bundle, origin: Record<string, string>, issues: Issue[]): void {
  const m = b.map;
  const file = origin[m.id] ?? 'content/core/map.json';
  const err = (where: string, message: string) => issues.push({ file, where, message, level: 'error' });
  if (m.ground.length !== m.height) err('map.ground', `has ${m.ground.length} rows, the map is ${m.height} high`);
  m.ground.forEach((row, y) => {
    if (row.length !== m.width) err(`map.ground.${y}`, `row is ${row.length} wide, the map is ${m.width} wide`);
    for (const ch of new Set(row)) if (!m.legend[ch]) err(`map.ground.${y}`, `"${ch}" is not in the legend`);
  });
  for (const [ch, tile] of Object.entries(m.legend)) {
    if (!b.sprites[tile.sprite]) err(`map.legend.${ch}`, `no sprite "${tile.sprite}"`);
  }
  const propIds = new Set<string>();
  m.props.forEach((p, i) => {
    if (!b.sprites[p.sprite]) err(`map.props.${i}`, `no sprite "${p.sprite}"`);
    if (p.x + p.w > m.width || p.y + p.h > m.height) err(`map.props.${i}`, 'reaches past the edge of the map');
    if (p.sign && !m.slots.some((s) => s.id === p.sign)) err(`map.props.${i}.sign`, `no slot "${p.sign}"`);
    if (p.id !== undefined) {
      if (propIds.has(p.id)) err(`map.props.${i}.id`, `prop id "${p.id}" is used twice`);
      propIds.add(p.id);
    }
  });
  const seen = new Set<string>();
  m.slots.forEach((s, i) => {
    if (seen.has(s.id)) err(`map.slots.${i}`, `slot id "${s.id}" is used twice`);
    seen.add(s.id);
    if (s.x + s.w > m.width || s.y + s.h > m.height) err(`map.slots.${i}`, 'reaches past the edge of the map');
  });
  if (m.spawn.x >= m.width || m.spawn.y >= m.height) err('map.spawn', 'is outside the map');
  const row = m.ground[m.spawn.y] ?? '';
  if (m.legend[row[m.spawn.x] ?? '']?.solid) err('map.spawn', 'is on a solid tile');
}
