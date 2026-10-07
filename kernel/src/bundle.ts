/**
 * The bundle: every validated content file merged into one object the kernel
 * reads. `pnpm bundle` builds it; the client and (from stage 2) the server
 * load the same bundle, so both run the same rules on the same data.
 */
import type {
  Camp,
  GameMap,
  ItemDef,
  Npc,
  Profession,
  Quest,
  RarityName,
  Recipe,
  Resource,
  Restore,
  Shop,
  Starter,
  Treasure,
} from '@game/schema';

export interface Meta {
  id: string;
  creator: string;
  title: string;
  /** The file this definition came from, relative to content/. */
  file: string;
  ai_tools?: string[];
}

export type ItemInfo = ItemDef & { creator: string; file: string };
export type ResourceDef = Meta & Resource;
export type TreasureDef = Meta & Treasure;
export type RecipeDef = Meta & Recipe;
export type NpcDef = Meta & Npc;
export type QuestDef = Meta & Quest;
export type RestoreDef = Meta & Restore;
export type CampDef = Meta & Camp;
export type StarterDef = Meta & Starter;
export type ProfessionDef = Meta & Profession;
export type ShopDef = Meta & Shop;
export type MapDef = Meta & GameMap;

export interface Params {
  k_permille: number;
  r_mg_per_value_ms: number;
  t_min_ms: number;
  max_action_ms: number;
  effort_permille: { easy: number; medium: number; craft: number; hard: number };
  power_cap_permille: number[];
  rarity_budget_permille: number;
  rarity_bonus_ms: Record<RarityName, number>;
  drift_budget_permille: number;
  satiety_cap: number;
  satiety_drain_per_min: number;
  day_length_ms: number;
  bag_base: number;
  starting_gold_mg: number;
}

export interface SpriteInfo {
  /** URL of the PNG relative to the site root. */
  url: string;
  w: number;
  h: number;
  frames: number;
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

export interface Bundle {
  format: 1;
  /** Hash of the canonical content: names the exact rules a save was made with. */
  tag: string;
  params: Params;
  items: Record<string, ItemInfo>;
  resources: Record<string, ResourceDef>;
  treasures: Record<string, TreasureDef>;
  recipes: Record<string, RecipeDef>;
  npcs: Record<string, NpcDef>;
  quests: Record<string, QuestDef>;
  restores: Record<string, RestoreDef>;
  camps: Record<string, CampDef>;
  starters: Record<string, StarterDef>;
  professions: Record<string, ProfessionDef>;
  shops: Record<string, ShopDef>;
  map: MapDef;
  sprites: Record<string, SpriteInfo>;
  instances: Record<string, Instance>;
  /** V(item) in value-ms, computed by values.ts (rule R7), never declared. */
  values: Record<string, number>;
  /** Which profession each verb trains. */
  verbs: { gather: string; dig: string; craft: string };
  credits: Credit[];
}

export type Verb = keyof Bundle['verbs'];
