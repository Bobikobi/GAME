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

/**
 * A staff, a hammer and a pick are worn in the hand for what they help; no work asks for one yet.
 * The hammer and the pick are the human's and the skeleton's outfit tools (DECISIONS.md, 2026-10-22).
 */
export const TOOL_KINDS = ['basket', 'trowel', 'axe', 'staff', 'hammer', 'pick', 'rod'] as const;
export const ToolKind = Type.Union(TOOL_KINDS.map((k) => Type.Literal(k)));

export const STATIONS = ['fire', 'workshop'] as const;
export const Station = Type.Union(STATIONS.map((k) => Type.Literal(k)));

export const ITEM_KINDS = ['material', 'food', 'tool', 'fragment', 'treasure'] as const;

export const SLOT_KINDS = ['resource', 'ruin', 'npc', 'building', 'restore', 'camp', 'area'] as const;
export const SlotKind = Type.Union(SLOT_KINDS.map((k) => Type.Literal(k)));

/** What a hazard is (G30, G34): a hunter that chases, or a place that hurts when stepped on. */
export const HAZARD_KINDS = ['predator', 'pit', 'trap', 'deep_water'] as const;
/** When a hazard acts. "mist" joins with the expedition (GRUNT P-6), which defines the mist. */
export const HAZARD_WINDOWS = ['night'] as const;

export const TILE_TAGS = ['grove', 'meadow', 'riverbank', 'ruin', 'town', 'water', 'path', 'interior'] as const;
export const TileTag = Type.Union(TILE_TAGS.map((k) => Type.Literal(k)));

/**
 * Six attributes (DECISIONS.md, 2026-10-22: the races). `might` was `carry` before kernel 0.14: a save
 * of state format 1 reads its `carry` as `might` and gets `spirit` 0 (kernel migrateState).
 */
export const ATTRIBUTES = ['might', 'senses', 'agility', 'luck', 'stamina', 'spirit'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export const AttributeName = Type.Union(ATTRIBUTES.map((a) => Type.Literal(a)));

/** How a world takes a race (DECISIONS.md, 2026-10-22): its two home attributes one lower, as they are, or one higher. */
export const WORLD_GRADES = ['weak', 'normal', 'strong'] as const;
export type WorldGrade = (typeof WORLD_GRADES)[number];

/** A world a map or a region belongs to, for example "valley". Open, not a closed list: a creator's race may name a new one. */
export const WorldId = Type.String({ pattern: '^[a-z0-9_-]+$', minLength: 1, maxLength: 40 });

export const REP_TIERS = ['stranger', 'acquaintance', 'friend', 'family'] as const;

/**
 * The material grammar (DECISIONS.md, 2026-10-09): every item names a class.
 * The core owns these base classes; an extension declares a class of its own
 * under one of them, and every rule written for the base class holds for it.
 * "metal" waits for its discovery: the check refuses metal items until then.
 */
export const BASE_CLASSES = [
  'plant',
  'wood',
  'fibre',
  'stone',
  'clay',
  'mineral',
  'metal',
  'animal',
  'meal',
  'tool',
  'garment',
  'jewelry',
  'relic',
] as const;
export const BaseClass = Type.Union(BASE_CLASSES.map((k) => Type.Literal(k)), {
  description:
    'plant (leaves, herbs, berries, fruit, roots, mushrooms), wood, fibre (reeds, grass, thread, cloth), stone, clay (clay, sand, pottery, brick), mineral (crystals, gems, salt, ore), metal (waits for its discovery), animal (feathers, wool, hide, bone), meal (cooked food), tool, garment (worn clothes), jewelry, relic (old things from the ruins).',
});
export const ItemClass = Type.Union([...BASE_CLASSES.map((k) => Type.Literal(k)), Id], {
  description: 'A base class (plant, wood, fibre, ...) or the id of a class an extension declares under one of them.',
});
const Word = (description: string) => Type.String({ pattern: '^[a-z0-9_-]+$', maxLength: 24, description });

// ---------------------------------------------------------------- shared parts

export const Stack = Type.Object(
  { item: Id, qty: Int(1, 999) },
  { additionalProperties: false },
);
/**
 * An item a quest gives. A character whose wake pocket already lays it on the ground gets `instead`
 * (DECISIONS.md, 2026-10-10: whom to help first), so no reward repeats a pocket's tool.
 */
export const RewardStack = Type.Object(
  {
    item: Id,
    qty: Int(1, 999),
    instead: Type.Optional({
      ...Id,
      description: "What a character whose wake pocket lays the item on the ground gets in its place: something that pocket lacks.",
    }),
  },
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

/**
 * The slots an item names: jewelry takes either of two places on the character, an outfit takes the top and the legs,
 * and the back holds one bag or one quiver (DECISIONS.md, 2026-10-23: races, weight and bags).
 */
export const WORN_SLOTS = ['head', 'top', 'legs', 'outfit', 'feet', 'jewelry', 'hand', 'back'] as const;
export const WornSlot = Type.Union(WORN_SLOTS.map((k) => Type.Literal(k)), {
  description:
    'Where it is worn: head, top, legs (trousers), outfit (takes the top and the legs), feet, jewelry (two places), hand (a tool) or back (one bag or one quiver).',
});

/** The effects a worn item may carry: rates of work, never the output of a craft (rule R9). Every one is in EFFECTS too. */
export const WORN_EFFECTS = ['gather_speed_pct', 'dig_speed_pct', 'craft_speed_pct', 'craft_chance_pct', 'rare_find_pct'] as const;
export const WornEffect = Type.Union(WORN_EFFECTS.map((k) => Type.Literal(k)), {
  description: 'What a worn item helps: gathering, digging or crafting speed, the craft chance, or rare finds.',
});

export const Wear = Type.Object(
  {
    slot: WornSlot,
    look: Type.Optional(
      Type.Boolean({
        description: 'A look: worn on the look layer over the work clothes. It shows and counts for nothing, so it has no effects and no set.',
      }),
    ),
    effects: Type.Optional(
      Type.Array(
        Type.Object(
          { effect: WornEffect, value: Int(1, 100, 'Percent, at most the cap of the item\'s tier (params.wear_effect_max_pct).') },
          { additionalProperties: false },
        ),
        { minItems: 1, maxItems: 2, description: 'Small bonuses while it is worn on the work layer. Two at most, each effect once.' },
      ),
    ),
    set: Type.Optional({
      ...Id,
      description: 'A set of one creator: when every piece of it is worn, their effects grow by params.wear_set_bonus_pct.',
    }),
    places: Type.Optional(
      Int(
        1,
        99,
        'A bag on the back: the places it gives, instead of the hands\' `bag_base`. Only a work piece on the back carries it (DECISIONS.md, 2026-10-23).',
      ),
    ),
    load_bonus: Type.Optional(
      Int(1, 100, 'A bag on the back that moves the load to the hips: what it adds to the weight limit (`load.base` + might). Needs `places`.'),
    ),
  },
  {
    additionalProperties: false,
    description:
      'Something the character wears (DECISIONS.md, 2026-10-09: the upgrade). A worn item stays in the bag; it takes no place there, but its weight counts (2026-10-23).',
  },
);

export const ItemDef = Type.Object(
  {
    id: Id,
    name: Name,
    description: Type.Optional(Text),
    kind: Type.Union(ITEM_KINDS.map((k) => Type.Literal(k))),
    rarity: Rarity,
    class: Type.Optional(ItemClass),
    family: Type.Optional(Word('A group inside the class, for example "berry" for every berry. Open: any lowercase word.')),
    tags: Type.Optional(
      Type.Array(Word('A lowercase word.'), { maxItems: 8, uniqueItems: true, description: 'Open words that describe it, for example "sweet" or "night".' }),
    ),
    tier: Type.Optional(
      Int(1, 20, 'How advanced it is, from 1. The rarity says how often it appears; the tier says how far up the ladder it is. A tool has the tier of its "tool".'),
    ),
    sprite: SpriteRef,
    weight: Int(
      0,
      20,
      'How heavy one unit is (DECISIONS.md, 2026-10-23): 0 for herbs, seeds and coins, 1 for most things, 3 for logs, stone and ore. The load against the weight limit sets the walking pace.',
    ),
    food: Type.Optional(
      Type.Object(
        {
          satiety: Int(0, 100, 'Health points restored when eaten (the meter holds 100 at the start). 0 for a food that only hurts.'),
          hurt: Type.Optional(Int(1, 100, 'Health points it takes when eaten, at any hour: a bad fruit or a raw herb (G30).')),
        },
        { additionalProperties: false },
      ),
    ),
    tool: Type.Optional(
      Type.Object(
        {
          kind: ToolKind,
          tier: Int(1, 5, 'Better tools work faster. The calculator clamps the total.'),
          uses: Type.Optional(
            Int(1, 1000, 'The tool wears out after this many uses. Left out, the tool lasts (DECISIONS.md, 2026-10-09: the crafting economy).'),
          ),
        },
        { additionalProperties: false },
      ),
    ),
    fragment: Type.Optional(
      Type.Object({ unlocks: Id }, { additionalProperties: false, description: 'A found scrap that teaches a recipe.' }),
    ),
    wear: Type.Optional(Wear),
    premium_later: Type.Optional(
      Type.Boolean({
        description:
          'Marks a look that may also be sold for premium currency once stage 6 brings it. Only a look item with no effect may carry it, and it stays obtainable in the game (DECISIONS.md, 2026-10-09).',
      }),
    ),
  },
  { additionalProperties: false },
);

export const ClassDef = Type.Object(
  {
    id: Id,
    name: Name,
    base: BaseClass,
    description: Type.Optional(Text),
  },
  {
    additionalProperties: false,
    description: 'A class of your own, declared under one base class. Every rule written for the base class holds for it.',
  },
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
    growth: Type.Optional(
      Type.Array(SpriteRef, {
        minItems: 1,
        maxItems: 3,
        description:
          'Young stages of a node that grows back, from the youngest up (after `sprite_empty`, before `sprite`). The client shows the stage by how much of the respawn time has passed. Needs `sprite_empty`.',
      }),
    ),
    solid: Type.Optional(
      Type.Boolean({
        description:
          'The node blocks the way, ready or not, as a tree does: a stump stays in the way until the tree is grown again. Left out: the player walks through it.',
      }),
    ),
    opens_after: Type.Optional(
      Type.Array(
        Type.Object(
          {
            quest: Id,
            line: Type.Optional(Type.String({ minLength: 1, maxLength: 80, description: 'The one short line the refusal says. Left out: "It is not ready yet."' })),
          },
          { additionalProperties: false },
        ),
        {
          minItems: 1,
          maxItems: 4,
          description:
            'Quests the node waits for, each with the line its refusal says. The node cannot be struck by a character who was offered one of them and has not finished it; a character who was offered none strikes the node as usual. Two entries may not both be offered to one wake pocket. The refusal costs nothing.',
        },
      ),
    ),
    tool: Type.Optional(ToolKind),
    work: Type.Optional(
      Type.Literal('mine', {
        description:
          'How the node is worked when it needs no tool. "mine": broken with blows that run by themselves after one press, as felling does; it trains digging, a pick or a hammer in the bag makes it faster (the best one, worn a little each time), and bare hands still do it. Left out: gathered by hand with the minigame of `game`.',
      }),
    ),
    level: Int(1, 20, 'Level required, in the profession the node trains: felling when the tool is an axe, fishing when it is a rod, digging when the node is mined, foraging otherwise.'),
    game: Type.Optional(
      Type.Union([Type.Literal('timing'), Type.Literal('strike'), Type.Literal('pick'), Type.Literal('snap'), Type.Literal('fish')], {
        description: 'The minigame played when gathering: "timing" (stop a marker in the middle, the default), "strike" (three timed hammer strikes, for stone), "pick" (press only for the ripe ones, for plants), "snap" (press fast, for wood) or "fish" (cast, wait for the bite and strike as the float goes under, then reel in; for a node fished with a rod).',
      }),
    ),
    hours: Type.Optional(
      Type.Tuple([Int(0, 23), Int(1, 24)], { description: 'Hours of the in-game day when it can be gathered, [from, to).' }),
    ),
    place: Type.Object(
      {
        slot: Id,
        scatter: Type.Optional(
          Type.Array(Id, {
            minItems: 1,
            uniqueItems: true,
            description: 'More resource slots that each hold exactly one of these nodes: a tree or a log standing where the map already shows one. They add supply only: `count`, the value and the opening\'s log floor follow the main slot.',
          }),
        ),
        water: Type.Optional(
          Type.Literal(true, {
            description: 'The nodes lie on the water tiles of the slot that touch the land, and are worked from the bank: fishing spots. Left out, they lie on the land tiles of the slot.',
          }),
        ),
      },
      { additionalProperties: false, description: 'An empty resource slot of the map (`count` nodes inside it), and optionally single-node slots scattered over the map.' },
    ),
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
    tool: Type.Optional({
      ...ToolKind,
      description: 'The tool the dig asks for and wears. Left out: the find is picked up by hand, with no timing window and no tool worn.',
    }),
    level: Int(1, 20, 'Digging level required.'),
    finds: Type.Array(Find, { minItems: 1, maxItems: 8 }),
    place: Place,
    pocket: Type.Optional({
      ...Id,
      description:
        "A wake pocket's own spot: only a character who woke in this pocket sees it and digs it, once, and it always gives its one find. A gift of the start, so it prices nothing (it is no source in the value table).",
    }),
  },
  { additionalProperties: false },
);

export const SearchRow = Type.Object(
  {
    item: Id,
    chance_pct: Int(1, 100, 'Chance of this row being inside after a refill. Each row is drawn on its own; a rare or legendary row is tilted by luck like a dig\'s rare find.'),
  },
  { additionalProperties: false },
);

export const SearchBody = Type.Object(
  {
    rows: Type.Array(SearchRow, { minItems: 1, maxItems: 8 }),
    place: Type.Object(
      { prop: Id },
      {
        additionalProperties: false,
        description:
          'The map prop (its `id`) that can be searched: pressing A beside it opens a window of what is inside. Nothing is put into it; it refills once a day at dawn (docs/design/SEARCH.md).',
      },
    ),
  },
  {
    additionalProperties: false,
    description: 'A searchable: a table of rows drawn once a day. It takes no tool and has no timing window. A treasure file carries `search` or `dig`, never both.',
  },
);

const RecipeLevel = Int(1, 20, 'The recipe\'s level in its profession: each missing level takes craft_level_step_bp off the chance (no wall). It sits inside the level band of the recipe\'s tier.');
const RecipeProfession = {
  ...Id,
  description: 'The profession that trains this recipe and sets its chance. Left out: the profession that works its station.',
};
const RecipeMiss = Type.Object(
  {
    keep_pct: Type.Optional(Int(0, 90, 'Part of each input a miss keeps, rounded down, at most 90 percent. Left out: params.craft_miss_keep_pct.')),
  },
  {
    additionalProperties: false,
    description:
      'What a missed craft leaves (G40): part of the inputs and nothing else, worth less than a success. Left out: the default share of the inputs. When the share leaves nothing, one unit of the most valuable input comes back.',
  },
);

export const RecipeBody = Type.Object(
  {
    station: Station,
    active_ms: Ms('Time the player is busy making it once.'),
    level: RecipeLevel,
    profession: Type.Optional(RecipeProfession),
    inputs: Type.Array(Stack, { minItems: 1, maxItems: 6 }),
    outputs: Type.Array(Output, { minItems: 1, maxItems: 4 }),
    miss: Type.Optional(RecipeMiss),
    known: Type.Union([Type.Literal('start'), Type.Literal('found')], {
      description: '"start": every player knows it. "found": learned from a recipe scrap found by digging, or from a quest.',
    }),
  },
  { additionalProperties: false },
);

export const ClassInput = Type.Object(
  {
    class: ItemClass,
    family: Type.Optional(Word('Only items of this family.')),
    min_tier: Int(1, 20, 'The lowest tier that fits.'),
    qty: Int(1, 999),
  },
  {
    additionalProperties: false,
    description: 'Any item of this class (and family, when named) at this tier or above. A base class also takes every class declared under it.',
  },
);

export const TemplateBody = Type.Object(
  {
    station: Station,
    active_ms: Ms('Time the player is busy making it once.'),
    level: RecipeLevel,
    profession: Type.Optional(RecipeProfession),
    inputs: Type.Array(Type.Union([Stack, ClassInput]), {
      minItems: 1,
      maxItems: 6,
      description: 'Items by id, or by class and lowest tier. At least one input names a class.',
    }),
    outputs: Type.Array(Output, { minItems: 1, maxItems: 4 }),
    miss: Type.Optional(RecipeMiss),
  },
  {
    additionalProperties: false,
    description:
      'A recipe template: the assembler turns it into one recipe for every combination of items that fit its class inputs, in a fixed order and never more than params.template_max_recipes. Every recipe it makes is known from the start.',
  },
);

const Ids = (description: string) => Type.Array(Id, { minItems: 1, maxItems: 4, description });

/**
 * A condition on the world, for a line that waits for it (docs/design/STORY.md
 * section 5: storylets and salience). Every field given must hold. The more a
 * condition names, the more specific it is, and the more specific line wins.
 */
export const When = Type.Object(
  {
    done: Type.Optional(Ids('Quests the player has finished.')),
    active: Type.Optional(Ids('Quests the player is on now.')),
    not_done: Type.Optional(Ids('Quests the player has not finished yet, on them or not.')),
    restored: Type.Optional(Ids('Places the player has mended.')),
    built: Type.Optional(Ids('Camp parts that stand, themselves or under an upgrade.')),
    has: Type.Optional(Ids('Items with at least one in the bag.')),
    visited: Type.Optional(Ids('Map slots the player has stood in.')),
    race: Type.Optional(Ids('Races the player may be: holds when the player is one of them. A line may differ by race; a quest step never does.')),
    time: Type.Optional(
      Type.Union([Type.Literal('day'), Type.Literal('night')], { description: 'By day (05:00 to 20:00) or by night.' }),
    ),
  },
  { additionalProperties: false, minProperties: 1, description: 'Holds when every condition it names holds.' },
);

export const Remark = Type.Object(
  {
    when: When,
    say: Type.Array(Text, { minItems: 1, maxItems: 2, description: 'One box, two at most (G21).' }),
    priority: Type.Optional(Int(0, 9, 'Higher is said first when more than one remark holds. Left out, 0.')),
  },
  {
    additionalProperties: false,
    description:
      'A standing line that waits for a change in the world and is said once, in place of the standing line. Of the remarks that hold, the highest priority wins, then the one whose condition names the most, then the first in the file.',
  },
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
    remarks: Type.Optional(Type.Array(Remark, { maxItems: 16 })),
    topics: Type.Optional(
      Type.Array(
        Type.Object(
          {
            ask: Type.String({ minLength: 1, maxLength: 40, description: 'The question the player can pick, for example "About the mist".' }),
            lines: Type.Array(Text, { minItems: 1, maxItems: 6 }),
            when: Type.Optional(When),
          },
          { additionalProperties: false },
        ),
        {
          maxItems: 8,
          description:
            'Things the player can ask about: always, or once the topic\'s `when` holds (G21). The menu shows four at most, the ones not yet asked first.',
        },
      ),
    ),
    shop: Type.Optional(Id),
    round: Type.Optional(
      Type.Array(
        Type.Object(
          {
            hours: Type.Tuple([Int(0, 23), Int(1, 24)], {
              description: 'From (inclusive) to (exclusive), game hours, inside one day. Outside every leg the character stands at home, on the slot.',
            }),
            via: Type.Array(Type.Tuple([Int(0, 1023), Int(0, 1023)]), {
              minItems: 1,
              maxItems: 48,
              description:
                'Tiles walked through in order, x then y, each one a foot can stand on: from home to the first, on through the rest, then back the same way home, at an even pace that fills the hours.',
            }),
          },
          { additionalProperties: false },
        ),
        {
          minItems: 1,
          maxItems: 4,
          description:
            "A character who walks a round by day (decision 27 of 22.10): the legs of the day, each away from home over its hours. Where the character stands at a game tick is the kernel's (`npcTile`), so a talk, a trade or a task finds them where they are.",
        },
      ),
    ),
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
    bed: Type.Optional(
      Type.Literal(true, {
        description:
          'The keeper gives a bed for the night (G16, G32): from 19:00 to dawn the player may sleep here, and wakes at 05:00 with full health. The night passes; nothing in it is skipped.',
      }),
    ),
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
  'maze',
  'stealth',
] as const;
export const QuestType = Type.Union(
  QUEST_TYPES.map((k) => Type.Literal(k)),
  {
    description:
      'The kind of question the quest asks: one of the fourteen in docs/design/GAME_RULES.md section 3. Two quests of one type never follow each other in a chain (G17). Optional in the schema so an old file still reads; the check refuses a quest without one since the core content declared it (GRUNT P-3, 8.10).',
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
    { kind: Type.Literal('tend'), fire: Type.Union([Id, Type.Literal('own')]) },
    {
      additionalProperties: false,
      description: 'Keep this fire burning without a gap from dusk through dawn. "own" is the fire the player kindled outside the town (G30, G48).',
    },
  ),
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
    pocket: Type.Optional({
      ...Id,
      description: "Offered to a character who woke in this wake pocket only: the pocket's own first task. Left out: every character. Never a race: no quest is gated by race.",
    }),
    type: Type.Optional(QuestType),
    summary: Text,
    steps: Type.Array(QuestStep, { minItems: 1, maxItems: 6 }),
    requires: Type.Optional(Type.Array(Id, { maxItems: 4 })),
    talk: Type.Optional(
      Type.Object(
        {
          offer: Type.Optional(Type.Array(Text, { minItems: 1, maxItems: 3, description: 'The giver asks. Left out, the summary.' })),
          waiting: Type.Optional(
            Type.Array(Text, { minItems: 1, maxItems: 2, description: 'The giver, while the player is on it. Left out, the summary.' }),
          ),
          done: Type.Optional(Type.Array(Text, { minItems: 1, maxItems: 3, description: 'The giver, when the player hands it in.' })),
          done_bitten: Type.Optional(
            Type.Array(Text, {
              minItems: 1,
              maxItems: 3,
              description: 'The giver, at the hand-in, when a predator bit the player while the task was open, on an outing that came home. Left out, done.',
            }),
          ),
          variants: Type.Optional(
            Type.Array(
              Type.Object(
                {
                  when: When,
                  offer: Type.Optional(Type.Array(Text, { minItems: 1, maxItems: 3 })),
                  waiting: Type.Optional(Type.Array(Text, { minItems: 1, maxItems: 2 })),
                  done: Type.Optional(Type.Array(Text, { minItems: 1, maxItems: 3 })),
                },
                { additionalProperties: false },
              ),
              {
                minItems: 1,
                maxItems: 4,
                description:
                  'Other words for the same task while a condition holds, for example `when.race`: the first variant that holds and names that part replaces it. The steps and the reward never change.',
              },
            ),
          ),
        },
        {
          additionalProperties: false,
          description: 'What the giver says, in the giver\'s voice. "{name}" in a line is the player\'s name.',
        },
      ),
    ),
    reward: Type.Object(
      {
        rep: Int(0, 100, 'Reputation with the giver. Never traded, so it can be generous.'),
        gold_mg: Type.Optional(Int(1, 10_000_000)),
        items: Type.Optional(Type.Array(RewardStack, { maxItems: 4 })),
        recipes: Type.Optional(Type.Array(Id, { maxItems: 4 })),
        opens: Type.Optional(
          Type.Array(Id, {
            maxItems: 2,
            description: 'Ids of restores the quest opens when it is done: a place reward, the way a restore opens by hand.',
          }),
        ),
      },
      { additionalProperties: false },
    ),
    maze: Type.Optional(
      Type.Object(
        {
          tier: Int(1, 4, 'The rung of help at the entrance: 1 a peek from above with a faint line of the route and the landmarks, 2 the peek with the landmarks lit a moment, 3 the peek of the shape alone, 4 no peek.'),
          area: { ...Id, description: 'The map area that frames the whole maze: stepping into it from outside is the entrance, and the peek fits it on the screen.' },
          landmark: Type.Optional({ ...SpriteRef, description: 'The sprite of the props inside the area that mark the way; tiers 1 and 2 light them in the peek.' }),
        },
        { additionalProperties: false, description: 'A maze quest only: where its shape is drawn and how much the entrance shows of it (DECISIONS 2026-10-11).' },
      ),
    ),
  },
  { additionalProperties: false },
);

export const ExpeditionBody = Type.Object(
  {
    place: Id,
    window: Type.Object(
      {
        bells: Type.Array(Type.Union([Int(20, 23), Int(0, 4)]), {
          minItems: 2,
          maxItems: 6,
          description: 'Night hours in the order they ring: every 20..23 hour before every 0..4 hour.',
        }),
      },
      { additionalProperties: false },
    ),
    exit: Id,
    chain: Type.Array(Id, { minItems: 3, maxItems: 5 }),
    climax: Type.Object(
      {
        slot: Id,
        lines: Type.Optional(
          Type.Array(Text, {
            minItems: 1,
            maxItems: 3,
            description: 'The narrator\'s boxes at the climax, the same whether the reward opens a way or the player opened it by hand.',
          }),
        ),
      },
      { additionalProperties: false },
    ),
    reward: Type.Object(
      {
        opens: Type.Optional(Type.Array(Id, { maxItems: 2 })),
        items: Type.Optional(Type.Array(RewardStack, { maxItems: 4 })),
      },
      { additionalProperties: false },
    ),
    on_miss: Type.Literal('wait'),
  },
  {
    additionalProperties: false,
    description: 'A place entered under a clock: its giver-less quest chain persists, and a missed window waits for another night (G36).',
  },
);

export const RestoreBody = Type.Object(
  {
    place: Place,
    before: SpriteRef,
    after: SpriteRef,
    inputs: Type.Array(Stack, {
      maxItems: 6,
      description: 'What the player brings to restore it. Empty: it does not open by hand, only as a quest\'s reward.opens.',
    }),
    active_ms: Ms('Time the player is busy restoring it.'),
    passable: Type.Boolean({ description: 'Whether the restored thing can be walked over (a bridge).' }),
    sign: Type.Optional(Name),
    mist: Type.Optional(
      Int(1, 64, "Tiles around the place that the mist leaves clear once it is mended (B2, NEXT 16). Left out: the mend clears none. The kernel does not read it; the client draws it."),
    ),
    stone: Type.Optional(
      Type.Object(
        {
          names: Type.Array(Type.String({ pattern: '^\\S{1,16}$' }), {
            minItems: 6,
            maxItems: 12,
            description: 'Names cut by earlier hands, one word each, top to bottom. Written content: the stone is the speaker of every line on it (STORY.md S2).',
          }),
          default_name: Type.String({
            pattern: '^[A-Za-z0-9 _-]{1,16}$',
            description: 'The name cut for a player who types none. The kernel\'s name rule: 1 to 16 letters, digits, spaces, "_" or "-".',
          }),
          purse: Type.Array(Text, {
            minItems: 1,
            maxItems: 2,
            description: 'What the stone says after the mend, in its own voice: never who left the purse or when (STORY.md S1, S2).',
          }),
        },
        {
          additionalProperties: false,
          description: 'The mended place is a returners\' stone (NEXT 16 e): the written names above a line the player carves. Left out: the place keeps the plain "Mended by" sign.',
        },
      ),
    ),
    done: Type.Optional(
      Type.Array(Text, {
        minItems: 1,
        maxItems: 2,
        description: 'The narrator, when the place is mended: what is there now, never what was (STORY.md S1). "{name}" is the player\'s name.',
      }),
    ),
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
    tier: Type.Optional(
      Int(1, 20, 'Tier of the station this part provides, 1 when left out. A recipe needs a station of at least its own tier.'),
    ),
    bag_bonus: Type.Optional(Int(1, 40)),
    upgrades: Type.Optional({
      ...Id,
      description:
        'The camp part this one is built over, in the same slot: that part stands first, and this one replaces it. It gives at least what that part gave.',
    }),
  },
  { additionalProperties: false },
);

const Tile = (description: string) =>
  Type.Object({ x: Int(0, 1023), y: Int(0, 1023) }, { additionalProperties: false, description });

/** Six attribute points, each 0 to 5. */
const AttributeSet = Type.Object(
  {
    might: Int(0, 5, 'Bag places; heavy work; later combat. Was "carry".'),
    senses: Int(0, 5),
    agility: Int(0, 5),
    luck: Int(0, 5),
    stamina: Int(0, 5),
    spirit: Int(0, 5),
  },
  { additionalProperties: false },
);

/**
 * What a race's body does beyond its six numbers (DECISIONS.md, 2026-10-23): a closed list, read by the kernel.
 * rest_mend_permille: what a rest by a fire mends, against everyone's 1000; food_fill_permille: what food fills,
 * against 1000; pace_load_permille: how much of the load counts for the walking pace, against 1000; bag_places:
 * places added to any bag on the back (never to bare hands).
 */
export const BODY_EFFECTS = ['rest_mend_permille', 'food_fill_permille', 'pace_load_permille', 'bag_places'] as const;
export const BodyEffect = Type.Union(BODY_EFFECTS.map((k) => Type.Literal(k)), {
  description: 'What the body changes: the mend of a rest by a fire, the fill of food, the share of the load that counts for pace, or the places of any bag.',
});

/**
 * A race (DECISIONS.md, 2026-10-22): chosen at the title, the player's fixed profile, the two home
 * attributes each world grades, and what it wears on the first morning. The race never gates a quest
 * step; a line may differ by race (`when.race`).
 */
export const RaceBody = Type.Object(
  {
    name: Name,
    about: { ...Text, description: 'Who they are, in one or two present-tense sentences, shown on the title card.' },
    attributes: { ...AttributeSet, description: 'The fixed profile: no free points at the title. The check holds every race to one total.' },
    home: Type.Array(AttributeName, {
      minItems: 2,
      maxItems: 2,
      uniqueItems: true,
      description: 'The two home attributes: a world that is strong for the race lifts each by one, a weak world lowers each by one (never below 0).',
    }),
    grades: Type.Optional(
      Type.Record(WorldId, Type.Union(WORLD_GRADES.map((g) => Type.Literal(g))), {
        description: 'How each world takes the race. A world left out is "normal". The valley is neutral to every race.',
      }),
    ),
    outfit: Type.Optional(
      Type.Array(Stack, {
        maxItems: 3,
        description: 'What the race wears on the first morning: put in the bag and worn at once. Never a weapon, never the pocket\'s tool.',
      }),
    ),
    body: Type.Optional(
      Type.Object(
        {
          name: Name,
          about: { ...Text, description: 'The body fact in one plain sentence: the good side and its cost.' },
          effects: Type.Array(
            Type.Object({ effect: BodyEffect, value: Int(1, 5000, 'Permille for the three rates, a count for bag_places.') }, { additionalProperties: false }),
            { minItems: 1, maxItems: 2, description: 'One or two effects, each named once: the good side and, when the body pays for it here, the cost.' },
          ),
        },
        {
          additionalProperties: false,
          description:
            'One body fact per race, equal in size (DECISIONS.md, 2026-10-23): a weakness always matched by a real advantage. It never opens or closes a place (G70).',
        },
      ),
    ),
    sprite: { ...SpriteRef, description: 'The figure the race is drawn with. Until the race\'s own art comes, an existing sheet.' },
    sprite_alt: Type.Optional(
      Type.String({
        pattern: SPRITE_PATTERN,
        maxLength: 120,
        description: 'Another look of the same race (for example a woman instead of a man), offered by one toggle on the character screen. Same sprite sizes and directions as `sprite`.',
      }),
    ),
  },
  { additionalProperties: false },
);

/**
 * A wake pocket (DECISIONS.md, 2026-10-22): one of the places a new game wakes in, drawn by the
 * world's seed, never chosen. It adds nothing to the attributes. Its tools lie on the ground by the
 * wake tile, found by hand; they are never in the bag at the start.
 */
export const PocketBody = Type.Object(
  {
    name: Name,
    wake: Tile('The tile the character wakes on.'),
    pocket: Type.Optional(
      Int(1, 32, "Tiles of the mist's clear pocket around the wake tile (B2, NEXT 16). Left out: 5. The kernel does not read it; the client draws it."),
    ),
    pocket_grown: Type.Optional(
      Int(1, 32, "Tiles of that pocket once the pocket's first task is done. Left out: 7. Never less than `pocket`."),
    ),
    intro: Type.Optional(
      Type.Array(Text, {
        minItems: 1,
        maxItems: 4,
        description: "What the narrator says as the character wakes, one box a line. Left out: the game's own waking lines.",
      }),
    ),
    ground: Type.Array(Stack, {
      minItems: 1,
      maxItems: 3,
      description:
        "What lies on the ground by the wake tile: each stack is given by one of the pocket's own spots (a treasure whose `pocket` names this pocket, picked up by hand). A reward's `instead` reads it.",
    }),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------- reactions

/**
 * A world reaction (docs/design/REACTIONS.md): a rule the kernel reads and never runs. It hangs on
 * one kind of thing, holds while every condition it names holds, and has one effect. Its answer is a
 * pure function of the content, the state of the one entity it hangs on, the tick and the seed, so
 * nothing runs off screen and a replay gives the same answer. The lists are closed: a new condition
 * or effect is a kernel release.
 */
export const CUES = ['birds_lift', 'fish_rise'] as const;
export const Cue = Type.Union(CUES.map((k) => Type.Literal(k)), {
  description: 'A sign the client draws at a tile, with a shape and a sound and never a number or a word: birds lift from cover, fish rise on the water.',
});

export const REACTION_SIDES = ['here', 'above', 'below', 'left', 'right'] as const;

/** The weather of a region for one game day, decided from the world's seed (REACTIONS.md, phase B). */
export const WEATHERS = ['clear', 'rain', 'fog'] as const;
export const Weather = Type.Union(WEATHERS.map((k) => Type.Literal(k)), {
  description: 'The sky over a region for a whole game day: clear, rain or fog. The same for every player in the region and on every replay.',
});

const ReactionOn = Type.Union(
  [
    Type.Object({ resource: Type.Union([Id, Type.Literal('*')]) }, { additionalProperties: false }),
    Type.Object({ treasure: Type.Union([Id, Type.Literal('*')]) }, { additionalProperties: false }),
    Type.Object({ tag: TileTag }, { additionalProperties: false }),
  ],
  { description: 'What it hangs on: every node of a resource, every spot of a treasure ("*": of every one), or every tile of a ground tag.' },
);

const ReactionWhen = Type.Object(
  {
    hours: Type.Optional(
      Type.Tuple([Int(0, 23), Int(1, 24)], { description: 'Game hours it holds, [from, to), as a node\'s `hours`.' }),
    ),
    night: Type.Optional(Type.Boolean({ description: 'true: only at night (20:00 to 05:00); false: only by day.' })),
    ready_for_ms: Type.Optional(Ms('The node it hangs on has stood ready, untouched, for at least this long, in game ms.')),
    on_tag: Type.Optional({ ...TileTag, description: 'The tile of the node or spot it hangs on carries this ground tag.' }),
    player_within: Type.Optional(Int(1, 8, 'The player stands within this many tiles (the larger of the two distances).')),
    unseen: Type.Optional(
      Type.Literal(true, { description: 'The spot it hangs on lies beyond the player\'s sense reach, so the find does not show yet.' }),
    ),
    chance_pct: Type.Optional(
      Int(1, 100, 'It holds on this many days in a hundred, drawn once a game day for each thing it hangs on, the same on every replay.'),
    ),
    weather: Type.Optional({ ...Weather, description: 'The day\'s weather in the region of the thing it hangs on is this one.' }),
  },
  { additionalProperties: false, minProperties: 1, description: 'Holds when every condition it names holds.' },
);

const AppearNode = Type.Object(
  {
    output: Id,
    yield: Int(1, 20, 'Units gathered per execution at perfect timing.'),
    active_ms: Ms('Time the player is busy gathering it once.'),
    respawn_ms: Ms('Time before it can show again once taken, while its condition still holds. Waiting is never paid.'),
    level: Int(1, 20, 'Foraging level required.'),
    tool: Type.Optional(ToolKind),
    game: Type.Optional(
      Type.Union([Type.Literal('timing'), Type.Literal('strike'), Type.Literal('pick'), Type.Literal('snap')], {
        description: 'The minigame played when gathering it, as a resource\'s `game`.',
      }),
    ),
    sprite: SpriteRef,
    at: Type.Union(REACTION_SIDES.map((k) => Type.Literal(k)), {
      description: 'The tile it shows on: the tile of the thing it hangs on, or the one next to it on that side.',
    }),
  },
  {
    additionalProperties: false,
    description:
      'A node that exists only while the condition holds, with the id "<reaction id>@<node id>". It is a source of its own in the value table, priced as any node (R6, R7).',
  },
);

const ReactionThen = Type.Union(
  [
    Type.Object({ appear: AppearNode }, { additionalProperties: false }),
    Type.Object(
      { wait: Int(500, 2000, 'Scales the respawn of the node it hangs on, in permille. Waiting is never paid, so no value moves.') },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        cue: Cue,
        spread: Type.Optional(Int(0, 2, 'The cue shows on a tile drawn within this many tiles of the thing, so it marks an area and not the tile. Left out: 0.')),
      },
      { additionalProperties: false },
    ),
  ],
  { description: 'Its one effect: a node that appears, a slower or quicker respawn, or a sign for the eyes and ears.' },
);

export const ReactionBody = Type.Object(
  { on: ReactionOn, when: ReactionWhen, then: ReactionThen },
  { additionalProperties: false },
);

export const EFFECTS = [
  'see_ripe',
  'timing_window_pct',
  'second_hint',
  'rare_find_pct',
  'craft_speed_pct',
  'meal_fill_pct',
  'gather_speed_pct',
  'dig_speed_pct',
  'craft_chance_pct',
] as const;
export const Effect = Type.Union(EFFECTS.map((k) => Type.Literal(k)), {
  description:
    'What a technique does. A closed list: the kernel knows how to apply each one. A craft effect of a technique (craft_speed_pct, craft_chance_pct) helps the recipes of its own profession.',
});

export const ProfessionBody = Type.Object(
  {
    name: Name,
    verb: Type.Union([Type.Literal('gather'), Type.Literal('fell'), Type.Literal('dig'), Type.Literal('fish'), Type.Literal('craft')]),
    stations: Type.Optional(
      Type.Array(Station, {
        minItems: 1,
        maxItems: 4,
        uniqueItems: true,
        description: 'A craft profession only: the stations whose recipes it gates when a recipe names no profession. One profession per station.',
      }),
    ),
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

/**
 * The growth frame (docs/design/GROWTH.md section 4; DECISIONS.md 2026-10-22 "The tree" and "No
 * percentages on screen"): a school is one wing of the tree, tied to a profession; its nodes are bought
 * with skill points by choice, never handed out by level. A small node moves one number and is always
 * on; a major node changes a verb or teaches a technique; a corner node is where the race (the trunk)
 * meets the school, one per race and school; a keystone is always on and changes how a whole school
 * plays. The tree is data, not layout: it carries hundreds of nodes in many wings, each wing laid out
 * from its paths (or from places it gives), grouped in clusters and joined to other wings by needs.
 */
export const NODE_SIZES = ['small', 'major', 'corner', 'keystone'] as const;
export const NodeSize = Type.Union(NODE_SIZES.map((k) => Type.Literal(k)));
const NodeId = Type.String({
  pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
  maxLength: 40,
  description: 'The node\'s name inside its school, for example "steady". A learned node is kept as "<school id>/<node id>".',
});
const NodeRef = Type.String({
  pattern: '^([a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*/)?[a-z0-9]+(-[a-z0-9]+)*$',
  maxLength: 120,
  description: 'A node of the same school by its id ("steady"), or of another school by "<school id>/<node id>" ("core/digging-school/steady").',
});
/** The colour families of the core palette a wing may be drawn in (tools/src/kit/palette.ts; the kit theme maps each to its colours). */
export const TREE_TINTS = ['green', 'wood', 'skin', 'red', 'water', 'plum', 'fire', 'grey'] as const;
const AttributeKey = Type.Object(
  {
    might: Type.Optional(Int(1, 10)),
    senses: Type.Optional(Int(1, 10)),
    agility: Type.Optional(Int(1, 10)),
    luck: Type.Optional(Int(1, 10)),
    stamina: Type.Optional(Int(1, 10)),
    spirit: Type.Optional(Int(1, 10)),
  },
  {
    additionalProperties: false,
    description: 'Keys: the attribute pips the node asks for, for example { "senses": 3 }. A key opens the node; it is never spent.',
  },
);

export const SchoolNode = Type.Object(
  {
    id: NodeId,
    name: { ...Name, description: 'A thing the player knows how to do, for example "Depth sense".' },
    text: { ...Text, description: 'One sentence in words, never a number or a percentage (the number stays in the code).' },
    size: NodeSize,
    needs: Type.Optional(
      Type.Array(NodeRef, {
        maxItems: 3,
        uniqueItems: true,
        description: 'The nodes learned before this one, all of them: its place on the path. Most are of the same school; a node of another school joins the two wings.',
      }),
    ),
    cost: Type.Optional(
      Int(1, 20, 'Its price in skill points, inside the band of its size (params growth.cost, min to max). Left out: the size\'s price.'),
    ),
    key: Type.Optional(AttributeKey),
    effect: Effect,
    value: Int(0, 100, 'The number the effect moves. Shown only on a long press, never on the tree.'),
    slot: Type.Optional(
      Type.Boolean({
        description: 'A technique: it works only while it sits in an active slot of the build. Left out: always on once learned. Never on a small node.',
      }),
    ),
    race: Type.Optional({ ...Id, description: 'A corner node only: the race whose node this is. Only a player of that race sees and learns it.' }),
    icon: Type.Optional({ ...Id, description: 'An item whose sprite pictures the node on the tree.' }),
    cluster: Type.Optional({ ...NodeId, description: 'The cluster of its school it belongs to (the school\'s `clusters`): nodes that stand together.' }),
    pos: Type.Optional(
      Type.Object(
        { x: Int(-400, 400), y: Int(-400, 400) },
        {
          additionalProperties: false,
          description: 'Where it stands on the tree, in steps from the trunk (x to the right, y down). A school gives every node a place or none; with none, the screen lays the school out from its paths.',
        },
      ),
    ),
  },
  { additionalProperties: false },
);

export const SchoolBody = Type.Object(
  {
    name: Name,
    profession: { ...Id, description: 'The profession whose wing this is. The profession keeps its levels; the school is what the points buy.' },
    nodes: Type.Array(SchoolNode, {
      minItems: 1,
      maxItems: 400,
      description: 'The paths and the corners. At most `growth.nodes_max` nodes for each race (the paths and that race\'s corner).',
    }),
    tint: Type.Optional(
      Type.Union(TREE_TINTS.map((k) => Type.Literal(k)), { description: 'The colour family of the core palette the wing is drawn in. Left out: wood.' }),
    ),
    angle: Type.Optional(
      Int(0, 359, 'The direction the wing grows from the trunk, in degrees clockwise from the right. Left out: the wings share the circle in the order of their ids.'),
    ),
    clusters: Type.Optional(
      Type.Array(Type.Object({ id: NodeId, name: Name }, { additionalProperties: false }), {
        maxItems: 40,
        description: 'Named groups of the school\'s nodes, for example "the trowel". A node names its cluster.',
      }),
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
const LightKey = Type.Object(
  {
    at: Type.String({ pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$', description: 'The hour and minute the wash is at its own strength, for example "16:30".' }),
    tint: Type.String({ pattern: '^#[0-9a-f]{6}$', description: 'The colour the scene is multiplied by at that hour.' }),
    pct: Int(0, 100, 'How strong the wash is at that hour, in whole percent. The hours between two keys step evenly.'),
  },
  { additionalProperties: false },
);

/** One hour of the sun's shear (STYLE section 4): the shadow leans right and away from the viewer by these shares of the caster's height. */
const SunKey = Type.Object(
  {
    at: Type.String({ pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$', description: 'The hour and minute the sun is at its own shear, for example "16:30".' }),
    right: Int(-200, 200, 'How far the shadow leans right, in percent of the caster\'s height; negative in the morning, positive in the evening.'),
    down: Int(-100, 100, 'How far the shadow leans toward the viewer, in percent of the caster\'s height; negative when the sun stands south (STYLE section 4: the shadow falls up-screen, away from the viewer, behind the caster).'),
  },
  { additionalProperties: false },
);

/** The light block in params: the hour's wash and the sun's shear (ART_SYSTEM section 2, STYLE sections 4 and 5). */
export const LightParams = Type.Object(
  {
    keys: Type.Array(LightKey, {
      minItems: 2,
      maxItems: 12,
      description:
        'The hours the valley is washed in a colour (ART_SYSTEM section 2). Today\'s curve is the gold #eda83a at 40% around 05:30 and 20:00 and none at noon; the cool and dusk hour tints land with the L2 pick. The scene multiplies by the wash between keys, in whole percent.',
    }),
    sun: Type.Optional(
      Type.Object(
        {
          alpha: Int(0, 100, 'How dark the cast shadow is, in whole percent (STYLE section 4: 30).'),
          cap: Int(0, 200, 'The longest a shadow may be, in percent of the caster\'s height (STYLE section 4: 110).'),
          keys: Type.Array(SunKey, {
            minItems: 2,
            maxItems: 12,
            description:
              'The sun\'s shear by hour (STYLE section 4): the shadow leans right and toward the viewer by these shares of the caster\'s height, so a negative `down` is the sun in the south and the shadow falling away, up-screen. The hours between two keys step evenly; outside the first and the last the sun is down.',
          }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

/** Five numbers, one for each band of five levels (PROGRESSION 3.3), from band 1. */
const Band5 = (min: number, max: number, description: string) =>
  Type.Array(Type.Integer({ minimum: min, maximum: max }), { minItems: 5, maxItems: 5, description });

/** One whole number for each ceiling category of PROGRESSION 4.7. */
const PerCategory = (max: number, description: string) =>
  Type.Object(
    Object.fromEntries(['work', 'move', 'carry', 'health', 'sustain', 'find', 'sense', 'place'].map((k) => [k, Type.Integer({ minimum: 0, maximum: max })])),
    { additionalProperties: false, description },
  );

/** The one internal difficulty scale (DECISIONS 2026-10-09) and the knobs of the difficulty reckoning (NEXT 19 b). The tool reads them; the kernel does not yet. */
const DifficultyParams = Type.Object(
  {
    ratio_permille: {
      ...Bounded,
      description: 'Each step of the scale multiplies effort and the health a hazard takes by this, in permille (9.10: 1500). The growth curve of a school uses the same ratio (PROGRESSION 3.2).',
    },
    hazard_bp: {
      ...Bounded,
      description: 'How often a hazard shows grows by this per step of d: the chance in a game minute after dark or in the mist is hazard_bp * d basis points (SETTLEMENT 3.5). A spawn model; today hazards are authored.',
    },
    grind_passes_max: {
      ...Bounded,
      description: 'The reckoning: how many times a player is assumed to work each nearer node on the way (each pass waits for the node to grow back).',
    },
    quest_share_pct: {
      ...Bounded,
      description: 'The reckoning: the share of the next level\'s active time a place\'s quests should pay, in percent; the rest is grinding.',
    },
    quest_minutes_max: { ...Bounded, description: 'The reckoning: the longest active time one recommended quest asks, in real minutes.' },
    quests_max: { ...Bounded, description: 'The reckoning: the most quests it recommends at one place.' },
  },
  { additionalProperties: false, description: 'The difficulty reckoning (pnpm map:difficulty): it recommends, never places.' },
);

/** The balance model of PROGRESSION 4.7 and BODY_CLOCKS 5-7, as numbers the balance prover (pnpm balance) reads. */
const BalanceParams = Type.Object(
  {
    t1_ms: {
      ...Bounded,
      description: 'A school\'s first step, in active milliseconds; step i takes t1 * ratio^(i-1) (PROGRESSION 3.2). The bounds are the owner\'s range, 25 to 30 seconds.',
    },
    school_steps: { ...Bounded, description: 'Steps from level 1 to mastery (PROGRESSION 3.2: twenty, so mastery is level 21).' },
    band_size: { ...Bounded, description: 'Levels in one band (PROGRESSION 3.3).' },
    catalogue_hours_min: { ...Bounded, description: 'The fewest active hours that master every school of the catalogue (PROGRESSION 3.2: 800).' },
    mentor_bonus_pct: { ...Bounded, description: 'The one experience source beside the work itself: the mentor\'s bonus, in percent (PROGRESSION 3.7, red line B).' },
    group_share_max_permille: { ...Bounded, description: 'The most a group member earns from another\'s work, in permille of the member\'s own (PROGRESSION 3.7, Q7).' },
    loop_profit_max_mg: { ...Bounded, description: 'The most gold any buy, craft and sell cycle at a vendor may make, in milligold (red line A: 0).' },
    ceilings: Type.Object(
      {
        work: Band5(0, 100, 'Time off a school\'s work, all sources, in percent.'),
        move: Band5(0, 100, 'Time off a step, a crossing or an oar stroke, in percent.'),
        carry: Band5(0, 100, 'The weight limit above might\'s and the bag\'s, in percent.'),
        health: Band5(0, 200, 'The health cap above the attributes\' cap, in percent.'),
        sustain: Band5(0, 100, 'Health back a game hour while a place drains, regen and food together, in percent of the cap.'),
        find: Band5(0, 100, 'Rare-find points.'),
        sense: Band5(0, 20, 'Tiles of sight in the dark or of a trail.'),
        place: Band5(0, 4, 'Answer steps on one condition: garment, master step and dish together.'),
      },
      { additionalProperties: false, description: 'Each category\'s ceiling by the wearer\'s band (PROGRESSION 4.7): every source adds and the sum stops here. Never falls with the band.' },
    ),
    raise_step: PerCategory(100, 'What one ceiling raiser adds to its category\'s top-band ceiling (PROGRESSION 4.7).'),
    raisers_max: PerCategory(10, 'How many raisers of each category exist (PROGRESSION 4.7: ten in all today).'),
    wall_margin_bp: { ...Bounded, description: 'A wall\'s witness ends with at least this share of the health cap and of the timer to spare, in basis points.' },
    wall_cheese_gap: { ...Bounded, description: 'Nothing from this many bands below a wall\'s band passes it (PROGRESSION 4.7: 2).' },
    top_builds_n: { ...Bounded, description: 'How many strongest builds a band the prover lists (a warning, never a failure).' },
    top_over_median_max_permille: { ...Bounded, description: 'The strongest build of a band warns when its score stands more than this above the band\'s median, in permille.' },
    proof_enum_max: { ...Bounded, description: 'Combinations walked in full; above it the proof walks each slot\'s Pareto front.' },
    rarity_effects_max: Type.Array(Type.Integer({ minimum: 0, maximum: 4 }), {
      minItems: 4,
      maxItems: 4,
      description: 'The most effects a thing carries by rarity, common, uncommon, rare, legendary (PROGRESSION 5.7); a trait and a dish effect count.',
    }),
    rarity_band_permille: Type.Array(Type.Array(Type.Integer({ minimum: 0, maximum: 1000 }), { minItems: 2, maxItems: 2 }), {
      minItems: 4,
      maxItems: 4,
      description: 'Each rarity\'s share of the tier\'s full strength, low and high, in permille (PROGRESSION 5.7); common is the smallest step, read as 0 here.',
    }),
    trait_strength_by_tier: Type.Array(Type.Integer({ minimum: 0, maximum: 4 }), {
      minItems: 1,
      maxItems: 10,
      description: 'A garment trait\'s strength by the tier it counts as, from tier 1 (BODY_CLOCKS 6.2).',
    }),
    master_step: { ...Bounded, description: 'What a master piece adds to its trait (BODY_CLOCKS 6.2).' },
    dish_place_step: { ...Bounded, description: 'What a dish of the same condition adds; only one dish counts (BODY_CLOCKS 6.2).' },
    dish_slots: { ...Bounded, description: 'How many dishes act at once (BODY_CLOCKS 7).' },
    grade_walk_permille: Type.Array(Type.Integer({ minimum: 1000, maximum: 5000 }), {
      minItems: 5,
      maxItems: 5,
      description: 'The slow of a remaining grade 0 to 4, in permille of a step\'s time (BODY_CLOCKS 5.2).',
    }),
    grade_drain_pct: Type.Array(Type.Integer({ minimum: 0, maximum: 100 }), {
      minItems: 5,
      maxItems: 5,
      description: 'The drain of a remaining grade 0 to 4, in percent of the health cap a game hour (BODY_CLOCKS 5.2).',
    }),
  },
  { additionalProperties: false, description: 'The balance model (PROGRESSION 4.7): two red lines, rising ceilings, walls proven both ways. Read by tools only, until the kernel reads it.' },
);

export const ParamsBody = Type.Object(
  {
    k_permille: Bounded,
    light: Type.Optional(LightParams),
    k_craft_permille: {
      ...Bounded,
      description:
        'What the trader pays for a made good, an item whose value comes from a recipe, per mille of r * V; k_permille holds for the rest. At least k_permille and always below 1000, so the trader never pays what the shop charges (DECISIONS.md, 2026-10-09: the crafting economy).',
    },
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
    open_tiers: {
      ...Bounded,
      description: 'The highest item tier the world has opened. A stage or a new town opens the next one.',
    },
    tier_min_level: Type.Array(Type.Integer({ minimum: 1, maximum: 20 }), {
      minItems: 1,
      maxItems: 20,
      description:
        'The lowest level of each tier, from tier 1. A recipe of tier t needs a level from entry t up to one below entry t + 1 (up to 20 for the last), and a node that gives tier 3 or above needs at least entry t, or a slow respawn. Starts at 1 and rises with every tier; one entry for every open tier at least.',
    }),
    template_max_recipes: {
      ...Bounded,
      description: 'The most recipes one recipe template may make.',
    },
    craft_chance_bp: Type.Array(Type.Integer({ minimum: 1000, maximum: 10_000 }), {
      minItems: 1,
      maxItems: 20,
      description:
        'The chance a craft succeeds at exactly its level, in basis points, by the recipe\'s tier from tier 1; the last entry holds for the tiers above it. Never rises with the tier; 10000 is a sure craft.',
    }),
    craft_level_step_bp: {
      ...Bounded,
      description: 'What each level of the recipe\'s profession above the recipe\'s level adds to the craft chance, in basis points.',
    },
    craft_luck_max_permille: {
      ...Bounded,
      description:
        'The largest part of the gap to a sure craft that luck and luck items close, in permille: skill decides, luck tilts (G40).',
    },
    craft_miss_keep_pct: {
      ...Bounded,
      description: 'Part of each input a missed craft keeps when the recipe names no share, rounded down.',
    },
    wear_effect_max_pct: Type.Array(Type.Integer({ minimum: 0, maximum: 100 }), {
      minItems: 1,
      maxItems: 20,
      description:
        'The largest value of one effect on a worn item, by the item\'s tier from tier 1; the last entry holds for the tiers above it. Never falls with the tier.',
    }),
    wear_set_bonus_pct: {
      ...Bounded,
      description: 'How much a full set adds to the effects of its pieces, in percent of their sum, rounded down.',
    },
    rarity_bonus_ms: Type.Object(
      { common: Type.Integer(), uncommon: Type.Integer(), rare: Type.Integer(), legendary: Type.Integer() },
      { additionalProperties: false },
    ),
    drift_budget_permille: Bounded,
    hp_cap: {
      ...Bounded,
      description: 'The health bar\'s base top in whole points; each point of stamina adds per_point.stamina. Nothing drains it by the clock (G28).',
    },
    day_length_ms: Bounded,
    walk_step_ms: {
      ...Bounded,
      description: 'Milliseconds the player takes to walk one tile. The client walks at this pace; the kernel checks a position report against it (DECISIONS.md, 2026-10-10: health and hazards).',
    },
    move_reach_max: Type.Optional({
      ...Bounded,
      description: 'The maximum number of tiles a movement report may cover after the walk-time allowance (G56). Defaults to 32.',
    }),
    hp_low_pct: {
      ...Bounded,
      description: 'Work takes half as long again while health is at or below this share of its cap, in percent. 0 slows it only when health is empty (G32).',
    },
    fire: Type.Object(
      {
        cap: { ...Bounded, description: 'Most logs of burn time a fire may hold ahead of the game tick.' },
        log_ms: { ...Bounded, description: 'Game milliseconds one wood item adds to a fire.' },
        warn_min: { ...Bounded, description: 'Game minutes before a burning fire goes out when its warning is shown.' },
        safe_tiles: { ...Bounded, description: "How far from the player's own fire, in tiles, the ground is safe while it burns: 1 is its tile and the ring around it (G30)." },
        burn_pct_per_d: { ...Bounded, description: "How much faster a log of the player's own fire burns for each step of the area's danger d, in percent (G30, G48)." },
      },
      { additionalProperties: false, description: 'A tended fire uses the game tick, which pauses while the player is away.' },
    ),
    hazard: Type.Object(
      {
        predator: Type.Object(
          {
            reach: { ...Bounded, description: 'Tiles from its footprint within which a predator notices the player, unless the prop says otherwise.' },
            pace_ms: { ...Bounded, description: 'Game milliseconds a predator on a round takes to walk one tile.' },
            eyes: { ...Bounded, description: 'Tiles ahead watched by a predator on a round.' },
            catch_ms: { ...Bounded, description: 'From the start of a chase to the first bite.' },
            bite_ms: { ...Bounded, description: 'Between one bite and the next.' },
            bite_pct: { ...Bounded, description: 'What one bite takes, in percent of the health cap.' },
            refill_bp: {
              ...Bounded,
              description:
                'How high a hunt outrun to a safe place lifts health, in basis points of the health cap: it gives back what its bites took, up to this share. It never lowers health.',
            },
          },
          { additionalProperties: false },
        ),
        pit: Type.Object({ harm_pct: { ...Bounded, description: 'What stepping into a pit takes, in percent of the health cap.' } }, { additionalProperties: false }),
        trap: Type.Object({ harm_pct: { ...Bounded, description: 'What stepping on a trap takes, in percent of the health cap.' } }, { additionalProperties: false }),
        deep_water: Type.Object({ harm_pct: { ...Bounded, description: 'What stepping into deep water takes, in percent of the health cap.' } }, { additionalProperties: false }),
      },
      { additionalProperties: false, description: 'How hard each kind of hazard hits (G30, G34). A hazard is a rule, not a roll.' },
    ),
    bag_base: {
      ...Bounded,
      description: 'Places with nothing on the back: hands and belt (DECISIONS.md, 2026-10-23). A bag on the back gives its own `wear.places` instead.',
    },
    place_stack: {
      ...Bounded,
      description: 'Things of one kind that share one place: a place holds a stack of up to this many (DECISIONS.md, 2026-10-23). Weight still counts every unit.',
    },
    load: Type.Object(
      {
        base: { ...Bounded, description: 'The weight limit before might: the limit is this plus `per_point.might` for each point, plus a frame bag\'s `load_bonus`.' },
        light_permille: { ...Bounded, description: 'Up to this share of the limit the pace is light; up to the whole limit it is steady; above it, heavy.' },
        max_permille: { ...Bounded, description: 'Beyond this share of the limit nothing more is picked up.' },
        light_step_ms: { ...Bounded, description: 'Milliseconds a tile at the light pace. The steady pace is `walk_step_ms`.' },
        heavy_step_ms: { ...Bounded, description: 'Milliseconds a tile at the heavy pace.' },
        heavy_breath_permille: { ...Bounded, description: 'How fast breath (stamina) refills in a fight while heavy, against 1000.' },
      },
      {
        additionalProperties: false,
        description:
          'Weight and pace (DECISIONS.md, 2026-10-23): every item weighs, and the load against a limit from might sets one of three walking paces.',
      },
    ),
    starting_gold_mg: Bounded,
    per_point: Type.Object(
      { might: Bounded, senses: Bounded, agility_pct: Bounded, luck_permille: Bounded, stamina: Bounded, spirit: Bounded },
      {
        additionalProperties: false,
        description:
          'What one point in an attribute adds: weight limit (might), tiles of dig-hint distance (senses), percent wider timing windows in every minigame (agility), permille on rare and legendary finds inside the power cap and on keeping one unit after a missed gather (luck), and fullness (stamina). Spirit is defined and read by no rule yet: its first readers come with the night layer and the tree.',
      },
    ),
    growth: Type.Optional(
      Type.Object(
        {
          cost: Type.Object(
            { small: Bounded, major: Bounded, corner: Bounded, keystone: Bounded },
            {
              additionalProperties: false,
              description: 'Skill points a node costs, by its size (GROWTH section 3.6): the value is the price, and a node that names its own `cost` stays between min and max.',
            },
          ),
          nodes_max: Int(1, 400, 'At most this many nodes a player of one race sees in one school: its paths and that race\'s corner.'),
          slot_levels: Type.Array(Type.Integer({ minimum: 1, maximum: 40 }), {
            minItems: 1,
            maxItems: 8,
            description: 'The character level each active slot of the build opens at, from the first slot, never falling (GROWTH section 3.3: two at level 1, then one more at 5, 10 and 15).',
          }),
        },
        { additionalProperties: false, description: 'The skill tree: what a node costs and when the build\'s slots open. Left out: the tree is closed.' },
      ),
    ),
    difficulty: Type.Optional(DifficultyParams),
    balance: Type.Optional(BalanceParams),
  },
  { additionalProperties: false },
);

/** What a ramp is for. A creator's kit declares at most four of them (ART_SYSTEM section 3). */
export const RAMP_FOR = ['ground', 'vegetation', 'stone', 'wood', 'water', 'cloth', 'skin', 'light'] as const;
export const RampFor = Type.Union(RAMP_FOR.map((f) => Type.Literal(f)));

const RampId = Type.String({
  pattern: '^[a-z0-9][a-z0-9-]*$',
  maxLength: 32,
  description: 'Names the ramp so a sprite of this kit can cite it, for example "meadow" or "wet-stone".',
});
const RampStep = Type.String({ pattern: '^#[0-9a-f]{6}$', description: 'One step of the ramp, dark to light.' });

export const RampBody = Type.Object(
  {
    id: RampId,
    for: Type.Optional(RampFor),
    steps: Type.Array(RampStep, {
      minItems: 5,
      maxItems: 6,
      description:
        'Five or six steps from dark to light, the hue moving between them: a ramp that only changes value is not a ramp and the check says so.',
    }),
  },
  { additionalProperties: false, description: 'A material or region ramp, declared by the kit that draws with it.' },
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
    ramps: Type.Optional(
      Type.Array(RampBody, {
        maxItems: 4,
        description:
          'The ramps this kit draws with (ART_SYSTEM section 3). A sprite that names none uses the core palette only, so every kit written before this field stays valid.',
      }),
    ),
    sprites: Type.Record(
      Type.String({ pattern: '^[a-z0-9_-]+/[a-z0-9_/-]+$' }),
      Type.Object(
        {
          file: Type.String({ pattern: '^[a-z0-9_/-]+\\.png$', description: 'PNG next to this file.' }),
          w: Int(
            8,
            384,
            'Frame width in pixels. At density 1 (16 art pixels per tile) tiles/ and items/ are 16, chars/ are 16, a work pose 32 and props up to 64. At density 4 (64 art pixels per tile) tiles/ and items/ are 64, chars/ are 64, a work pose 128 and props up to 384.',
          ),
          h: Int(
            8,
            384,
            'Frame height in pixels. At density 1 tiles/ and items/ are 16, chars/ are 24, a work pose 32 and props up to 64. At density 4 tiles/ and items/ are 64, chars/ are 96, a work pose 128 and props up to 384.',
          ),
          frames: Type.Optional(Int(1, 16, 'Animation frames laid side by side. Default 1.')),
          ramps: Type.Optional(
            Type.Array(Type.String({ pattern: '^[a-z0-9][a-z0-9-]*$', maxLength: 32 }), {
              minItems: 1,
              maxItems: 4,
              description:
                'The ramps of this kit the sprite draws in, in order. The outline is the one-pixel ink line #1b1a2e on every sprite, whatever the ramps. A sprite that names none uses the core palette only.',
            }),
          ),
          density: Type.Optional(
            Type.Union([Type.Literal(1), Type.Literal(4)], {
              description:
                'Art pixels per tile side: 1 means 16 per tile (the 16x16 grid, the default), 4 means 64 per tile (the 64x64 grid, the standard for new art). The size rules of w and h follow it.',
            }),
          ),
          scale: Type.Optional(
            Type.Number({
              minimum: 0.1,
              maximum: 40,
              description:
                'The sprite\'s height in characters (NATURE section 1): a person is 1.0, a house 3.5. The check warns when a kind in NATURE section 1 or STYLE 1b falls under its floor. Left out when the sprite has no true size.',
            }),
          ),
          source: Type.Optional(
            Type.Object(
              {
                spec: Type.String({ minLength: 1, description: 'The pnpm kit:gen spec file this sprite was made from, as a path from the repository root.' }),
                manifest: Type.String({ minLength: 1, description: 'The manifest.jsonl line of that run, as <path>:<line number>.' }),
              },
              { additionalProperties: false, description: 'Where a generated sprite came from (ASSET_PATH section 4, item 2). Left out for a hand-drawn one.' },
            ),
          ),
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
    safe: Type.Optional(
      Type.Boolean({
        description:
          'A safe area (G30): no hazard acts inside it at any hour, a chase ends when the player stands in it, and what the player carries in is theirs. The cobbles of the town and the camp once a part stands are safe without this.',
      }),
    ),
  },
  { additionalProperties: false },
);

export const CREATURE_LOOKS = ['bird', 'fish', 'rabbit', 'deer'] as const;
export const CREATURE_PERCHES = ['ground', 'tree', 'water'] as const;

/** One kind of ambient creature: how it looks, where it sits, how close the player may come, when it is out. */
const CreatureKind = Type.Object(
  {
    look: Type.Union(CREATURE_LOOKS.map((k) => Type.Literal(k)), {
      description: 'The drawing and the way it leaves: a bird takes off, a fish darts, a rabbit bolts, a deer walks off.',
    }),
    perch: Type.Union(CREATURE_PERCHES.map((k) => Type.Literal(k)), {
      description: 'What its spots stand on: a non-solid ground tile, a forest tile, or a water tile.',
    }),
    alert_tiles: Int(1, 8, 'It leaves when the player comes within this many tiles.'),
    return_s: Int(5, 600, 'Real seconds before it comes back to its spot once the player is away.'),
    hours: Type.Optional(
      Type.Tuple([Int(0, 23), Int(1, 24)], {
        description: 'The game hours it is out, from (inclusive) to (exclusive). Absent: all day, never at night.',
      }),
    ),
  },
  { additionalProperties: false },
);

/** The closed list of climates a region may declare (NATURE section 2). The tables live in content/core/climates.json. */
export const CLIMATES = ['temperate', 'dry', 'cold', 'wet'] as const;

/** What a region of a map plan is for: a place a player stops in, or ground a player passes through. */
export const REGION_PURPOSES = ['stop', 'passage'] as const;

const PlanTile = Type.Tuple([Int(0, 1023), Int(0, 1023)], { description: 'A tile: x, then y.' });

/**
 * The plan block of a hand-composed map (DECISIONS.md, 2026-10-23: the valley map plan in the game): why
 * each place is where it is, written beside the tiles. The map check reads it; the kernel and the
 * clients do not. Every field is optional, so a map without a plan stays valid.
 */
export const MapPlan = Type.Object(
  {
    regions: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: Id,
            purpose: Type.Union(REGION_PURPOSES.map((p) => Type.Literal(p))),
            cells: Type.Array(Type.Tuple([Int(0, 1023), Int(0, 1023), Int(1, 1024), Int(1, 1024)]), {
              minItems: 1,
              maxItems: 8,
              description: 'The rectangles the region covers: x, y, width, height.',
            }),
            height: Type.Optional(Int(0, 9, 'The level the region stands on, read against `levels`.')),
            tags: Type.Optional(Type.Array(Type.String({ pattern: '^[a-z0-9:_-]+$', maxLength: 40 }), { maxItems: 8, uniqueItems: true })),
            cover: Type.Optional(
              Type.Record(SpriteRef, Int(0, 300), { description: 'The scatter line: per mille of the walkable tiles each small prop covers.' }),
            ),
            opens_by: Type.Optional(
              Type.Union([Type.Literal('wake'), Id], {
                description:
                  '"wake": open from the first wake. Otherwise the quest whose reward opens the way in (decision 25 of 22.10); a quest not yet written is a warning, never an error. Left out: ground nobody walks (water, the woods, a mountain band).',
              }),
            ),
          },
          { additionalProperties: false },
        ),
        { maxItems: 64 },
      ),
    ),
    paths: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: Id,
            width: Int(1, 2, '1 for feet, 2 for a barrow or a cart.'),
            via: Type.Array(PlanTile, {
              minItems: 2,
              maxItems: 32,
              description: 'The corners of the path, each pair on one row or one column; every tile between is a path tile or a mended crossing (G69).',
            }),
          },
          { additionalProperties: false },
        ),
        { maxItems: 64 },
      ),
    ),
    routes: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: Id,
            who: Name,
            hours: Type.Tuple([Int(0, 23), Int(1, 24)], { description: 'From (inclusive) to (exclusive), game hours; a later from than to runs over midnight.' }),
            via: Type.Array(PlanTile, { minItems: 1, maxItems: 48, description: 'Points a person walks through, each a tile a foot can stand on.' }),
          },
          { additionalProperties: false },
        ),
        { maxItems: 32 },
      ),
    ),
    rests: Type.Optional(Type.Array(Tile('The top-left tile of a plain 3x3 the scatter leaves empty.'), { maxItems: 32 })),
    wakes: Type.Optional(
      Type.Array(
        Type.Object(
          {
            pocket: { ...Id, description: 'A wake pocket of the pool (content/core/pockets): its file holds the wake tile and the tools on the ground.' },
            quest: { ...Id, description: 'The first task of that pocket: a quest whose `pocket` names it.' },
          },
          { additionalProperties: false },
        ),
        { maxItems: 16, description: 'The spawn pool: every wake the seed may draw, with its first task.' },
      ),
    ),
    exits: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: Id,
            slot: Type.Optional({ ...Id, description: 'The gate: the slot a region quest opens (decision 25). Give this or `at`.' }),
            at: Type.Optional({ ...PlanTile, description: 'A way out with no gate slot (the jetty where the boat waits): the last tile a foot stands on.' }),
            to: { ...Id, description: 'The plan region the way leads into.' },
            min_road_steps: Int(
              1,
              100000,
              'G71: the fewest steps the road beyond this exit must run before the next region\'s ground, so that no wake reaches that ground before the first dusk with every gate open. The daylight in steps at the fastest wake, less its steps to this exit, plus a margin; the check refuses a smaller number and any stitched map whose road beyond is shorter.',
            ),
          },
          { additionalProperties: false },
        ),
        { maxItems: 16, description: 'The ways out of the first region: the first night is held by the length of the road beyond each one, never by the gate (DECISIONS.md, 2026-10-23).' },
      ),
    ),
  },
  { additionalProperties: false },
);

/** One world prop, wherever it stands: on a map, in a chunk or inside a stamped place. Coordinates are tiles inside the file's own grid. */
const Prop = (max: number) =>
  Type.Object(
    {
      id: Type.Optional(PropId),
      sprite: SpriteRef,
      x: Int(0, max, 'Left tile of the footprint.'),
      y: Int(0, max, 'Top tile of the footprint.'),
      w: Int(1, 8, 'Footprint width in tiles. The sprite is drawn bottom-centered on it.'),
      h: Int(1, 8, 'Footprint height in tiles.'),
      solid: Type.Boolean(),
      cover: Type.Optional(
        Type.Boolean({
          description: 'Hides a player standing on this non-solid prop from a predator\'s eyes, but never from an adjacent predator.',
        }),
      ),
      fire: Type.Optional(Type.Literal(true, { description: 'A fire the player may feed by hand. It needs an id.' })),
      kept: Type.Optional(
        Type.Object(
          {
            by: { ...Id, description: 'The character whose fire it is.' },
            from: Int(12, 23, 'The hour it is lit, when the keeper is home.'),
          },
          {
            additionalProperties: false,
            description:
              "A fire a character keeps (the owner, 23.10: Maru's hearth): it burns from `from` while its keeper is home, through the night, until the keeper leaves on the first leg of the round. A fire prop only. It never keeps a player's vigil (G48): a `tend` step counts the wood the player gave.",
          },
        ),
      ),
      crossing: Type.Optional(
        Type.Literal(true, { description: 'Steps or a ramp: the way across a change of level (G68), on the lower tile, facing the face.' }),
      ),
      lit_by: Type.Optional({
        ...Id,
        description: 'Id of the fire prop while whose fire burns this prop\'s note and sign may be read.',
      }),
      sign: Type.Optional({ ...Id, description: 'Makes the prop a readable sign that names whoever filled this slot, or says it awaits restoration.' }),
      note: Type.Optional({ ...Text, description: 'A line shown when the player looks at this prop, for example an old inscription.' }),
      hazard: Type.Optional(
        Type.Object(
          {
            kind: Type.Union(HAZARD_KINDS.map((k) => Type.Literal(k)), {
              description: 'A predator hunts the player in its reach and bites until the player stands somewhere safe; a pit, a trap or deep water hurts once each time the player steps onto its footprint.',
            }),
            window: Type.Array(Type.Union(HAZARD_WINDOWS.map((k) => Type.Literal(k))), {
              minItems: 1,
              uniqueItems: true,
              description: 'When it acts (G30). Outside its window it is harmless and shows.',
            }),
            reach: Type.Optional(Int(1, 12, 'A predator only: how many tiles from its footprint it notices the player. The params hold the default.')),
            round: Type.Optional(
              Type.Array(Type.Tuple([Int(0, max), Int(0, max)]), {
                minItems: 4,
                maxItems: 64,
                description: 'A predator only: the closed, four-adjacent loop of tiles it walks after dark. The first tile is inside its prop footprint.',
              }),
            ),
            pace_ms: Type.Optional(Int(100, 10_000, 'A predator on a round only: game milliseconds per tile. The params hold the default.')),
            eyes: Type.Optional(Int(1, 12, 'A predator on a round only: how many tiles ahead it sees. The params hold the default.')),
          },
          { additionalProperties: false, description: 'Makes the prop a hazard (G30-G35). It needs an id.' },
        ),
      ),
    },
    { additionalProperties: false },
  );

export const MapBody = Type.Object(
  {
    climate: Type.Optional(
      Type.Union(CLIMATES.map((c) => Type.Literal(c)), {
        description: 'The climate this region declares (NATURE section 2): which ramp set, densities, kinds, air and sound beds the engine reads. Left out, the region is read as temperate.',
      }),
    ),
    creatures: Type.Optional(
      Type.Object(
        {
          kinds: Type.Record(Id, CreatureKind),
          spots: Type.Array(
            Type.Object({ kind: Id, x: Int(0, 1023), y: Int(0, 1023) }, { additionalProperties: false }),
            { maxItems: 200 },
          ),
        },
        {
          additionalProperties: false,
          description: 'Cosmetic ambient life (the client draws it behind ?rich= motion; the kernel never sees it): kinds, and the spots where each sits until the player comes close.',
        },
      ),
    ),
    width: Int(8, 1024),
    height: Int(8, 1024),
    legend: Type.Record(Type.String({ pattern: '^.$' }), Type.Object(
      { sprite: SpriteRef, solid: Type.Boolean(), tag: TileTag },
      { additionalProperties: false },
    )),
    ground: Type.Array(Type.String(), { minItems: 8 }),
    levels: Type.Optional(
      Type.Array(Type.String({ pattern: '^[0-9]+$', description: 'One level digit (0 to 9) per tile, rows like the ground (STYLE section 6).' }), {
        minItems: 8,
        description: 'The height layer beside the ground layer (STYLE section 6): one digit 0 to 9 per tile, integers only. Absent: every tile is level 0.',
      }),
    ),
    plan: Type.Optional(MapPlan),
    props: Type.Array(Prop(1023)),
    spawn: Type.Object({ x: Int(0, 1023), y: Int(0, 1023) }, { additionalProperties: false }),
    world: Type.Optional({
      ...WorldId,
      description: 'The world this map belongs to, for a race\'s grade. Left out: "valley", neutral to every race.',
    }),
    regions: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: { ...WorldId, description: 'The region\'s name, unique on the map. Its weather is drawn per region.' },
            x: Int(0, 1023),
            y: Int(0, 1023),
            w: Int(1, 1024),
            h: Int(1, 1024),
            world: Type.Optional({ ...WorldId, description: "The world the region belongs to. Left out: the map's world." }),
          },
          { additionalProperties: false },
        ),
        {
          maxItems: 32,
          description: 'Named rectangles of the map. A tile in none is the map\'s own region. The first region that holds a tile wins.',
        },
      ),
    ),
    slots: Type.Array(Slot),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------- the open world's chunks (NEXT section 19 a)

/** One stamped place: a hand-made place (the boathouse, later a creator's) written over a chunk's generated ground at its spot (DECISIONS 2026-10-17; NEXT section 19). */
export const Stamp = Type.Object(
  {
    id: { ...Id, description: 'The place\'s id, unique on the chunk, so a quest or a check can name it.' },
    x: Int(0, 63, 'Left tile of the place inside the chunk.'),
    y: Int(0, 63, 'Top tile of the place inside the chunk.'),
    height: Type.Optional(
      Type.Integer({ minimum: 0, maximum: 9, default: 0, description: 'The level the place sits on (STYLE section 6). Absent: 0.' }),
    ),
    grounds: Type.Optional(
      Type.Array(Type.String({ pattern: '^.{1,64}$', description: 'A row of the place\'s own ground, in the shared legend\'s characters; every row the same length.' }), {
        minItems: 1,
        maxItems: 64,
        description: 'The place\'s hand-made ground, written over the chunk\'s ground at (x, y). Absent: the generated ground stays.',
      }),
    ),
    levels: Type.Optional(
      Type.Array(Type.String({ pattern: '^[0-9]{1,64}$', description: 'A row of level digits for the place\'s tiles, the same shape as the grounds (STYLE section 6).' }), {
        minItems: 1,
        maxItems: 64,
        description: 'The place\'s per-tile levels. Absent: every tile of the place sits at the stamp\'s height.',
      }),
    ),
    props: Type.Optional(
      Type.Array(Prop(63), {
        description: 'The place\'s props, in tiles inside the place: x and y counted from the stamp\'s (x, y).',
      }),
    ),
    slots: Type.Optional(
      Type.Array(Slot, {
        description: 'The place\'s slots (a keeper\'s npc, a building, an area inside it), x and y counted from the stamp\'s (x, y).',
      }),
    ),
  },
  { additionalProperties: false },
);

/** One world chunk: the 64 by 64 block the world is generated, stored and streamed in (OPEN_WORLD G50-G52; NEXT section 19 a). */
export const ChunkBody = Type.Object(
  {
    x: Type.Integer({ minimum: 0, maximum: 1023, multipleOf: 64, description: 'The chunk\'s top-left tile x in the world grid. A multiple of 64: chunks align to the grid\'s corner (G51).' }),
    y: Type.Integer({ minimum: 0, maximum: 1023, multipleOf: 64, description: 'The chunk\'s top-left tile y in the world grid. A multiple of 64 (G51).' }),
    grounds: Type.Array(Type.String({ pattern: '^.{64}$', description: 'A row of 64 ground tiles, in the shared legend\'s characters (G52).' }), {
      minItems: 64,
      maxItems: 64,
      description: 'The chunk\'s ground: 64 rows of 64 tiles. The world has one shared legend; a chunk carries none (G52).',
    }),
    levels: Type.Optional(
      Type.Array(Type.String({ pattern: '^[0-9]{64}$', description: 'A row of 64 level digits, one per tile (STYLE section 6).' }), {
        minItems: 64,
        maxItems: 64,
        description: 'The chunk\'s height layer: one digit 0 to 9 per tile, 64 rows like the grounds. Absent: every tile is level 0.',
      }),
    ),
    props: Type.Array(Prop(63), { description: 'The chunk\'s props, in chunk coordinates.' }),
    stamps: Type.Array(Stamp, { description: 'The hand-made places stamped onto the chunk.' }),
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
  classes: Type.Optional(Type.Array(ClassDef, { maxItems: 10, description: 'Classes of your own, each under one base class.' })),
};

function record<T extends string, K extends string, B extends TSchema>(type: T, key: K, body: B) {
  const properties = { ...envelope, type: Type.Literal(type), ...({ [key]: body } as Record<K, B>) };
  return Type.Object(properties, { additionalProperties: false, $id: type });
}

export const ResourceFile = record('resource', 'node', ResourceBody);
/** A treasure file holds one dig spot (`dig`) or one searchable (`search`); the check refuses both or neither. */
export const TreasureFile = Type.Object(
  { ...envelope, type: Type.Literal('treasure'), dig: Type.Optional(TreasureBody), search: Type.Optional(SearchBody) },
  { additionalProperties: false, $id: 'treasure' },
);
export const RecipeFile = record('recipe', 'recipe', RecipeBody);
export const TemplateFile = record('template', 'template', TemplateBody);
export const NpcFile = record('npc', 'npc', NpcBody);
export const QuestFile = record('quest', 'quest', QuestBody);
export const ExpeditionFile = record('expedition', 'expedition', ExpeditionBody);
export const RestoreFile = record('restore', 'restore', RestoreBody);
export const CampFile = record('camp', 'camp', CampBody);
export const RaceFile = record('race', 'race', RaceBody);
export const CreatorFile = record('creator', 'profile', CreatorBody);
export const ReactionFile = record('reaction', 'reaction', ReactionBody);
export const ItemsFile = Type.Object({ ...envelope, type: Type.Literal('items') }, { additionalProperties: false });
// Core-only types: a creator file of these types is refused by the check.
export const ShopFile = record('shop', 'shop', ShopBody);
export const ProfessionFile = record('profession', 'profession', ProfessionBody);
export const ParamsFile = record('params', 'params', ParamsBody);
export const KitFile = record('kit', 'kit', KitBody);
export const MapFile = record('map', 'map', MapBody);
export const ChunkFile = record('chunk', 'chunk', ChunkBody);
export const PocketFile = record('pocket', 'pocket', PocketBody);
export const SchoolFile = record('school', 'school', SchoolBody);

export const CREATOR_TYPES = ['resource', 'treasure', 'recipe', 'template', 'npc', 'quest', 'expedition', 'restore', 'camp', 'race', 'items', 'creator', 'reaction'] as const;
export const CORE_ONLY_TYPES = ['shop', 'profession', 'params', 'kit', 'map', 'pocket', 'school'] as const;

export const ExtensionFile = Type.Union([
  ResourceFile,
  TreasureFile,
  RecipeFile,
  TemplateFile,
  NpcFile,
  QuestFile,
  ExpeditionFile,
  RestoreFile,
  CampFile,
  RaceFile,
  ItemsFile,
  CreatorFile,
  ReactionFile,
  ShopFile,
  ProfessionFile,
  ParamsFile,
  KitFile,
  MapFile,
  PocketFile,
  SchoolFile,
]);

export type ItemDef = Static<typeof ItemDef>;
export type ClassDef = Static<typeof ClassDef>;
export type ClassInput = Static<typeof ClassInput>;
export type BaseClassName = (typeof BASE_CLASSES)[number];
export type Stack = Static<typeof Stack>;
export type Output = Static<typeof Output>;
export type Find = Static<typeof Find>;
export type ResourceFile = Static<typeof ResourceFile>;
export type TreasureFile = Static<typeof TreasureFile>;
export type RecipeFile = Static<typeof RecipeFile>;
export type TemplateFile = Static<typeof TemplateFile>;
export type NpcFile = Static<typeof NpcFile>;
export type QuestFile = Static<typeof QuestFile>;
export type ExpeditionFile = Static<typeof ExpeditionFile>;
export type QuestStep = Static<typeof QuestStep>;
export type QuestType = (typeof QUEST_TYPES)[number];
export type RiddleAnswer = Static<typeof RiddleAnswer>;
export type RestoreFile = Static<typeof RestoreFile>;
export type CampFile = Static<typeof CampFile>;
export type RaceFile = Static<typeof RaceFile>;
export type PocketFile = Static<typeof PocketFile>;
export type ItemsFile = Static<typeof ItemsFile>;
export type CreatorFile = Static<typeof CreatorFile>;
export type CreatorProfile = Static<typeof CreatorBody>;
export type ReactionFile = Static<typeof ReactionFile>;
export type Reaction = Static<typeof ReactionBody>;
export type CueName = (typeof CUES)[number];
export type WeatherName = (typeof WEATHERS)[number];
export type ShopFile = Static<typeof ShopFile>;
export type ProfessionFile = Static<typeof ProfessionFile>;
export type ParamsFile = Static<typeof ParamsFile>;
export type ParamsBody = Static<typeof ParamsBody>;
export type KitFile = Static<typeof KitFile>;
export type MapFile = Static<typeof MapFile>;
export type ExtensionFile = Static<typeof ExtensionFile>;
export type Resource = Static<typeof ResourceBody>;
export type Treasure = Static<typeof TreasureBody>;
export type Search = Static<typeof SearchBody>;
export type SearchRow = Static<typeof SearchRow>;
export type Recipe = Static<typeof RecipeBody>;
export type Template = Static<typeof TemplateBody>;
export type Npc = Static<typeof NpcBody>;
export type WhenDef = Static<typeof When>;
export type RemarkDef = Static<typeof Remark>;
export type Quest = Static<typeof QuestBody>;
export type Expedition = Static<typeof ExpeditionBody>;
export type Restore = Static<typeof RestoreBody>;
export type Camp = Static<typeof CampBody>;
export type Race = Static<typeof RaceBody>;
export type Pocket = Static<typeof PocketBody>;
export type School = Static<typeof SchoolBody>;
export type SchoolNodeDef = Static<typeof SchoolNode>;
export type NodeSizeName = (typeof NODE_SIZES)[number];
export type TreeTint = (typeof TREE_TINTS)[number];
export type SchoolFile = Static<typeof SchoolFile>;
export type Profession = Static<typeof ProfessionBody>;
export type Shop = Static<typeof ShopBody>;
export type Kit = Static<typeof KitBody>;
export type Ramp = Static<typeof RampBody>;
export type RampPurpose = Static<typeof RampFor>;
export type GameMap = Static<typeof MapBody>;
export type ChunkFile = Static<typeof ChunkFile>;
export type Chunk = Static<typeof ChunkBody>;
export type Stamp = Static<typeof Stamp>;
export type EffectName = (typeof EFFECTS)[number];
export type WornEffectName = (typeof WORN_EFFECTS)[number];
export type WornSlotName = (typeof WORN_SLOTS)[number];
export type BodyEffectName = (typeof BODY_EFFECTS)[number];
export type WearDef = Static<typeof Wear>;
export type ToolKind = (typeof TOOL_KINDS)[number];
export type StationKind = (typeof STATIONS)[number];
export type RarityName = (typeof RARITIES)[number];

export const SCHEMAS = {
  extension: ExtensionFile,
  resource: ResourceFile,
  treasure: TreasureFile,
  recipe: RecipeFile,
  template: TemplateFile,
  npc: NpcFile,
  quest: QuestFile,
  expedition: ExpeditionFile,
  restore: RestoreFile,
  camp: CampFile,
  race: RaceFile,
  items: ItemsFile,
  creator: CreatorFile,
  reaction: ReactionFile,
  shop: ShopFile,
  profession: ProfessionFile,
  params: ParamsFile,
  kit: KitFile,
  map: MapFile,
  chunk: ChunkFile,
  pocket: PocketFile,
  school: SchoolFile,
} as const;

export { validateFile, type SchemaIssue } from './validate';
