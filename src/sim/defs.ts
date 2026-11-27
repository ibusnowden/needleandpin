// Game-rule definitions. Display names live in the locale files (src/i18n/locales), keyed by id.
// Each entry notes the GDD section it implements.

// ---------------------------------------------------------------- goods (§4.1)
export type GoodId =
  | "grain" | "wool" | "timber" | "ore"
  | "bread" | "cloth" | "tools" | "housing"
  | "pins"
  | "spices";

export type Tier = "raw" | "staple" | "refined" | "luxury";
/** Ghazali's three levels of need: daruriyyat, hajiyyat, tahsiniyyat. */
export type NeedLevel = "necessity" | "comfort" | "luxury" | null;

export interface GoodDef {
  id: GoodId;
  tier: Tier;
  need: NeedLevel;
  /** b_g: base output per worker per turn (§13). */
  baseOutput: number;
  /** Share of an unsold stock that spoils each turn. */
  spoil: number;
  /** Units of input per unit of output. */
  inputs: Partial<Record<GoodId, number>>;
  /** True for goods that come from land (farms, mines…): a share of value goes to landlords as rent. */
  land: boolean;
  /** World price for trade through ports, as a multiple of the good's base natural price
   *  (absolute for import-only goods). */
  worldPrice: number;
  /** Only obtainable by import (MVP luxury). */
  importOnly?: boolean;
}

export const GOODS: Record<GoodId, GoodDef> = {
  grain:   { id: "grain",   tier: "raw",     need: null,        baseOutput: 13, spoil: 0.30, inputs: {},            land: true,  worldPrice: 0.92 },
  wool:    { id: "wool",    tier: "raw",     need: null,        baseOutput: 8.5, spoil: 0.05, inputs: {},            land: true,  worldPrice: 1.05 },
  timber:  { id: "timber",  tier: "raw",     need: "necessity", baseOutput: 11, spoil: 0.02, inputs: {},            land: true,  worldPrice: 0.97 },
  ore:     { id: "ore",     tier: "raw",     need: null,        baseOutput: 5, spoil: 0.00, inputs: {},            land: true,  worldPrice: 1.05 },
  bread:   { id: "bread",   tier: "staple",  need: "necessity", baseOutput: 20, spoil: 0.60, inputs: { grain: 1 },  land: false, worldPrice: 1.2 },
  cloth:   { id: "cloth",   tier: "staple",  need: "necessity", baseOutput: 5.5, spoil: 0.03, inputs: { wool: 1 },   land: false, worldPrice: 1.12 },
  tools:   { id: "tools",   tier: "staple",  need: "comfort",   baseOutput: 3, spoil: 0.02, inputs: { ore: 1 },    land: false, worldPrice: 1.12 },
  housing: { id: "housing", tier: "staple",  need: "necessity", baseOutput: 4.3, spoil: 0.08, inputs: { timber: 1.5 }, land: false, worldPrice: 99 },
  pins:    { id: "pins",    tier: "refined", need: "comfort",   baseOutput: 10, spoil: 0.01, inputs: { ore: 0.25 }, land: false, worldPrice: 1.25 },
  spices:  { id: "spices",  tier: "luxury",  need: "luxury",    baseOutput: 0,   spoil: 0.02, inputs: {},            land: false, worldPrice: 0.9, importOnly: true },
};
export const GOOD_IDS = Object.keys(GOODS) as GoodId[];

/** Per-person necessities each turn: the subsistence basket (bread, cloth, fuel, rent) of §13. */
export const BASKET: Partial<Record<GoodId, number>> = { bread: 0.9, cloth: 0.12, timber: 0.3, housing: 0.12 };

// ---------------------------------------------------------------- terrain
export type Terrain = "sea" | "plains" | "fertile" | "forest" | "hills" | "mountains";
export const TERRAIN_COST: Record<Terrain, number> = {
  sea: Infinity, plains: 1, fertile: 1, forest: 1.6, hills: 2.2, mountains: 4,
};
export const RIVER_COST = 0.55; // rivers are cheap transport
export const ROAD_COST = 0.32;
export const CANAL_COST = 0.18;
export const RAIL_COST = 0.08;
export const SEA_LANE_COST = 0.12; // per sea hex, between ports

// ---------------------------------------------------------------- buildings (§4.1–4.3)
export type BuildingType =
  | "farm" | "pasture" | "lumber" | "mine"
  | "bakery" | "weaver" | "smithy" | "builder" | "pinworks"
  | "port" | "courthouse" | "school" | "granary";

export interface BuildingDef {
  type: BuildingType;
  good?: GoodId;
  cost: number;
  terrain: Terrain[];
  needsDeposit?: "ore";
  coastal?: boolean;
  /** Fertile-land style bonus multipliers by terrain. */
  terrainBonus?: Partial<Record<Terrain, number>>;
  /** Root craft (Ghazali, §15 B) this building represents, if any. */
  rootCraft?: "farming" | "weaving" | "building" | "governance";
  /** Civic buildings employ no producers. */
  civic?: boolean;
}

const LAND: Terrain[] = ["plains", "fertile", "forest", "hills"];
export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  farm:       { type: "farm",     good: "grain",   cost: 18, terrain: ["plains", "fertile"], terrainBonus: { fertile: 1.4 }, rootCraft: "farming" },
  pasture:    { type: "pasture",  good: "wool",    cost: 16, terrain: ["plains", "hills"],   terrainBonus: { hills: 1.15 } },
  lumber:     { type: "lumber",   good: "timber",  cost: 14, terrain: ["forest"] },
  mine:       { type: "mine",     good: "ore",     cost: 30, terrain: ["hills", "mountains"], needsDeposit: "ore" },
  bakery:     { type: "bakery",   good: "bread",   cost: 20, terrain: LAND },
  weaver:     { type: "weaver",   good: "cloth",   cost: 24, terrain: LAND, rootCraft: "weaving" },
  smithy:     { type: "smithy",   good: "tools",   cost: 30, terrain: LAND },
  builder:    { type: "builder",  good: "housing", cost: 22, terrain: LAND, rootCraft: "building" },
  pinworks:   { type: "pinworks", good: "pins",    cost: 34, terrain: LAND },
  port:       { type: "port",     cost: 60, terrain: ["plains", "fertile", "forest", "hills"], coastal: true },
  courthouse: { type: "courthouse", cost: 40, terrain: LAND, civic: true, rootCraft: "governance" },
  school:     { type: "school",   cost: 35, terrain: LAND, civic: true },
  granary:    { type: "granary",  cost: 30, terrain: LAND, civic: true },
};
export const PRODUCER_TYPES = (Object.values(BUILDINGS) as BuildingDef[]).filter((b) => b.good).map((b) => b.type);

export type Infra = "road" | "canal" | "rail";
export const INFRA_COST: Record<Infra, number> = { road: 4, canal: 14, rail: 26 };

// ---------------------------------------------------------------- simulation constants (§13)
export const SIM = {
  specBase: 1.6,          // m(s) = 1.6^(s-1)
  theta: 0.5,             // capital deepening in Y = L·b·m(s)·(1+θK/L)^α
  alpha: 0.3,
  lambda: 0.3,            // price response to excess demand
  mu: 0.15,               // pull toward natural price
  delta: 0.05,            // depreciation
  eta: 0.25,              // labor mobility
  c0: 4,                  // transport cost decay scale for market reach
  workersPerLevel: 3,     // a level-s workshop needs 3·s hands to split the work
  maxWorkersPerLevel: 3.6,
  laborShare: 0.7,
  rentShare: 0.18,        // of land-based value added
  workforceShare: 0.45,   // of population
  trustHome: 80,
};

// ---------------------------------------------------------------- policies (§4, §7)
export type PolicyId =
  | "cornLaw" | "pinMonopoly" | "breadPriceCap" | "guildRules" | "internalTolls"
  | "navigationActs" | "testActs";

export interface PolicyDef {
  id: PolicyId;
  /** Which advisor favours enacting it (+1), opposes (-1). */
  stance: { scotsman: number; scholar: number };
  codex: string;
}

export const POLICIES: Record<PolicyId, PolicyDef> = {
  cornLaw:        { id: "cornLaw",        stance: { scotsman: -1, scholar: -1 }, codex: "mercantile-system" },
  pinMonopoly:    { id: "pinMonopoly",    stance: { scotsman: -1, scholar: -1 }, codex: "conspiracy-against-public" },
  breadPriceCap:  { id: "breadPriceCap",  stance: { scotsman: -1, scholar: 0 },  codex: "natural-price" },
  guildRules:     { id: "guildRules",     stance: { scotsman: -1, scholar: 0 },  codex: "invisible-hand" },
  internalTolls:  { id: "internalTolls",  stance: { scotsman: -1, scholar: -1 }, codex: "extent-of-market" },
  navigationActs: { id: "navigationActs", stance: { scotsman: -1, scholar: 0 },  codex: "mercantile-system" },
  testActs:       { id: "testActs",       stance: { scotsman: -1, scholar: -1 }, codex: "five-protections" },
};
export const POLICY_IDS = Object.keys(POLICIES) as PolicyId[];
export const MAX_POLICY_CHANGES_PER_TURN = 2;

// ---------------------------------------------------------------- budget & taxes (§4.8)
export type BudgetLine = "defense" | "justice" | "works" | "education" | "relief";
export const BUDGET_LINES: BudgetLine[] = ["defense", "justice", "works", "education", "relief"];

export interface Taxes {
  land: number;              // on rent
  exciseNecessities: number; // on bread, cloth, fuel, housing
  exciseLuxuries: number;    // on comforts and luxuries
  customs: number;           // on imports
  collection: "salaried" | "farmers";
}

// ---------------------------------------------------------------- institutions (§6)
export type Track = "money" | "markets" | "law" | "knowledge";
export type InstitutionId =
  | "coinage" | "lettersOfCredit" | "banks" | "partnershipHouses" | "centralBank" | "depositInsurance"
  | "marketSquares" | "merchantShipping" | "canals" | "railways" | "tradeBlocs"
  | "hisba" | "contractCourts" | "jointStock" | "factoryActs" | "competitionLaw"
  | "elementarySchools" | "printingPress" | "learnedSocieties" | "publicSchooling" | "socialInsurance";

export interface InstitutionDef {
  id: InstitutionId;
  track: Track;
  era: number;
  cost: number;
  requires: InstitutionId[];
  /** Mutually exclusive with (the Commerce-era finance fork, §4.7). */
  excludes?: InstitutionId;
  codex?: string;
}

export const INSTITUTIONS: Record<InstitutionId, InstitutionDef> = {
  coinage:           { id: "coinage",           track: "money",     era: 1, cost: 30,  requires: [], codex: "origin-of-money" },
  lettersOfCredit:   { id: "lettersOfCredit",   track: "money",     era: 2, cost: 45,  requires: ["coinage"] },
  banks:             { id: "banks",             track: "money",     era: 3, cost: 70,  requires: ["lettersOfCredit"], excludes: "partnershipHouses", codex: "two-finance-paths" },
  partnershipHouses: { id: "partnershipHouses", track: "money",     era: 3, cost: 70,  requires: ["lettersOfCredit"], excludes: "banks", codex: "two-finance-paths" },
  centralBank:       { id: "centralBank",       track: "money",     era: 4, cost: 90,  requires: [] },
  depositInsurance:  { id: "depositInsurance",  track: "money",     era: 5, cost: 110, requires: ["centralBank"] },
  marketSquares:     { id: "marketSquares",     track: "markets",   era: 1, cost: 25,  requires: [], codex: "markets-from-need" },
  merchantShipping:  { id: "merchantShipping",  track: "markets",   era: 2, cost: 45,  requires: ["marketSquares"] },
  canals:            { id: "canals",            track: "markets",   era: 3, cost: 60,  requires: ["merchantShipping"], codex: "extent-of-market" },
  railways:          { id: "railways",          track: "markets",   era: 4, cost: 95,  requires: ["canals"] },
  tradeBlocs:        { id: "tradeBlocs",        track: "markets",   era: 5, cost: 110, requires: ["railways"] },
  hisba:             { id: "hisba",             track: "law",       era: 1, cost: 30,  requires: [], codex: "hisba" },
  contractCourts:    { id: "contractCourts",    track: "law",       era: 2, cost: 45,  requires: [], codex: "duties-of-sovereign" },
  jointStock:        { id: "jointStock",        track: "law",       era: 3, cost: 60,  requires: ["contractCourts"] },
  factoryActs:       { id: "factoryActs",       track: "law",       era: 4, cost: 70,  requires: ["contractCourts"], codex: "five-protections" },
  competitionLaw:    { id: "competitionLaw",    track: "law",       era: 5, cost: 100, requires: ["factoryActs"] },
  elementarySchools: { id: "elementarySchools", track: "knowledge", era: 1, cost: 30,  requires: [], codex: "duties-of-sovereign" },
  printingPress:     { id: "printingPress",     track: "knowledge", era: 2, cost: 45,  requires: [] },
  learnedSocieties:  { id: "learnedSocieties",  track: "knowledge", era: 3, cost: 55,  requires: ["printingPress"] },
  publicSchooling:   { id: "publicSchooling",   track: "knowledge", era: 4, cost: 90,  requires: ["elementarySchools"] },
  socialInsurance:   { id: "socialInsurance",   track: "knowledge", era: 5, cost: 110, requires: ["publicSchooling"] },
};
export const INSTITUTION_IDS = Object.keys(INSTITUTIONS) as InstitutionId[];
export const TRACKS: Track[] = ["money", "markets", "law", "knowledge"];

// ---------------------------------------------------------------- classes (§4.6)
export type ClassId = "laborers" | "merchants" | "landlords";
export const CLASS_IDS: ClassId[] = ["laborers", "merchants", "landlords"];
export const CLASS_POP_SHARE: Record<ClassId, number> = { laborers: 0.85, merchants: 0.1, landlords: 0.05 };

// ---------------------------------------------------------------- advisors (§7)
export type AdvisorId = "scotsman" | "scholar";
export const ADVISOR_IDS: AdvisorId[] = ["scotsman", "scholar"];

// ---------------------------------------------------------------- real-time logistics
export const DAYS_PER_YEAR = 360;
/** Carts that may enter a hex per day, by what is laid on it (a road jams; a railway rarely). */
export const HEX_CAPACITY = { land: 3, river: 8, road: 14, canal: 24, rail: 48, free: 1e9 };
/** Cost of carrying one unit for one day, in reference-wage units (paid to carriers). */
export const CARRY_COST = 0.012;
/** Share of the market price a producer receives when the storehouse buys (the rest is the merchant's margin). */
export const STOREHOUSE_BUY = 0.92;
/** Raw-material workers wear out tools: units of tools per worker-year. Without tools they work at 60%. */
export const TOOL_WEAR = 0.25;

/** Gain in output per worker for each specialisation level, by craft (§4.2 m(s) = base^(s-1)).
 *  Smith, Book I ch. 1: "The nature of agriculture does not admit of so many subdivisions of
 *  labour, nor of so complete a separation of one business from another, as manufactures."
 *  So the full pin-factory gain applies to manufactures; farming and extraction gain least. */
export const SPEC_BASE: Record<GoodId, number> = {
  grain: 1.12, wool: 1.12, timber: 1.15, ore: 1.2,
  bread: 1.22, housing: 1.25,
  cloth: 1.5, tools: 1.55, pins: 1.6,
  spices: 1,
};
