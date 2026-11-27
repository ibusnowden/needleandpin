import type { BudgetLine, InstitutionId, PolicyId, Taxes, Terrain } from "./defs.ts";
import { hexesInRadius, distance, key, neighbors } from "./hex.ts";
import { hashString, makeRng } from "./rng.ts";
import type { ScenarioId, Tile } from "./types.ts";

export interface Chapter {
  /** First year of the chapter. */
  start: number;
  /** Last year (inclusive) — a Reckoning follows the turn that reaches it. */
  end: number;
  step: number;
  era: number;
}

export interface ScenarioDef {
  id: ScenarioId;
  radius: number;
  chapters: Chapter[];
  targets: { opulence: number; maslaha: number };
  ghost?: string;
  /** Opulence normalisation ranges in scenario units (log scale). */
  norms: { realWage: [number, number]; gdppc: [number, number]; capital: [number, number]; trade: [number, number] };
  /** Historical starting values (from the ghost bundle) that the calibration matches. */
  start: { gdppc: number; realWage: number; popDisplay: number };
  r0: number;
  /** Multiplier on building and infrastructure costs (bigger economies, bigger projects). */
  costScale: number;
  /** Starting treasury in years of revenue. */
  foreign: { pop: number; seaCost: number };
  treasury: number;
  /** Starting national debt in years of revenue (Britain 1775: about £127m against about £11m of revenue). */
  debtYears: number;
  interestRate: number;
  trust: number;
  literacy: number;
  institutions: InstitutionId[];
  policies: PolicyId[];
  taxes: Taxes;
  budget: Record<BudgetLine, number>;
  coinage: boolean;
  tutorial?: boolean;
  burnIn: number;
}

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  needle: {
    id: "needle",
    radius: 6,
    chapters: [
      { start: 1, end: 10, step: 1, era: 1 },
      { start: 11, end: 20, step: 1, era: 2 },
    ],
    targets: { opulence: 40, maslaha: 45 },
    norms: { realWage: [0.8, 2.4], gdppc: [0.8, 2.6], capital: [0.5, 4], trade: [0.5, 6] },
    start: { gdppc: 1, realWage: 1, popDisplay: 1000 },
    r0: 30,
    costScale: 1,
    foreign: { pop: 160, seaCost: 3 },
    treasury: 2.5,
    debtYears: 0,
    interestRate: 0.05,
    trust: 70,
    literacy: 0.08,
    institutions: [],
    policies: [],
    taxes: { land: 0.1, exciseNecessities: 0.04, exciseLuxuries: 0.08, customs: 0.05, collection: "salaried" },
    budget: { defense: 0.15, justice: 0.15, works: 0.2, education: 0.1, relief: 0.05 },
    coinage: false,
    tutorial: true,
    burnIn: 2,
  },
  britain1776: {
    id: "britain1776",
    radius: 11,
    chapters: [
      { start: 1776, end: 1789, step: 1, era: 3 },
      { start: 1790, end: 1799, step: 1, era: 3 },
      { start: 1800, end: 1824, step: 2, era: 4 },
      { start: 1826, end: 1850, step: 2, era: 4 },
    ],
    targets: { opulence: 79, maslaha: 86 },
    ghost: "britain1776",
    // Log-scale ranges: 0 at the low end, 100 at the high end (scenario units, §10 honesty rules).
    norms: { realWage: [0.8, 2.6], gdppc: [2000, 7000], capital: [0.5, 4], trade: [0.5, 6] },
    // Maddison 2023 GBR 1776 and Allen London labourers' welfare ratio 1776 (see src/data/ghost).
    start: { gdppc: 2962, realWage: 1.298, popDisplay: 12000 },
    r0: 70,
    costScale: 1.5,
    foreign: { pop: 900, seaCost: 2.5 },
    treasury: 0.8,
    debtYears: 11.5,
    interestRate: 0.035,
    trust: 75,
    literacy: 0.45,
    // What Britain already had in 1776; the Royal Society (1660) stands in for learned societies.
    institutions: ["coinage", "marketSquares", "lettersOfCredit", "merchantShipping", "contractCourts", "printingPress", "elementarySchools", "learnedSocieties"],
    policies: ["cornLaw", "navigationActs", "guildRules", "internalTolls", "testActs"],
    taxes: { land: 0.2, exciseNecessities: 0.1, exciseLuxuries: 0.15, customs: 0.25, collection: "salaried" },
    budget: { defense: 0.35, justice: 0.08, works: 0.06, education: 0.02, relief: 0.04 },
    coinage: true,
    burnIn: 24,
  },
};

// ---------------------------------------------------------------- map generation

function valueNoise(seed: number, x: number, y: number, scale: number): number {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const sx = fx - x0, sy = fy - y0;
  const h = (i: number, j: number) => (hashString(`${seed}:${i}:${j}`) % 10000) / 10000;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
  return a + (b - a) * s(sx) + (c - a) * s(sy) + (a - b - c + d) * s(sx) * s(sy);
}

function fbm(seed: number, x: number, y: number): number {
  return 0.55 * valueNoise(seed, x, y, 4) + 0.3 * valueNoise(seed + 1, x, y, 2) + 0.15 * valueNoise(seed + 2, x, y, 1);
}

export interface TownSeed { name: string; x: number; y: number; pop: number }

/** Approximate relative placements on a stylised island (x: -1 west … 1 east, y: -1 north … 1 south). */
const BRITAIN_TOWNS: TownSeed[] = [
  { name: "London", x: 0.45, y: 0.72, pop: 150 },
  { name: "Bristol", x: -0.25, y: 0.68, pop: 48 },
  { name: "Birmingham", x: 0.05, y: 0.42, pop: 44 },
  { name: "Manchester", x: 0.0, y: 0.12, pop: 42 },
  { name: "Liverpool", x: -0.28, y: 0.12, pop: 40 },
  { name: "Leeds", x: 0.2, y: 0.02, pop: 34 },
  { name: "Norwich", x: 0.62, y: 0.38, pop: 34 },
  { name: "Newcastle", x: 0.28, y: -0.3, pop: 30 },
  { name: "Edinburgh", x: 0.12, y: -0.6, pop: 42 },
  { name: "Glasgow", x: -0.18, y: -0.62, pop: 40 },
];

const NEEDLE_TOWNS: TownSeed[] = [
  { name: "needle.town", x: 0, y: 0, pop: 40 },
  { name: "needle.village1", x: 0.85, y: -0.25, pop: 32 },
  { name: "needle.village2", x: -0.55, y: 0.75, pop: 26 },
];

export function generateTiles(id: ScenarioId, seed: number): Tile[] {
  const def = SCENARIOS[id];
  const R = def.radius;
  const hexes = hexesInRadius(R);
  const tiles: Tile[] = [];
  const rng = makeRng(hashString(`terrain:${seed}`));
  for (const h of hexes) {
    const px = h.q + h.r / 2, py = h.r * 0.866;
    const nx = px / R, ny = py / (R * 0.866);
    const n = fbm(seed, px, py);
    let elevation: number;
    if (id === "britain1776") {
      // Elongated north–south island; north is higher (stylised uplands).
      const ex = nx / 0.78, ey = ny / 1.02;
      const falloff = Math.sqrt(ex * ex + ey * ey);
      elevation = n * 0.9 + 0.55 - falloff * 0.95 + Math.max(0, -ny) * 0.32;
    } else {
      // Tutorial: inland valley with a coast to the south-east corner.
      const coast = (nx + ny) * 0.5;
      elevation = n * 0.6 + 0.35 - Math.max(0, coast - 0.55) * 1.6;
    }
    let terrain: Terrain;
    if (elevation < 0.18) terrain = "sea";
    else if (elevation > 0.86) terrain = "mountains";
    else if (elevation > 0.68) terrain = "hills";
    else {
      const m = valueNoise(seed + 7, px, py, 2.5);
      terrain = m > 0.66 ? "forest" : m < 0.38 ? "fertile" : "plains";
    }
    tiles.push({ q: h.q, r: h.r, terrain, elevation, river: false, coast: false });
  }
  const byKey = new Map(tiles.map((t) => [key(t), t]));
  // Rivers: from a few high points, follow steepest descent to the sea.
  const sources = tiles.filter((t) => t.terrain === "hills").sort((a, b) => b.elevation - a.elevation);
  const nRivers = id === "britain1776" ? 6 : 1;
  for (let i = 0; i < Math.min(nRivers, sources.length); i++) {
    let cur: Tile | undefined = sources[Math.floor((i * sources.length) / nRivers)];
    for (let steps = 0; cur && steps < 40; steps++) {
      if (cur.terrain === "sea") break;
      cur.river = true;
      const next: Tile | undefined = neighbors(cur)
        .map((h) => byKey.get(key(h)))
        .filter((t): t is Tile => !!t && !t.river)
        .sort((a, b) => a.elevation - b.elevation)[0];
      const downhill: Tile | undefined = next && next.elevation <= cur.elevation + 0.02 ? next : undefined;
      // Reaching the sea or another river ends the channel there.
      const sea = neighbors(cur).map((h) => byKey.get(key(h))).find((t) => t?.terrain === "sea");
      if (!downhill && sea) cur.riverNext = key(sea);
      if (downhill) cur.riverNext = key(downhill);
      cur = downhill;
    }
  }
  for (const t of tiles) {
    if (t.terrain === "sea") continue;
    t.coast = neighbors(t).some((h) => {
      const n = byKey.get(key(h));
      return !n || n.terrain === "sea";
    }) && neighbors(t).some((h) => byKey.get(key(h))?.terrain === "sea");
    if ((t.terrain === "hills" || t.terrain === "mountains") && rng.chance(0.4)) t.deposit = "ore";
  }
  // Guarantee at least two ore deposits so the pin chain is possible.
  const hills = tiles.filter((t) => t.terrain === "hills" || t.terrain === "mountains");
  if (hills.filter((t) => t.deposit).length < 2) hills.slice(0, 2).forEach((t) => (t.deposit = "ore"));
  return tiles;
}

export function townSeeds(id: ScenarioId): TownSeed[] {
  return id === "britain1776" ? BRITAIN_TOWNS : NEEDLE_TOWNS;
}

/** Snap a relative position to the nearest unoccupied land tile. */
export function placeOnLand(tiles: Tile[], R: number, x: number, y: number, taken: Set<string>, coastal = false): Tile {
  const tx = x * R, ty = y * R * 0.866;
  let best: Tile | undefined;
  let bestD = Infinity;
  for (const t of tiles) {
    if (t.terrain === "sea" || t.terrain === "mountains" || taken.has(key(t))) continue;
    if (coastal && !t.coast) continue;
    const px = t.q + t.r / 2, py = t.r * 0.866;
    const d = (px - tx) ** 2 + (py - ty) ** 2;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best ?? tiles.find((t) => t.terrain !== "sea")!;
}

export const COASTAL_TOWNS = new Set(["London", "Bristol", "Liverpool", "Glasgow", "Newcastle", "Edinburgh", "Norwich"]);

export { distance };
