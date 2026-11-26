// Player decisions. Every change goes through applyCommand so it can be validated, logged for
// counterfactual replay (§9), and judged by the council (§7).
import {
  ADVISOR_IDS, BUILDINGS, INFRA_COST, INSTITUTIONS, MAX_POLICY_CHANGES_PER_TURN, POLICIES,
  type AdvisorId, type InstitutionId, type Infra, type Terrain,
} from "./defs.ts";
import { discover } from "./discovery.ts";
import { applyEffects, choiceAvailable, currentEra, EVENT_BY_ID } from "./events.ts";
import { distance, key } from "./hex.ts";
import { SCENARIOS } from "./scenarios.ts";
import { applyReform, canPlace, makeBuilding, tileIndex } from "./turn.ts";
import type { Command, GameState } from "./types.ts";

export type CommandResult = { ok: true; state: GameState } | { ok: false; error: string };

export function buildCost(s: GameState, type: keyof typeof BUILDINGS): number {
  return Math.round(BUILDINGS[type].cost * SCENARIOS[s.scenario].costScale * (s.institutions.jointStock ? 0.75 : 1));
}

const INFRA_TERRAIN: Record<Terrain, number> = { sea: Infinity, plains: 1, fertile: 1, forest: 1.5, hills: 2, mountains: 3 };
export function infraCost(s: GameState, infra: Infra, terrain: Terrain): number {
  const works = Math.min(1, s.flags.worksAdequacy ?? 0.5);
  return Math.round(INFRA_COST[infra] * INFRA_TERRAIN[terrain] * SCENARIOS[s.scenario].costScale * (1.15 - 0.3 * works));
}
export const FOUND_TOWN_COST = 50;

export function institutionAvailable(s: GameState, id: InstitutionId): string | null {
  const d = INSTITUTIONS[id];
  if (s.institutions[id]) return "done";
  if (d.era > currentEra(s)) return "era";
  if (d.excludes && s.institutions[d.excludes]) return "excluded";
  if (d.requires.some((r) => !s.institutions[r])) return "requires";
  // Railways need working steam engines first.
  if (id === "railways" && s.society.technology < 1.12) return "technology";
  if (s.tutorial && !s.tutorial.marketFormed && id !== "coinage") return "tutorial";
  return null;
}

function judge(s: GameState, stance: Partial<Record<AdvisorId, number>> | undefined, cause: string) {
  if (!stance) return;
  for (const a of ADVISOR_IDS) {
    const st = stance[a] ?? 0;
    const adv = s.advisors[a];
    if (adv.resigned || st === 0) continue;
    if (st > 0) adv.trust = Math.min(100, adv.trust + 3);
    else {
      adv.trust = Math.max(0, adv.trust - 7);
      adv.ignored += 1;
      if (adv.trust < 12) {
        adv.resigned = true;
        s.chronicle.push({ turn: s.turn, year: s.year, key: `resign.${a}`, vars: { cause } });
      }
    }
  }
}

export function applyCommand(prev: GameState, cmd: Command): CommandResult {
  const s: GameState = structuredClone(prev);
  const err = run(s, cmd);
  if (err) return { ok: false, error: err };
  s.pending.push(cmd);
  return { ok: true, state: s };
}

function run(s: GameState, cmd: Command): string | null {
  if (s.status === "ended") return "ended";
  if (s.status === "reckoning" && cmd.type !== "reform") return "reckoning";
  if (s.pendingEvent && cmd.type !== "eventChoice") return "event";
  const idx = tileIndex(s);
  switch (cmd.type) {
    case "build": {
      const t = s.tiles[idx.get(key(cmd))!];
      const bad = canPlace(s, cmd.building, t);
      if (bad) return bad;
      const cost = buildCost(s, cmd.building);
      if (s.treasury < cost) return "treasury";
      s.treasury -= cost;
      s.buildings.push(makeBuilding(s, cmd.building, cmd.q, cmd.r));
      if (cmd.building === "school") discover(s, "duties-of-sovereign");
      return null;
    }
    case "infra": {
      const t = s.tiles[idx.get(key(cmd))!];
      if (!t || t.terrain === "sea") return "terrain";
      if (cmd.infra === "canal" && (!s.institutions.canals || t.terrain === "hills" || t.terrain === "mountains")) return cmd.infra === "canal" && !s.institutions.canals ? "institution" : "terrain";
      if (cmd.infra === "rail" && !s.institutions.railways) return "institution";
      const rank: Record<Infra, number> = { road: 1, canal: 2, rail: 3 };
      const cur = s.infra[key(t)];
      if (cur && rank[cur] >= rank[cmd.infra]) return "exists";
      const cost = infraCost(s, cmd.infra, t.terrain);
      if (s.treasury < cost) return "treasury";
      s.treasury -= cost;
      s.infra[key(t)] = cmd.infra;
      return null;
    }
    case "demolish": {
      const k = key(cmd);
      const i = s.buildings.findIndex((b) => key(b) === k);
      if (i >= 0) { s.buildings.splice(i, 1); return null; }
      if (s.infra[k]) { delete s.infra[k]; return null; }
      return "nothing";
    }
    case "foundTown": {
      const t = s.tiles[idx.get(key(cmd))!];
      if (!t || t.terrain === "sea" || t.terrain === "mountains") return "terrain";
      if (s.towns.some((tw) => distance(tw, t) < 3)) return "tooClose";
      if (s.buildings.some((b) => key(b) === key(t))) return "occupied";
      const cost = FOUND_TOWN_COST * SCENARIOS[s.scenario].costScale;
      if (s.treasury < cost) return "treasury";
      const biggest = [...s.towns].sort((a, b) => b.pop - a.pop)[0];
      const settlers = Math.min(10, biggest.pop * 0.1);
      biggest.pop -= settlers;
      s.treasury -= cost;
      s.towns.push({ id: `t${s.nextId++}`, name: cmd.name, q: t.q, r: t.r, pop: settlers, mood: 55, founded: s.turn });
      return null;
    }
    case "policy": {
      if (s.policies[cmd.id] === cmd.on) return "same";
      if (s.policyChangesThisTurn >= MAX_POLICY_CHANGES_PER_TURN) return "cardLimit";
      if (s.flags[`lock_${cmd.id}`] && cmd.on) return "locked";
      // Landlords block reforms that hurt them while they are angry and strong (§4.6).
      if (cmd.id === "cornLaw" && !cmd.on && s.classes.landlords.satisfaction < 25 && s.classes.landlords.influence > 30) return "blocked";
      s.policies[cmd.id] = cmd.on;
      s.policyChangesThisTurn += 1;
      const stance = POLICIES[cmd.id].stance;
      judge(s, cmd.on ? stance : { scotsman: -stance.scotsman, scholar: -stance.scholar }, cmd.id);
      // The quick payoff each lobby promised.
      if (cmd.on) {
        if (cmd.id === "cornLaw") s.classes.landlords.satisfaction += 12;
        if (cmd.id === "pinMonopoly") { s.treasury += 0.4 * s.revenue; s.classes.merchants.satisfaction += 12; }
        if (cmd.id === "guildRules") s.classes.merchants.satisfaction += 6;
        if (cmd.id === "internalTolls") s.treasury += 0.2 * s.revenue;
        if (cmd.id === "navigationActs") s.classes.merchants.satisfaction += 5;
        if (cmd.id === "breadPriceCap") s.classes.laborers.satisfaction += 6;
      } else {
        if (cmd.id === "cornLaw") s.classes.landlords.satisfaction -= 12;
        if (cmd.id === "pinMonopoly") s.classes.merchants.satisfaction -= 8;
        if (cmd.id === "testActs") s.society.freedomOfWorship = Math.min(1, s.society.freedomOfWorship + 0.15);
      }
      discover(s, POLICIES[cmd.id].codex);
      return null;
    }
    case "debase": {
      if (!s.institutions.coinage) return "institution";
      if (s.policyChangesThisTurn >= MAX_POLICY_CHANGES_PER_TURN) return "cardLimit";
      s.policyChangesThisTurn += 1;
      s.treasury += 0.6 * Math.max(1, s.revenue);
      s.money.trust = Math.max(0, s.money.trust - 26);
      s.money.pendingInflation += 0.25;
      s.money.debasements += 1;
      s.money.debaseTurns.push(s.turn);
      s.flags.lastDebase = s.turn;
      s.chronicle.push({ turn: s.turn, year: s.year, key: "debase" });
      judge(s, { scotsman: -1, scholar: -1 }, "debase");
      discover(s, "money-mirror");
      return null;
    }
    case "budget": {
      s.budget[cmd.line] = Math.max(0, Math.min(0.6, cmd.value));
      discover(s, "duties-of-sovereign");
      return null;
    }
    case "tax": {
      const t = cmd.taxes;
      for (const k of ["land", "exciseNecessities", "exciseLuxuries", "customs"] as const) {
        if (t[k] !== undefined) s.taxes[k] = Math.max(0, Math.min(0.6, t[k]!));
      }
      if (t.collection) s.taxes.collection = t.collection;
      s.taxChanges.push(s.turn);
      discover(s, "four-maxims");
      return null;
    }
    case "institution": {
      if (cmd.id === null) { s.developing = null; s.progress = 0; return null; }
      const bad = institutionAvailable(s, cmd.id);
      if (bad) return bad;
      if (s.developing !== cmd.id) s.progress = s.developing === null ? s.progress : 0;
      s.developing = cmd.id;
      return null;
    }
    case "eventChoice": {
      const pe = s.pendingEvent;
      if (!pe || pe.id !== cmd.eventId) return "noEvent";
      const def = EVENT_BY_ID.get(pe.id);
      if (!def) return "noEvent";
      const c = def.choices[cmd.choice];
      if (!c || !choiceAvailable(s, c)) return "choice";
      applyEffects(s, c.effects, def.id);
      judge(s, c.advisors, def.id);
      s.eventHistory.push({ turn: s.turn, id: def.id, choice: cmd.choice });
      if (c.chronicle) s.chronicle.push({ turn: s.turn, year: s.year, key: `event:${def.id}:${cmd.choice}` });
      if (c.effects.some((e) => e.op === "flag" && e.name === "debasedViaEvent")) {
        s.money.debasements += 1;
        s.money.debaseTurns.push(s.turn);
        s.flags.lastDebase = s.turn;
      }
      autoInstitutionFromEvent(s, def.id);
      s.pendingEvent = null;
      return null;
    }
    case "reform": {
      if (s.status !== "reckoning") return "notReckoning";
      const r = s.reckonings[s.reckonings.length - 1];
      if (!r.reforms.includes(cmd.id) && cmd.id !== "none") return "reform";
      r.chosen = cmd.id;
      if (cmd.id !== "none") applyReform(s, cmd.id);
      s.chapter += 1;
      s.status = "playing";
      return null;
    }
    case "borrow": {
      const amt = Math.max(0, cmd.amount);
      s.debt += amt;
      s.treasury += amt;
      discover(s, "public-debt");
      return null;
    }
    case "repay": {
      const amt = Math.min(Math.max(0, cmd.amount), s.treasury, s.debt);
      s.debt -= amt;
      s.treasury -= amt;
      return null;
    }
  }
}

/** Some events push a specific institution forward when nothing else is being developed. */
function autoInstitutionFromEvent(s: GameState, eventId: string) {
  const target: Record<string, InstitutionId> = {
    travellingMoneychanger: "coinage", millerWeights: "hisba", printers: "printingPress",
    canalPromoters: "canals", factoryChildren: "factoryActs",
  };
  const id = target[eventId];
  if (!id || s.institutions[id]) return;
  if (s.developing === null && institutionAvailable(s, id) === null) s.developing = id;
}
