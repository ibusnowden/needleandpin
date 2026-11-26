// Event system (GDD §7). Cards are content (src/content/events.json): writers and translators
// edit them without touching code. This module evaluates conditions and applies effects.
import eventsJson from "../content/events.json" with { type: "json" };
import { type AdvisorId, type ClassId, type GoodId, type InstitutionId, type PolicyId } from "./defs.ts";
import { streamRng } from "./rng.ts";
import { SCENARIOS } from "./scenarios.ts";
import { nominalGdp } from "./society.ts";
import type { Effect, GameState } from "./types.ts";

export type Text = { en: string; ar: string };

export interface Condition {
  stat: string;
  gt?: number;
  lt?: number;
}

export interface EventChoice {
  label: Text;
  effects: Effect[];
  requires?: { institution?: InstitutionId; treasuryRevenue?: number; policy?: PolicyId; notPolicy?: PolicyId };
  advisors?: Partial<Record<AdvisorId, number>>;
  chronicle?: Text;
  /** One-line consequence hint shown under the button. */
  hint?: Text;
}

export interface EventDef {
  id: string;
  category: "harvest" | "money" | "lobbying" | "invention" | "trade" | "society" | "history";
  icon: string;
  weight: number;
  cooldown?: number;
  once?: boolean;
  when?: {
    minTurn?: number;
    maxTurn?: number;
    minYear?: number;
    maxYear?: number;
    scenario?: string[];
    era?: number[];
    all?: Condition[];
    any?: Condition[];
    policy?: Partial<Record<PolicyId, boolean>>;
    institution?: Partial<Record<InstitutionId, boolean>>;
    flag?: Record<string, boolean>;
  };
  codex?: string;
  title: Text;
  body: Text;
  /** Historical events: a note on what really happened (§7 "History" category). */
  history?: Text;
  onFire?: Effect[];
  advice?: Partial<Record<AdvisorId, Text>>;
  choices: EventChoice[];
}

export const EVENTS: EventDef[] = eventsJson as unknown as EventDef[];
export const EVENT_BY_ID = new Map(EVENTS.map((e) => [e.id, e]));

export function currentEra(s: GameState): number {
  return SCENARIOS[s.scenario].chapters[Math.min(s.chapter, SCENARIOS[s.scenario].chapters.length - 1)].era;
}

/** Named quantities that event conditions can test. */
export function stat(s: GameState, name: string): number {
  const g = s.goods;
  switch (name) {
    case "grainPriceRatio": return g.grain.price / g.grain.natural;
    case "breadPriceRatio": return g.bread.price / g.bread.natural;
    case "clothPriceRatio": return g.cloth.price / g.cloth.natural;
    case "pinPriceRatio": return g.pins.price / g.pins.natural;
    case "toolPriceRatio": return g.tools.price / g.tools.natural;
    case "trust": return s.money.trust;
    case "treasuryRevenue": return s.treasury / Math.max(1e-6, s.revenue);
    case "debtRatio": return s.debt / Math.max(1, nominalGdp(s));
    case "literacy": return s.society.literacy;
    case "fraud": return s.society.fraud;
    case "banditry": return s.society.banditry;
    case "laborers": return s.classes.laborers.satisfaction;
    case "merchants": return s.classes.merchants.satisfaction;
    case "landlords": return s.classes.landlords.satisfaction;
    case "unemployment": return s.society.unemployment;
    case "ports": return s.buildings.filter((b) => b.type === "port").length;
    case "maxLevel": return Math.max(0, ...s.buildings.map((b) => b.level));
    case "pinworks": return s.buildings.filter((b) => b.type === "pinworks").length;
    case "producers": return s.buildings.filter((b) => b.type !== "port" && b.type !== "courthouse" && b.type !== "school" && b.type !== "granary").length;
    case "opulence": return s.meters.opulence.value;
    case "maslaha": return s.meters.maslaha.value;
    case "gap": return s.meters.opulence.value - s.meters.maslaha.value;
    case "releaseGranary": {
      // Only grain actually stored in good years can be released (and bakers turn it into bread).
      s.goods.grain.stock += s.society.granary;
      s.society.granary = 0;
      break;
    }
    case "customs": return s.taxes.customs;
    case "exciseNecessities": return s.taxes.exciseNecessities;
    case "hoarding": return s.money.hoarding;
    case "credit": return s.society.credit;
    case "smuggling": return s.society.smuggling;
    case "necessity": return s.society.necessitySecured;
    case "granary": return s.society.granary;
    case "year": return s.year;
    case "turn": return s.turn;
    case "educationShare": return s.budget.education;
    case "reliefShare": return s.budget.relief;
    case "defenseShare": return s.budget.defense;
    case "technology": return s.society.technology;
    case "debasements": return s.money.debasements;
  }
  if (name.startsWith("flag:")) return s.flags[name.slice(5)] ?? 0;
  throw new Error(`unknown stat ${name}`);
}

const test = (s: GameState, c: Condition) => {
  const v = stat(s, c.stat);
  return (c.gt === undefined || v > c.gt) && (c.lt === undefined || v < c.lt);
};

export function eligible(s: GameState, e: EventDef): boolean {
  const w = e.when ?? {};
  if (e.once && s.eventHistory.some((h) => h.id === e.id)) return false;
  const last = s.cooldowns[e.id];
  if (last !== undefined && s.turn - last < (e.cooldown ?? 8)) return false;
  if (w.minTurn !== undefined && s.turn < w.minTurn) return false;
  if (w.maxTurn !== undefined && s.turn > w.maxTurn) return false;
  if (w.minYear !== undefined && s.year < w.minYear) return false;
  if (w.maxYear !== undefined && s.year > w.maxYear) return false;
  if (w.scenario && !w.scenario.includes(s.scenario)) return false;
  if (w.era && !w.era.includes(currentEra(s))) return false;
  if (w.all && !w.all.every((c) => test(s, c))) return false;
  if (w.any && !w.any.some((c) => test(s, c))) return false;
  if (w.policy) for (const [k, v] of Object.entries(w.policy)) if (!!s.policies[k as PolicyId] !== v) return false;
  if (w.institution) for (const [k, v] of Object.entries(w.institution)) if (!!s.institutions[k as InstitutionId] !== v) return false;
  if (w.flag) for (const [k, v] of Object.entries(w.flag)) if (!!s.flags[k] !== v) return false;
  return true;
}

/** Draw at most one event for the coming turn. Deterministic per (seed, turn). */
export function drawEvent(s: GameState): EventDef | undefined {
  const rng = streamRng(s.seed, s.turn, "event");
  const crisisDamp = s.meters.goodSociety ? 0.7 : 1;
  const chance = s.scenario === "needle" ? (s.turn < 4 ? 0 : 0.45) : 0.62;
  if (!rng.chance(chance)) return undefined;
  const pool = EVENTS.filter((e) => eligible(s, e));
  return rng.weighted(pool, (e) => e.weight * (["harvest", "money", "society"].includes(e.category) ? crisisDamp : 1) * (e.category === "history" ? 3 : 1));
}

export function choiceAvailable(s: GameState, c: EventChoice): boolean {
  const r = c.requires;
  if (!r) return true;
  if (r.institution && !s.institutions[r.institution]) return false;
  if (r.treasuryRevenue !== undefined && s.treasury < r.treasuryRevenue * s.revenue) return false;
  if (r.policy && !s.policies[r.policy]) return false;
  if (r.notPolicy && s.policies[r.notPolicy]) return false;
  return true;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function applyEffects(s: GameState, effects: Effect[], source: string): void {
  for (const e of effects) applyEffect(s, e, source);
}

export function applyEffect(s: GameState, e: Effect, source: string): void {
  const rev = Math.max(1, s.revenue);
  switch (e.op) {
    case "treasury": s.treasury += e.scale === "revenue" ? e.v * rev : e.v; if (s.treasury < 0) { s.debt -= s.treasury; s.treasury = 0; } break;
    case "debt": s.debt = Math.max(0, s.debt + (e.scale === "revenue" ? e.v * rev : e.v)); break;
    case "trust": s.money.trust = clamp(s.money.trust + e.v, 0, 100); break;
    case "inflation": s.money.pendingInflation += e.v; break;
    case "stock": {
      const g = s.goods[e.good as GoodId];
      g.stock = Math.max(0, e.mult ? g.stock * e.v : g.stock + e.v);
      if (!e.mult && e.v < 0 && g.stock === 0) g.price *= 1.1;
      break;
    }
    case "price": s.goods[e.good].price *= e.mult; break;
    case "class": { const c = s.classes[e.cls as ClassId]; c.satisfaction = clamp(c.satisfaction + e.v, 0, 100); break; }
    case "influence": { const c = s.classes[e.cls]; c.influence = clamp(c.influence + e.v, 0, 100); break; }
    case "policy": s.policies[e.id] = e.on; break;
    case "pop": for (const t of s.towns) t.pop = Math.max(5, t.pop * e.mult); break;
    case "literacy": s.society.literacy = clamp(s.society.literacy + e.v, 0, 1); break;
    case "capital": for (const b of s.buildings) b.capital *= e.mult; break;
    case "fraud": s.society.fraud = clamp(s.society.fraud + e.v, 0.02, 1); break;
    case "bandits": s.society.banditry = clamp(s.society.banditry + e.v, 0, 1); break;
    case "granary": s.society.granary = Math.max(0, s.society.granary + e.v * Math.max(1, s.towns.reduce((a, t) => a + t.pop, 0)) * 0.1); break;
    case "institutionTrust": s.society.institutionTrust = clamp(s.society.institutionTrust + e.v, 0, 100); break;
    case "worship": s.society.freedomOfWorship = clamp(s.society.freedomOfWorship + e.v, 0, 1); break;
    case "technology": s.society.technology = Math.max(0.5, s.society.technology + e.v); break;
    case "credit": s.society.credit += e.v; break;
    case "advisor": { const a = s.advisors[e.who]; if (!a.resigned) a.trust = clamp(a.trust + e.v, 0, 100); break; }
    case "flag": s.flags[e.name] = e.v ?? 1; break;
    case "progress": s.progress += e.v; break;
    case "releaseGranary": {
      // Only grain actually stored in good years can be released (and bakers turn it into bread).
      s.goods.grain.stock += s.society.granary;
      s.society.granary = 0;
      break;
    }
    case "customs": s.taxes.customs = clamp(s.taxes.customs + e.v, 0, 0.6); break;
    case "foreign": s.flags.foreignMult = (s.flags.foreignMult || 1) * e.mult; break;
    case "delay": s.delayed.push({ turn: s.turn + e.turns, effects: e.effects, source }); break;
    case "chronicle": s.chronicle.push({ turn: s.turn, year: s.year, key: e.key }); break;
  }
}
