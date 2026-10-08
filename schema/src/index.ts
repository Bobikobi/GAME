/**
 * The published format of every extension file.
 *
 * One definition serves three readers: the TypeScript types the kernel and the
 * client compile against, the JSON Schema files creators and their AI tools
 * read (emitted by emit.ts into schema/json/), and the validator that runs in
 * CI, in `pnpm check` on a creator's machine, and in the client at load.
 *
 * The kernel owns the verbs (closed lists below: tool kinds, stations, step
 * kinds, slot kinds). An extension only picks from these lists and fills in
 * numbers. A new verb is a core release, never an extension.
 */
import { Type, type Static, type TSchema } from '@sinclair/typebox';

/** Bumped when a file written for the old format would be read differently. */
export const FORMAT_VERSION = 1;

const ID_PATTERN = '^[a-z0-9_-]+/[a-z0-9_-]+$';
const SPRITE_PATTERN = '^[a-z0-9_-]+/[a-z0-9_-]+:[a-z0-9_/-]+$';

/** creator/name. Lowercase ASCII, compared by code unit, never recycled. */
export const Id = Type.String({
  pattern: ID_PATTERN,
  maxLength: 80,
  description: 'Stable id "creator/name": lowercase letters, digits, "_" and "-". Never reused once merged.',
});
/** kit-id:frame, for example core/base-kit:items/berry */
/** A map prop's name: the shape of an Id, so a quest riddle can cite it. */
const PropId = Type.String({ pattern: ID_PATTERN, description: 'Names the prop so a quest riddle can cite it. Unique on the map.' });

export const SpriteRef = Type.String({
  pattern: SPRITE_PATTERN,
  maxLength: 120,
  description: 'A frame of an art kit: "<kit id>:<frame name>", for example "core/base-kit:items/berry".',
});
const Name = Type.String({ minLength: 1, maxLength: 40 });
const Text = Type.String({ minLength: 1, maxLength: 240 });
const Int = (min: number, max: number, description?: string) =>
  Type.Integer({ minimum: min, maximum: max, ...(description ? { description } : {}) });
const Ms = (description: string) => Int(0, 3_600_000, description);

// ---------------------------------------------------------------- closed lists

export const RARITIES = ['common', 'uncommon', 'rare', 'legendary'] as const;
export const Rarity = Type.Union(RARITIES.map((r) => Type.Literal(r)), {
  description: 'Declared rarity. The check compares it with the rarity computed from the data.',
});

export const TOOL_KINDS = ['basket', 'trowel'] as const;
export const ToolKind = Type.Union(TOOL_KINDS.map((k) => Type.Literal(k)));

export const STATIONS = ['fire', 'workshop'] as const;
export const Station = Type.Union(STATIONS.map((k) => Type.Literal(k)));

export const ITEM_KINDS = ['material', 'food', 'tool', 'fragment', 'treasure'] as const;

export const SLOT_KINDS = ['resource', 'ruin', 'npc', 'building', 'restore', 'camp', 'area'] as const;
export const SlotKind = Type.Union(SLOT_KINDS.map((k) => Type.Literal(k)));

export const TILE_TAGS = ['grove', 'meadow', 'riverbank', 'ruin', 'town', 'water', 'path', 'interior'] as const;
export const TileTag = Type.Union(TILE_TAGS.map((k) => Type.Literal(k)));

export const ATTRIBUTES = ['carry', 'senses', 'agility', 'luck', 'stamina'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const REP_TIERS = ['stranger', 'acquaintance', 'friend', 'family'] as const;

// ---------------------------------------------------------------- shared parts

export const Stack = Type.Object(
  { item: Id, qty: Int(1, 999) },
  { additionalProperties: false },
);
export const Output = Type.Object(
  {
    item: Id,
    qty: Int(1, 999, 'Units produced per execution at perfect timing.'),
    share_pct: Int(1, 100, 'Part of the activity cost this output carries. Shares of one activity sum to 100.'),
  },
  { additionalProperties: false },
);

export const ItemDef = Type.Object(
  {
    id: Id,
    name: Name,
    description: Type.Optional(Text),
    kind: Type.Union(ITEM_KINDS.map((k) => Type.Literal(k))),
    rarity: Rarity,
    sprite: SpriteRef,
    food: Type.Optional(
      Type.Object(
        { satiety: Int(1, 100, 'Satiety points restored when eaten (the meter holds 100 at the start).') },
        { additionalProperties: false },
      ),
    ),
    tool: Type.Optional(
      Type.Object(
        {
          kind: ToolKind,
          tier: Int(1, 5, 'Better tools work faster. The calculator clamps the total.'),
          uses: Int(1, 1000, 'The tool wears out after this many uses.'),
        },
        { additionalProperties: false },
      ),
    ),
    fragment: Type.Optional(
      Type.Object({ unlocks: Id }, { additionalProperties: false, description: 'A found scrap that teaches a recipe.' }),
    ),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------- record bodies

const Place = Type.Object(
  { slot: Id },
  { additionalProperties: false, description: 'An empty slot from the ruins map. Only one extension is active per slot.' },
);

export const ResourceBody = Type.Object(
  {
    output: Id,
    yield: Int(1, 20, 'Units gathered per execution at perfect timing.'),
    active_ms: Ms('Time the player is busy gathering once.'),
    respawn_ms: Ms('Time before the same plant gives again. Waiting is never paid.'),
    count: Int(1, 12, 'How many of these nodes the slot holds.'),
    sprite: SpriteRef,
    sprite_empty: Type.Optional(SpriteRef),
    tool: Type.Optional(ToolKind),
    level: Int(1, 20, 'Foraging level required.'),
    game: Type.Optional(
      Type.Union([Type.Literal('timing'), Type.Literal('strike'), Type.Literal('pick'), Type.Literal('snap')], {
        description: 'The minigame played when gathering: "timing" (stop a marker in the middle, the default), "strike" (three timed hammer strikes, for stone), "pick" (press only for the ripe ones, for plants) or "snap" (press fast, for wood).',
      }),
    ),
    hours: Type.Optional(
      Type.Tuple([Int(0, 23), Int(1, 24)], { description: 'Hours of the in-game day when it can be gathered, [from, to).' }),
    ),
    place: Place,
  },
  { additionalProperties: false },
);

export const Find = Type.Object(
  {
    item: Id,
    chance_pct: Int(1, 100, 'Chance of this find per dig, at perfect timing. Chances of one spot sum to at most 100.'),
    share_pct: Int(1, 100, 'Part of the dig cost this find carries. Shares sum to 100.'),
  },
  { additionalProperties: false },
);

export const TreasureBody = Type.Object(
  {
    hint: Text,
    active_ms: Ms('Time the player is busy digging once.'),
    respawn_ms: Ms('Time before the spot can be dug again.'),
    count: Int(1, 8),
    tool: ToolKind,
    level: Int(1, 20, 'Digging level required.'),
    finds: Type.Array(Find, { minItems: 1, maxItems: 8 }),
    place: Place,
  },
  { additionalProperties: false },
);

export const RecipeBody = Type.Object(
  {
    station: Station,
    active_ms: Ms('Time the player is busy making it once.'),
    level: Int(1, 20, 'Cooking level required.'),
    inputs: Type.Array(Stack, { minItems: 1, maxItems: 6 }),
    outputs: Type.Array(Output, { minItems: 1, maxItems: 4 }),
    known: Type.Union([Type.Literal('start'), Type.Literal('found')], {
      description: '"start": every player knows it. "found": learned from a recipe scrap found by digging, or from a quest.',
    }),
  },
  { additionalProperties: false },
);

export const NpcBody = Type.Object(
  {
    name: Name,
    sprite: SpriteRef,
    place: Place,
    dialogue: Type.Object(
      {
        stranger: Type.Array(Text, { minItems: 1, maxItems: 6 }),
        acquaintance: Type.Optional(Type.Array(Text, { minItems: 1, maxItems: 6 })),
        friend: Type.Optional(Type.Array(Text, { minItems: 1, maxItems: 6 })),
        family: Type.Optional(Type.Array(Text, { minItems: 1, maxItems: 6 })),
        first: Type.Optional(
          Type.Array(Text, { minItems: 1, maxItems: 8, description: 'Said the first time the player talks to them, before anything else.' }),
        ),
      },
      { additionalProperties: false },
    ),
    topics: Type.Optional(
      Type.Array(
        Type.Object(
          {
            ask: Type.String({ minLength: 1, maxLength: 40, description: 'The question the player can pick, for example "About the mist".' }),
            lines: Type.Array(Text, { minItems: 1, maxItems: 6 }),
          },
          { additionalProperties: false },
        ),
        { maxItems: 4, description: 'Things the player can always ask about.' },
      ),
    ),
    shop: Type.Optional(Id),
  },
  { additionalProperties: false },
);

export const ShopBody = Type.Object(
  {
    sells: Type.Array(
      Type.Object(
        { item: Id, price_mg: Int(1, 100_000_000, 'Price in milli-gold (1000 = 1 gold).') },
        { additionalProperties: false },
      ),
      { maxItems: 40 },
    ),
    buys: Type.Boolean({ description: 'Whether the shop buys anything that has a value.' }),
  },
  { additionalProperties: false },
);

/** The palette of docs/design/GAME_RULES.md section 3: the kind of question a quest asks. */
export const QUEST_TYPES = [
  'investigation',
  'discovery',
  'fetch_twist',
  'dilemma',
  'skill',
  'collection',
  'tending',
  'riddle',
  'mastery',
  'gamble',
  'persuasion',
  'errand',
] as const;
export const QuestType = Type.Union(
  QUEST_TYPES.map((k) => Type.Literal(k)),
  {
    description:
      'The kind of question the quest asks: one of the twelve in docs/design/GAME_RULES.md section 3. Two quests of one type never follow each other in a chain (G17). Optional in the schema so an old file still reads; the check refuses a quest without one since the core content declared it (GRUNT P-3, 8.10).',
  },
);

const Clue = Type.String({
  minLength: 1,
  maxLength: 240,
  description: 'What the journal shows for this step: something to notice or work out. Never the answer, never a count.',
});

export const RiddleAnswer = Type.Union(
  [
    Type.Object(
      { kind: Type.Literal('dig'), treasure: Id },
      { additionalProperties: false, description: 'Solved by digging at this dig spot, whatever comes up.' },
    ),
    Type.Object(
      { kind: Type.Literal('visit'), slot: Id, at: Type.Union([Type.Literal('day'), Type.Literal('night')]) },
      { additionalProperties: false, description: 'Solved by standing in this slot by day (05:00 to 20:00) or by night.' },
    ),
  ],
  { description: 'What solves the riddle. The kernel completes the step on that event and on nothing else.' },
);

export const QuestStep = Type.Union([
  Type.Object({ kind: Type.Literal('bring'), item: Id, qty: Int(1, 99) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('make'), recipe: Id }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('restore'), restore: Id }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('build'), camp: Id }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('visit'), slot: Id }, { additionalProperties: false }),
  Type.Object(
    { kind: Type.Literal('find'), item: Id, clue: Clue },
    {
      additionalProperties: false,
      description: 'Bring one of an item that is found, not farmed: only digging gives it, or one timed plant (a resource with hours) that nothing else gives, makes or sells. The journal shows the clue, not a count, until the item is in the bag.',
    },
  ),
  Type.Object(
    {
      kind: Type.Literal('riddle'),
      clue: Clue,
      props: Type.Array(Id, {
        minItems: 1,
        maxItems: 4,
        description: 'Ids of the map props the riddle reads: the inscriptions it pays for (G8).',
      }),
      answer: RiddleAnswer,
    },
    { additionalProperties: false, description: 'A catch and a reveal (G6): the journal shows the clue, the world holds the answer.' },
  ),
]);

export const QuestBody = Type.Object(
  {
    giver: Type.Optional(Id),
    type: Type.Optional(QuestType),
    summary: Text,
    steps: Type.Array(QuestStep, { minItems: 1, maxItems: 6 }),
    requires: Type.Optional(Type.Array(Id, { maxItems: 4 })),
    reward: Type.Object(
      {
        rep: Int(0, 100, 'Reputation with the giver. Never traded, so it can be generous.'),
        gold_mg: Type.Optional(Int(1, 10_000_000)),
        items: Type.Optional(Type.Array(Stack, { maxItems: 4 })),
        recipes: Type.Optional(Type.Array(Id, { maxItems: 4 })),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const RestoreBody = Type.Object(
  {
    place: Place,
    before: SpriteRef,
    after: SpriteRef,
    inputs: Type.Array(Stack, { minItems: 1, maxItems: 6 }),
    active_ms: Ms('Time the player is busy restoring it.'),
    passable: Type.Boolean({ description: 'Whether the restored thing can be walked over (a bridge).' }),
    sign: Type.Optional(Name),
  },
  { additionalProperties: false },
);

export const CampBody = Type.Object(
  {
    slot: Type.Union([Type.Literal('fire'), Type.Literal('storage'), Type.Literal('workshop'), Type.Literal('shelf')]),
    inputs: Type.Array(Stack, { minItems: 1, maxItems: 6 }),
    active_ms: Ms('Time the player is busy building it.'),
    sprite: SpriteRef,
    provides: Type.Optional(Station),
    bag_bonus: Type.Optional(Int(1, 40)),
  },
  { additionalProperties: false },
);

export const StarterBody = Type.Object(
  {
    name: Name,
    summary: Text,
    attributes: Type.Object(
      { carry: Int(0, 5), senses: Int(0, 5), agility: Int(0, 5), luck: Int(0, 5), stamina: Int(0, 5) },
      { additionalProperties: false },
    ),
    sprite: SpriteRef,
    sprite_alt: Type.Optional(
      Type.String({
        pattern: SPRITE_PATTERN,
        maxLength: 120,
        description: 'Another look of the same character (for example a woman instead of a man), offered by one toggle on the character screen. Same sprite sizes and directions as `sprite`.',
      }),
    ),
  },
  { additionalProperties: false },
);

export const EFFECTS = ['see_ripe', 'timing_window_pct', 'second_hint', 'rare_find_pct', 'craft_speed_pct', 'meal_fill_pct'] as const;
export const Effect = Type.Union(EFFECTS.map((k) => Type.Literal(k)), {
  description: 'What a technique does. A closed list: the kernel knows how to apply each one.',
});

export const ProfessionBody = Type.Object(
  {
    name: Name,
    verb: Type.Union([Type.Literal('gather'), Type.Literal('dig'), Type.Literal('craft')]),
    xp_levels: Type.Array(Int(1, 10_000_000), {
      minItems: 1,
      maxItems: 20,
      description: 'Total experience (active seconds) needed for level 2, 3, ...',
    }),
    techniques: Type.Array(
      Type.Object(
        { level: Int(2, 20), name: Name, effect: Effect, value: Int(0, 100), text: Text },
        { additionalProperties: false },
      ),
      { maxItems: 10 },
    ),
  },
  { additionalProperties: false },
);

const Bounded = Type.Object(
  {
    value: Type.Integer(),
    min: Type.Integer(),
    max: Type.Integer(),
    step: Type.Integer({ minimum: 0, description: 'Largest change one decision may make.' }),
  },
  { additionalProperties: false },
);

/** Rule R12: every constant has bounds, a step and lives in one file. */
export const ParamsBody = Type.Object(
  {
    k_permille: Bounded,
    r_mg_per_value_ms: Bounded,
    t_min_ms: Bounded,
    max_action_ms: Bounded,
    effort_permille: Type.Object(
      { easy: Bounded, medium: Bounded, craft: Bounded, hard: Bounded },
      { additionalProperties: false },
    ),
    power_cap_permille: Type.Array(Type.Integer({ minimum: 1000, maximum: 10_000 }), {
      minItems: 1,
      maxItems: 40,
      description: 'P(level): the clamp on any rate multiplier, by character level (1-based).',
    }),
    rarity_budget_permille: Bounded,
    rarity_bonus_ms: Type.Object(
      { common: Type.Integer(), uncommon: Type.Integer(), rare: Type.Integer(), legendary: Type.Integer() },
      { additionalProperties: false },
    ),
    drift_budget_permille: Bounded,
    satiety_cap: Bounded,
    satiety_drain_per_min: Bounded,
    day_length_ms: Bounded,
    bag_base: Bounded,
    starting_gold_mg: Bounded,
    per_point: Type.Object(
      { carry: Bounded, senses: Bounded, agility_pct: Bounded, luck_permille: Bounded, stamina: Bounded },
      {
        additionalProperties: false,
        description:
          'What one point in an attribute adds: bag places (carry), tiles of dig-hint distance (senses), percent wider timing windows in every minigame (agility), permille on rare and legendary finds inside the power cap and on keeping one unit after a missed gather (luck), and fullness (stamina).',
      },
    ),
  },
  { additionalProperties: false },
);

export const KitBody = Type.Object(
  {
    palette: Type.Optional(
      Type.Array(Type.String({ pattern: '^#[0-9a-f]{6}$' }), {
        minItems: 2,
        maxItems: 32,
        description: 'Only the core kit sets the palette. Every sprite of every kit must use these colors.',
      }),
    ),
    sprites: Type.Record(
      Type.String({ pattern: '^[a-z0-9_-]+/[a-z0-9_/-]+$' }),
      Type.Object(
        {
          file: Type.String({ pattern: '^[a-z0-9_/-]+\\.png$', description: 'PNG next to this file.' }),
          w: Int(8, 512, 'Frame width in pixels. tiles/ and items/ are 16, chars/ are 16.'),
          h: Int(8, 512, 'Frame height in pixels. tiles/ and items/ are 16, chars/ are 24.'),
          frames: Type.Optional(Int(1, 16, 'Animation frames laid side by side. Default 1.')),
        },
        { additionalProperties: false },
      ),
      { description: 'Sprite name (group/name) to its PNG. Groups: tiles, items, chars, props, ui.' },
    ),
  },
  { additionalProperties: false },
);

const Slot = Type.Object(
  {
    id: Id,
    kind: SlotKind,
    x: Int(0, 1023),
    y: Int(0, 1023),
    w: Int(1, 64),
    h: Int(1, 64),
    tag: Type.Optional(TileTag),
    label: Type.Optional(Name),
  },
  { additionalProperties: false },
);

export const MapBody = Type.Object(
  {
    width: Int(8, 1024),
    height: Int(8, 1024),
    legend: Type.Record(Type.String({ pattern: '^.$' }), Type.Object(
      { sprite: SpriteRef, solid: Type.Boolean(), tag: TileTag },
      { additionalProperties: false },
    )),
    ground: Type.Array(Type.String(), { minItems: 8 }),
    props: Type.Array(
      Type.Object(
        {
          id: Type.Optional(PropId),
          sprite: SpriteRef,
          x: Int(0, 1023, 'Left tile of the footprint.'),
          y: Int(0, 1023, 'Top tile of the footprint.'),
          w: Int(1, 8, 'Footprint width in tiles. The sprite is drawn bottom-centered on it.'),
          h: Int(1, 8, 'Footprint height in tiles.'),
          solid: Type.Boolean(),
          sign: Type.Optional({ ...Id, description: 'Makes the prop a readable sign that names whoever filled this slot, or says it awaits restoration.' }),
          note: Type.Optional({ ...Text, description: 'A line shown when the player looks at this prop, for example an old inscription.' }),
        },
        { additionalProperties: false },
      ),
    ),
    spawn: Type.Object({ x: Int(0, 1023), y: Int(0, 1023) }, { additionalProperties: false }),
    slots: Type.Array(Slot),
  },
  { additionalProperties: false },
);

export const SIGNATURE_STYLES = ['carved', 'painted', 'ink', 'gold', 'moss'] as const;
export const SIGNATURE_GLYPHS = ['none', 'leaf', 'star', 'sun', 'flower', 'key', 'wave'] as const;

export const CreatorBody = Type.Object(
  {
    name: { ...Name, description: 'How the game names you on signs and in the credits.' },
    role: Type.Optional(Type.String({ minLength: 1, maxLength: 40, description: 'A few words under your name, for example "Main developer".' })),
    signature: Type.Optional(
      Type.Object(
        {
          text: Type.String({ minLength: 1, maxLength: 24, description: 'The words of your signature, shown over your signs without a click.' }),
          style: Type.Union(SIGNATURE_STYLES.map((k) => Type.Literal(k)), {
            description: '"carved" (into stone), "painted" (on wood), "ink", "gold" (leaf) or "moss".',
          }),
          glyph: Type.Optional(Type.Union(SIGNATURE_GLYPHS.map((k) => Type.Literal(k)), { description: 'A small mark beside the words.' })),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------- the envelope

const envelope = {
  $schema: Type.Optional(Type.String()),
  format: Type.Literal(FORMAT_VERSION, { description: 'Format version of this file.' }),
  id: Id,
  title: Name,
  creator: Type.String({ pattern: '^[a-z0-9_-]+$', maxLength: 39, description: 'GitHub handle, lowercase.' }),
  description: Type.Optional(Text),
  ai_tools: Type.Optional(
    Type.Array(Type.String({ minLength: 1, maxLength: 60 }), {
      maxItems: 8,
      description: 'AI tools used to make this file or its art. Required when any were used.',
    }),
  ),
  items: Type.Optional(Type.Array(ItemDef, { maxItems: 40 })),
};

function record<T extends string, K extends string, B extends TSchema>(type: T, key: K, body: B) {
  const properties = { ...envelope, type: Type.Literal(type), ...({ [key]: body } as Record<K, B>) };
  return Type.Object(properties, { additionalProperties: false, $id: type });
}

export const ResourceFile = record('resource', 'node', ResourceBody);
export const TreasureFile = record('treasure', 'dig', TreasureBody);
export const RecipeFile = record('recipe', 'recipe', RecipeBody);
export const NpcFile = record('npc', 'npc', NpcBody);
export const QuestFile = record('quest', 'quest', QuestBody);
export const RestoreFile = record('restore', 'restore', RestoreBody);
export const CampFile = record('camp', 'camp', CampBody);
export const StarterFile = record('starter', 'starter', StarterBody);
export const CreatorFile = record('creator', 'profile', CreatorBody);
export const ItemsFile = Type.Object({ ...envelope, type: Type.Literal('items') }, { additionalProperties: false });
// Core-only types: a creator file of these types is refused by the check.
export const ShopFile = record('shop', 'shop', ShopBody);
export const ProfessionFile = record('profession', 'profession', ProfessionBody);
export const ParamsFile = record('params', 'params', ParamsBody);
export const KitFile = record('kit', 'kit', KitBody);
export const MapFile = record('map', 'map', MapBody);

export const CREATOR_TYPES = ['resource', 'treasure', 'recipe', 'npc', 'quest', 'restore', 'camp', 'starter', 'items', 'creator'] as const;
export const CORE_ONLY_TYPES = ['shop', 'profession', 'params', 'kit', 'map'] as const;

export const ExtensionFile = Type.Union([
  ResourceFile,
  TreasureFile,
  RecipeFile,
  NpcFile,
  QuestFile,
  RestoreFile,
  CampFile,
  StarterFile,
  ItemsFile,
  CreatorFile,
  ShopFile,
  ProfessionFile,
  ParamsFile,
  KitFile,
  MapFile,
]);

export type ItemDef = Static<typeof ItemDef>;
export type Stack = Static<typeof Stack>;
export type Output = Static<typeof Output>;
export type Find = Static<typeof Find>;
export type ResourceFile = Static<typeof ResourceFile>;
export type TreasureFile = Static<typeof TreasureFile>;
export type RecipeFile = Static<typeof RecipeFile>;
export type NpcFile = Static<typeof NpcFile>;
export type QuestFile = Static<typeof QuestFile>;
export type QuestStep = Static<typeof QuestStep>;
export type QuestType = (typeof QUEST_TYPES)[number];
export type RiddleAnswer = Static<typeof RiddleAnswer>;
export type RestoreFile = Static<typeof RestoreFile>;
export type CampFile = Static<typeof CampFile>;
export type StarterFile = Static<typeof StarterFile>;
export type ItemsFile = Static<typeof ItemsFile>;
export type CreatorFile = Static<typeof CreatorFile>;
export type CreatorProfile = Static<typeof CreatorBody>;
export type ShopFile = Static<typeof ShopFile>;
export type ProfessionFile = Static<typeof ProfessionFile>;
export type ParamsFile = Static<typeof ParamsFile>;
export type ParamsBody = Static<typeof ParamsBody>;
export type KitFile = Static<typeof KitFile>;
export type MapFile = Static<typeof MapFile>;
export type ExtensionFile = Static<typeof ExtensionFile>;
export type Resource = Static<typeof ResourceBody>;
export type Treasure = Static<typeof TreasureBody>;
export type Recipe = Static<typeof RecipeBody>;
export type Npc = Static<typeof NpcBody>;
export type Quest = Static<typeof QuestBody>;
export type Restore = Static<typeof RestoreBody>;
export type Camp = Static<typeof CampBody>;
export type Starter = Static<typeof StarterBody>;
export type Profession = Static<typeof ProfessionBody>;
export type Shop = Static<typeof ShopBody>;
export type Kit = Static<typeof KitBody>;
export type GameMap = Static<typeof MapBody>;
export type EffectName = (typeof EFFECTS)[number];
export type ToolKind = (typeof TOOL_KINDS)[number];
export type StationKind = (typeof STATIONS)[number];
export type RarityName = (typeof RARITIES)[number];

export const SCHEMAS = {
  extension: ExtensionFile,
  resource: ResourceFile,
  treasure: TreasureFile,
  recipe: RecipeFile,
  npc: NpcFile,
  quest: QuestFile,
  restore: RestoreFile,
  camp: CampFile,
  starter: StarterFile,
  items: ItemsFile,
  creator: CreatorFile,
  shop: ShopFile,
  profession: ProfessionFile,
  params: ParamsFile,
  kit: KitFile,
  map: MapFile,
} as const;

export { validateFile, type SchemaIssue } from './validate';
