import type {
  AdvisorId, BudgetLine, BuildingType, ClassId, GoodId, Infra, InstitutionId, PolicyId, Taxes, Terrain,
} from "./defs.ts";

export type ScenarioId = "needle" | "britain1776";

export interface Tile {
  q: number;
  r: number;
  terrain: Terrain;
  elevation: number;
  river: boolean;
  /** Key of the downstream hex a river flows into (for drawing it as one channel). */
  riverNext?: string;
  deposit?: "ore";
  /** Adjacent to sea. */
  coast: boolean;
}

export interface Town {
  id: string;
  name: string;
  q: number;
  r: number;
  pop: number;
  /** Laborer mood in this town (0–100), shown by the class-mood overlay. */
  mood: number;
  founded: number;
}

export interface Building {
  id: string;
  type: BuildingType;
  q: number;
  r: number;
  workers: number;
  /** Specialization level 1–5 (§4.2). */
  level: number;
  /** Cap from market reach (§4.3). */
  maxLevel: number;
  reach: number;
  capital: number;
  wage: number;
  output: number;
  /** Fraction of desired inputs obtained last turn (1 = no bottleneck). */
  inputFill: number;
  /** Fraction of output that found buyers. */
  sold: number;
  profit: number;
  built: number;
  private?: boolean;
  /** Natural-language breakdown of the last output figure (§11 "everything explains itself"). */
  explain?: OutputExplain;
  // ---- physical logistics (real-time mode)
  /** Input store, by good (units). */
  inBuf: Partial<Record<GoodId, number>>;
  /** Units on the way to this workshop, by good. */
  incoming: Partial<Record<GoodId, number>>;
  /** Finished goods waiting for a cart (units). */
  outBuf: number;
  /** What the workshop is doing right now. */
  status: BuildingStatus;
  /** Which input is missing when starved. */
  missing?: GoodId;
  /** Production cycle progress 0–1 (drives the animation). */
  cycle: number;
  /** Month-to-date accounts. */
  mRev: number;
  mCost: number;
}

export type BuildingStatus = "working" | "starved" | "blocked" | "idle" | "civic";

/** A town's market and storehouses (Ghazali: "and so markets and storehouses appeared"). */
export interface Market {
  town: string;
  stock: Record<GoodId, number>;
  price: Record<GoodId, number>;
  /** Household and investor demand, units per day (set monthly from incomes). */
  want: Record<GoodId, number>;
  /** Smoothed units per day taken from this market by every buyer (for pricing). */
  draw: Record<GoodId, number>;
  /** Smoothed unmet demand, units per day. */
  short: Record<GoodId, number>;
}

/** One cart, barge, train or ship carrying goods across the map. */
export interface Cart {
  id: number;
  good: GoodId;
  qty: number;
  kind: "goods" | "supply" | "merchant" | "import" | "export";
  /** Tile indices from origin to destination. */
  path: number[];
  /** Index of the tile the cart is on. */
  seg: number;
  /** Days spent toward entering the next tile. */
  acc: number;
  /** Destination: "m:<townId>", "b:<buildingId>" or "abroad". */
  dest: string;
  /** Building that shipped it (goods/export) — paid on delivery. */
  from?: string;
  /** Price already paid (merchant/supply/import carts). */
  paid: number;
  waited: number;
}

export interface YearAcc {
  produced: Record<GoodId, number>;
  inputsUsed: Record<GoodId, number>;
  hhBought: Record<GoodId, number>;
  hhSpend: Record<GoodId, number>;
  imported: Record<GoodId, number>;
  exported: Record<GoodId, number>;
  importValue: number;
  exportValue: number;
  customs: number;
  wages: number;
  rents: number;
  profits: number;
  carriers: number;
  merchantMargin: number;
  necNeed: number;
  necGot: number;
  foodNeed: number;
  foodGot: number;
  housingNeed: number;
  housingGot: number;
  invested: number;
  capacity: Record<GoodId, number>;
  exciseNec: number;
  exciseLux: number;
  landTax: number;
}

export interface OutputExplain {
  workers: number;
  base: number;
  specMult: number;
  capitalMult: number;
  terrainMult: number;
  inputFill: number;
  other: number;
}

export interface GoodState {
  price: number;
  natural: number;
  stock: number;
  produced: number;
  supply: number;
  demand: number;
  sold: number;
  imported: number;
  exported: number;
  /** Shortfall under a price cap. */
  shortage: number;
  /** Base-period natural price, for real GDP. */
  basePrice: number;
  /** Capacity utilisation producers have settled on (moves smoothly with price and stock signals). */
  util: number;
}

export interface ClassState {
  satisfaction: number;
  influence: number;
  income: number;
}

export interface MoneyState {
  trust: number;
  priceLevel: number;
  pendingInflation: number;
  /** Share of coin withdrawn from circulation (§4.5). */
  hoarding: number;
  debasements: number;
  /** Turns on which the coin was debased (trust remembers for 20 turns). */
  debaseTurns: number[];
}

export interface Society {
  literacy: number;
  fraud: number;
  banditry: number;
  granary: number;
  famineDeaths: number;
  unemployment: number;
  emigration: number;
  freedomOfWorship: number;
  institutionTrust: number;
  necessitySecured: number;
  housingSecured: number;
  smuggling: number;
  /** Credit cycle for interest banking: >0 boom, sharp negative = bust. */
  credit: number;
  /** Invention of machines (steam etc.) multiplier. */
  technology: number;
}

export interface MeterBreakdown {
  value: number;
  parts: { id: string; score: number; weight: number; raw: number }[];
}

export interface Meters {
  opulence: MeterBreakdown;
  maslaha: MeterBreakdown;
  goodSociety: boolean;
}

export interface Advisor {
  trust: number;
  resigned: boolean;
  ignored: number;
}

export interface PendingEvent {
  id: string;
  turn: number;
  /** Values substituted into the card text. */
  vars?: Record<string, number | string>;
}

export interface DelayedEffect {
  turn: number;
  effects: Effect[];
  source: string;
}

export type Effect =
  | { op: "treasury"; v: number; scale?: "revenue" }
  | { op: "trust"; v: number }
  | { op: "inflation"; v: number }
  | { op: "stock"; good: GoodId; v: number; mult?: boolean }
  | { op: "price"; good: GoodId; mult: number }
  | { op: "class"; cls: ClassId; v: number }
  | { op: "influence"; cls: ClassId; v: number }
  | { op: "policy"; id: PolicyId; on: boolean }
  | { op: "pop"; mult: number }
  | { op: "literacy"; v: number }
  | { op: "capital"; mult: number }
  | { op: "fraud"; v: number }
  | { op: "bandits"; v: number }
  | { op: "granary"; v: number }
  | { op: "institutionTrust"; v: number }
  | { op: "worship"; v: number }
  | { op: "technology"; v: number }
  | { op: "credit"; v: number }
  | { op: "debt"; v: number; scale?: "revenue" }
  | { op: "advisor"; who: AdvisorId; v: number }
  | { op: "flag"; name: string; v?: number }
  | { op: "progress"; v: number }
  | { op: "customs"; v: number }
  | { op: "releaseGranary" }
  | { op: "foreign"; mult: number }
  | { op: "delay"; turns: number; effects: Effect[] }
  | { op: "chronicle"; key: string };

export interface TurnRecord {
  turn: number;
  year: number;
  gdppc: number;
  realWage: number;
  opulence: number;
  maslaha: number;
  treasury: number;
  trust: number;
  pop: number;
  breadPrice: number;
}

export interface ChronicleEntry {
  turn: number;
  year: number;
  key: string;
  vars?: Record<string, number | string>;
}

export type Command =
  | { type: "build"; building: BuildingType; q: number; r: number }
  | { type: "infra"; infra: Infra; q: number; r: number }
  | { type: "demolish"; q: number; r: number }
  | { type: "foundTown"; q: number; r: number; name: string }
  | { type: "policy"; id: PolicyId; on: boolean }
  | { type: "debase" }
  | { type: "budget"; line: BudgetLine; value: number }
  | { type: "tax"; taxes: Partial<Taxes> }
  | { type: "institution"; id: InstitutionId | null }
  | { type: "eventChoice"; eventId: string; choice: number }
  | { type: "reform"; id: string }
  | { type: "borrow"; amount: number }
  | { type: "repay"; amount: number };

export interface TimedCommand { day: number; cmd: Command }

export interface TurnLog {
  turn: number;
  commands: TimedCommand[];
}

export type EndingId = "golden" | "gilded" | "pious" | "decline" | "collapse";

export interface Reckoning {
  chapter: number;
  turn: number;
  year: number;
  /** Reform options for the next chapter. */
  reforms: string[];
  chosen?: string;
}

export interface GameState {
  version: 1;
  scenario: ScenarioId;
  seed: number;
  turn: number;
  year: number;
  chapter: number;
  status: "playing" | "reckoning" | "ended";
  radius: number;
  tiles: Tile[];
  towns: Town[];
  buildings: Building[];
  infra: Record<string, Infra>;
  goods: Record<GoodId, GoodState>;
  labor: { workforce: number; idle: number; avgWage: number; subsistence: number; moved: number; refWage: number };
  classes: Record<ClassId, ClassState>;
  treasury: number;
  debt: number;
  interestRate: number;
  revenue: number;
  spending: number;
  revenueBreakdown: Record<string, number>;
  budget: Record<BudgetLine, number>;
  taxes: Taxes;
  taxChanges: number[];
  policies: Record<PolicyId, boolean>;
  policyChangesThisTurn: number;
  institutions: Partial<Record<InstitutionId, boolean>>;
  developing: InstitutionId | null;
  progress: number;
  money: MoneyState;
  society: Society;
  meters: Meters;
  advisors: Record<AdvisorId, Advisor>;
  pendingEvent: PendingEvent | null;
  eventHistory: { turn: number; id: string; choice: number }[];
  cooldowns: Record<string, number>;
  flags: Record<string, number>;
  delayed: DelayedEffect[];
  discovered: string[];
  newDiscoveries: string[];
  history: TurnRecord[];
  chronicle: ChronicleEntry[];
  log: TurnLog[];
  pending: TimedCommand[];
  reckonings: Reckoning[];
  reforms: string[];
  calibration: { gdpScale: number; wageScale: number; popScale: number; capital0: number; trade0: number };
  ending?: EndingId;
  collapseReason?: string;
  medal?: boolean;
  nextId: number;
  /** Last end-of-turn report, for UI summaries. */
  report: TurnReport;
  // ---- real-time logistics
  /** Day of the year, 0–359. */
  day: number;
  markets: Market[];
  carts: Cart[];
  /** Bumped whenever buildings or infrastructure change (invalidates cached paths). */
  netVersion: number;
  /** Carts that entered each tile today (index = tile index). */
  entries: number[];
  /** Smoothed carts per day through each tile (for the congestion overlay). */
  flow: number[];
  /** Smoothed carts per day turned back by a full tile. */
  jam: number[];
  acc: YearAcc;
  /** Month-to-date class incomes. */
  mInc: { laborers: number; merchants: number; landlords: number };
  nextCart: number;
  tutorial?: { step: number; marketFormed: boolean };
}

export interface TurnReport {
  levelUps: { id: string; from: number; to: number }[];
  priceSpikes: GoodId[];
  privateBuilds: string[];
  riots: boolean;
  notes: string[];
}
