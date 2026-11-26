// Scoring (GDD §8). Each meter is 0–100, rebuilt every turn from simulation values, with a
// breakdown the player can open to see exactly why it moved.
import { SIM } from "./defs.ts";
import { key } from "./hex.ts";
import { SCENARIOS } from "./scenarios.ts";
import { costsFrom, moneyReachFactor, type Graph } from "./transport.ts";
import { justiceCoverage } from "./society.ts";
import type { GameState, MeterBreakdown } from "./types.ts";

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const logScore = (x: number, lo: number, hi: number) =>
  x <= 0 ? 0 : 100 * clamp((Math.log(x) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)));

export interface MeterInputs {
  realWage: number;      // scenario units (welfare ratio)
  gdppc: number;         // scenario units
  capitalPerWorker: number;
  tradePerPerson: number;
}

/** Share of the population living inside well-connected markets (§8 Opulence, 15%). */
export function marketAccess(s: GameState, g: Graph): number {
  const total = s.towns.reduce((a, t) => a + t.pop, 0);
  if (total <= 0) return 0;
  const f = moneyReachFactor(s);
  let score = 0;
  for (const t of s.towns) {
    const d = costsFrom(g, g.index.get(key(t))!);
    let acc = 0;
    for (const u of s.towns) {
      const c = d[g.index.get(key(u))!];
      if (Number.isFinite(c)) acc += u.pop * Math.exp(-c / SIM.c0);
    }
    const ports = s.buildings.some((b) => b.type === "port" && Number.isFinite(d[g.index.get(key(b))!]));
    const share = (acc / total) * f + (ports ? 0.15 : 0);
    score += t.pop * clamp(share / 0.55);
  }
  return score / total;
}

export function computeMeters(s: GameState, inp: MeterInputs, access: number): { opulence: MeterBreakdown; maslaha: MeterBreakdown } {
  const def = SCENARIOS[s.scenario];
  const cal = s.calibration;
  const cap0 = cal.capital0 || inp.capitalPerWorker || 1;
  const trade0 = cal.trade0 || inp.tradePerPerson || 0.01;
  const op = [
    { id: "realWage", weight: 0.35, raw: inp.realWage, score: logScore(inp.realWage, ...def.norms.realWage) },
    { id: "gdppc", weight: 0.25, raw: inp.gdppc, score: logScore(inp.gdppc, ...def.norms.gdppc) },
    { id: "capital", weight: 0.15, raw: inp.capitalPerWorker, score: logScore(inp.capitalPerWorker / cap0, ...def.norms.capital) },
    { id: "reach", weight: 0.15, raw: access, score: 100 * access },
    { id: "trade", weight: 0.1, raw: inp.tradePerPerson, score: logScore(Math.max(1e-6, inp.tradePerPerson) / trade0, ...def.norms.trade) },
  ];
  const so = s.society;
  // Life: necessities actually secured, and how comfortably the poorest laborer can afford a
  // decent basket (welfare ratio 0.6 = bare subsistence … 2.2 = secure).
  const secure = clamp((inp.realWage - 0.6) / 1.6);
  const nafs = clamp(so.necessitySecured ** 2 * (0.25 + 0.75 * secure) - so.famineDeaths * 4) * 100;
  const aql = clamp(so.literacy) * 100;
  const relief = Math.min(1, (s.budget.relief * s.revenue) / Math.max(1e-6, 0.01 * (s.classes.laborers.income + s.classes.merchants.income + s.classes.landlords.income)));
  const nasl = 100 * clamp(
    0.3 * secure +
    0.25 * clamp(1 - so.unemployment * 2.5) +
    0.2 * clamp(so.housingSecured) +
    0.25 * (0.5 * relief + (s.institutions.factoryActs ? 0.5 : 0.1)),
  );
  // Property: sound money, honest markets, fair courts. A debased coin wrongs every holder
  // (Ghazali, Book 32), so each debasement in the last 20 turns counts against it directly.
  const recentDebase = s.money.debaseTurns.filter((t) => s.turn - t < 20).length;
  const mal = 100 * clamp(0.4 * (s.money.trust / 100) + 0.3 * (1 - so.fraud) + 0.3 * justiceCoverage(s) - 0.12 * recentDebase);
  const din = 100 * clamp(0.4 * (so.institutionTrust / 100) + 0.3 * (1 - so.fraud) + 0.3 * so.freedomOfWorship);
  const ma = [
    { id: "nafs", weight: 0.2, raw: so.necessitySecured, score: nafs },
    { id: "aql", weight: 0.2, raw: so.literacy, score: aql },
    { id: "nasl", weight: 0.2, raw: so.housingSecured, score: nasl },
    { id: "mal", weight: 0.2, raw: s.money.trust, score: mal },
    { id: "din", weight: 0.2, raw: so.institutionTrust, score: din },
  ];
  const sum = (parts: typeof op) => parts.reduce((a, p) => a + p.score * p.weight, 0);
  // The impartial spectator (§15 G): honest, trusted markets give Opulence a small lift.
  const spectator = so.fraud < 0.15 && s.money.trust > 70 ? 2 : 0;
  return {
    opulence: { value: clamp(sum(op) + spectator, 0, 100), parts: op },
    maslaha: { value: clamp(sum(ma), 0, 100), parts: ma },
  };
}
