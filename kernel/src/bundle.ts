/**
 * The bundle: every validated content file merged into one object the kernel
 * reads. `pnpm bundle` builds it; the client and (from stage 2) the server
 * load the same bundle, so both run the same rules on the same data.
 */
import type {
  Camp,
  ClassDef,
  CreatorProfile,
  Expedition,
  GameMap,
  ItemDef,
  Npc,
  Pocket,
  Profession,
  Quest,
  Race,
  RarityName,
  Reaction,
  Recipe,
  Resource,
  Restore,
  Shop,
  Treasure,
} from '@game/schema';

export type { BodyEffectName } from '@game/schema';

export interface Meta {
  id: string;
  creator: string;
  title: string;
  /** The file this definition came from, relative to content/. */
  file: string;
  ai_tools?: string[];
}

export type ItemInfo = ItemDef & { creator: string; file: string };
/** A class an extension declares under a base class (DECISIONS.md, 2026-10-09). */
export type ClassInfo = ClassDef & { creator: string; file: string };
export type ResourceDef = Meta & Resource;
export type TreasureDef = Meta & Treasure;
/** `template`: the recipe template the assembler expanded this recipe from. */
export type RecipeDef = Meta & Recipe & { template?: string };
export type NpcDef = Meta & Npc;
export type QuestDef = Meta & Quest;
export type ExpeditionDef = Meta & Expedition;
export type RestoreDef = Meta & Restore;
export type CampDef = Meta & Camp;
/** A race the player picks at the title (DECISIONS.md, 2026-10-22). */
export type RaceDef = Meta & Race;
/** A wake pocket a new game is drawn into by the seed (DECISIONS.md, 2026-10-22). */
export type PocketDef = Meta & Pocket;
export type ProfessionDef = Meta & Profession;
export type ShopDef = Meta & Shop;
export type MapDef = Meta & GameMap;
/** A world reaction (docs/design/REACTIONS.md): read by reactions.ts, never run. */
export type ReactionDef = Meta & Reaction;

export interface Params {
  /** The hours the valley is washed in a colour and the sun's shear (ART_SYSTEM section 2). Read by the renderer, never by a rule. */
  light?: {
    keys: { at: string; tint: string; pct: number }[];
    sun?: { alpha: number; cap: number; keys: { at: string; right: number; down: number }[] };
  };
  k_permille: number;
  /** What the trader pays for a made good, per mille of r * V (CR-18); below 1000. */
  k_craft_permille: number;
  r_mg_per_value_ms: number;
  t_min_ms: number;
  max_action_ms: number;
  effort_permille: { easy: number; medium: number; craft: number; hard: number };
  power_cap_permille: number[];
  rarity_budget_permille: number;
  rarity_bonus_ms: Record<RarityName, number>;
  /** the highest item tier the world has opened */
  open_tiers: number;
  /** the lowest level of each tier's band, from tier 1 */
  tier_min_level: number[];
  /** the most recipes one recipe template may make */
  template_max_recipes: number;
  /** the craft chance at exactly the recipe's level, in basis points, by recipe tier from tier 1 (the last entry holds above) */
  craft_chance_bp: number[];
  /** what each level above the recipe's level adds to the craft chance, in basis points */
  craft_level_step_bp: number;
  /** the largest part of the gap to a sure craft that luck closes, in permille */
  craft_luck_max_permille: number;
  /** part of each input a missed craft keeps when the recipe names none */
  craft_miss_keep_pct: number;
  /** the largest value of one worn effect, by item tier from tier 1 (the last entry holds above) */
  wear_effect_max_pct: number[];
  /** what a full set adds to its pieces' effects, in percent */
  wear_set_bonus_pct: number;
  drift_budget_permille: number;
  satiety_cap: number;
  satiety_drain_per_min: number;
  day_length_ms: number;
  /** milliseconds to walk one tile; the client's pace and the bound on a position report */
  walk_step_ms: number;
  /** maximum path length allowed for a move report; defaults to 32 for older content */
  move_reach_max: number;
  /** work slows while health is at or below this share of its cap, in percent (0: only when empty) */
  hp_low_pct: number;
  /** safe_tiles: the ring of safe ground around the player's own fire while it burns; burn_pct_per_d: how much faster its logs burn for each step of the area's danger, in percent */
  fire: { cap: number; log_ms: number; warn_min: number; safe_tiles: number; burn_pct_per_d: number };
  hazard: {
    /** refill_bp: how high a hunt outrun to a safe place lifts health, in basis points of the cap: what its bites took comes back, up to this share */
    predator: { reach: number; pace_ms: number; eyes: number; catch_ms: number; bite_ms: number; bite_pct: number; refill_bp: number };
    pit: { harm_pct: number };
    trap: { harm_pct: number };
    deep_water: { harm_pct: number };
  };
  /** places with nothing on the back: hands and belt (a bag on the back gives its own `wear.places`) */
  bag_base: number;
  /** things of one kind that share one place (a stack) */
  place_stack: number;
  /**
   * Weight and pace (DECISIONS.md, 2026-10-23): the limit is `base` + `per_point.might` per point + a frame bag's
   * `load_bonus`; light up to `light_permille` of it, steady up to all of it, heavy above; nothing more is picked up
   * beyond `max_permille`. The steady pace is `walk_step_ms`.
   */
  load: { base: number; light_permille: number; max_permille: number; light_step_ms: number; heavy_step_ms: number; heavy_breath_permille: number };
  starting_gold_mg: number;
  /** what one attribute point adds; see the params schema */
  per_point: { might: number; senses: number; agility_pct: number; luck_permille: number; stamina: number; spirit: number };
}

export interface SpriteInfo {
  /** URL of the PNG relative to the site root. */
  url: string;
  w: number;
  h: number;
  frames: number;
  /** Art pixels per tile side: 1 is 16 per tile, 4 is 64 per tile. A frame of `w` x `h` shows at 1 / density. */
  density: 1 | 4;
}

/** One placed node or dig spot: `<resource id>#<n>`. */
export interface Instance {
  source: string;
  kind: 'resource' | 'treasure';
  x: number;
  y: number;
}

export interface Credit {
  id: string;
  type: string;
  title: string;
  creator: string;
  file: string;
  ai_tools: string[];
}

export interface BoardEntry {
  /** creator points: seniority and activity, not a currency */
  points: number;
  /** content records the creator has in the game now */
  records: number;
  /** commits touching the creator's files */
  commits: number;
}

export interface Bundle {
  format: 1;
  /** Hash of the canonical content: names the exact rules a save was made with. */
  tag: string;
  params: Params;
  items: Record<string, ItemInfo>;
  /** Classes declared by extensions, by id. The base classes are fixed in the schema. */
  classes: Record<string, ClassInfo>;
  resources: Record<string, ResourceDef>;
  treasures: Record<string, TreasureDef>;
  recipes: Record<string, RecipeDef>;
  npcs: Record<string, NpcDef>;
  quests: Record<string, QuestDef>;
  expeditions: Record<string, ExpeditionDef>;
  restores: Record<string, RestoreDef>;
  camps: Record<string, CampDef>;
  races: Record<string, RaceDef>;
  pockets: Record<string, PocketDef>;
  professions: Record<string, ProfessionDef>;
  shops: Record<string, ShopDef>;
  reactions: Record<string, ReactionDef>;
  map: MapDef;
  sprites: Record<string, SpriteInfo>;
  instances: Record<string, Instance>;
  /** V(item) in value-ms, computed by values.ts (rule R7), never declared. */
  values: Record<string, number>;
  /** The items whose value comes from a recipe, sorted: the trader pays `k_craft_permille` for them (CR-18). */
  made: string[];
  /** Which profession each verb trains; for craft, the one at the fire, since each station has its own (`stations`). */
  verbs: { gather: string; fell: string; dig: string; craft: string };
  /** The craft profession that works each station: a recipe that names no profession takes its station's. */
  stations: Record<string, string>;
  credits: Credit[];
  /** Creator profiles by handle. Display only, outside the tag: a new signature is not a new world. */
  creators: Record<string, CreatorProfile>;
  /** The creators board by handle, generated from git history by `pnpm board`. Display only, outside the tag. */
  board: Record<string, BoardEntry>;
}

export type Verb = keyof Bundle['verbs'];
