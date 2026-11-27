// Scripted players for balancing (GDD §13): five strategies plus the historical autopilot used
// to calibrate the model against the ghost band (§10).
import { BUILDINGS, INSTITUTION_IDS, PRODUCER_TYPES, type BuildingType, type InstitutionId } from "./defs.ts";
import { applyCommand, buildCost, infraCost, institutionAvailable } from "./commands.ts";
import { EVENT_BY_ID, choiceAvailable } from "./events.ts";
import { distance, key } from "./hex.ts";
import { buildGraph, pathBetween } from "./transport.ts";
import { canPlace, endTurn, newGame } from "./turn.ts";
import type { Command, GameState, ScenarioId } from "./types.ts";

export type BotId = "mercantilist" | "freeTrader" | "piousSteward" | "debaser" | "balanced" | "historical";
export const BOT_IDS: BotId[] = ["mercantilist", "freeTrader", "piousSteward", "debaser", "balanced"];

/** What Britain actually did, where the game has a matching card. */
const HISTORICAL_CHOICE: Record<string, number> = {
  americanWar: 0, sinkingFund: 0, restriction1797: 0, incomeTax: 0, continentalSystem: 1, corn1815: 0,
  reformMeeting: 0, dissentersPetition: 1, eastIndiaCharter: 0, railwayMania: 0, factoryChildren: 0,
  steamEngine: 1, spinningJenny: 1, canalPromoters: 0, tradeTreaty: 0, pinMonopolyPetition: 1,
  cornLawPetition: 0, tollPetition: 0, strike: 2, machineBreakers: 0,
};
const HISTORICAL_REFORMS = ["canalMania", "debtConsolidation", "repealTestActs", "factoryReform", "publicSchoolingAct", "repealCornLaws", "foundCentralBank", "poorLawReform", "abolishTolls", "openPorts"];

function tryCmd(s: GameState, c: Command): GameState {
  const r = applyCommand(s, c);
  return r.ok ? r.state : s;
}

function chooseEvent(s: GameState, bot: BotId): number {
  const e = EVENT_BY_ID.get(s.pendingEvent!.id)!;
  const avail = e.choices.map((c, i) => ({ c, i })).filter(({ c }) => choiceAvailable(s, c));
  if (bot === "historical" && HISTORICAL_CHOICE[e.id] !== undefined && avail.some((a) => a.i === HISTORICAL_CHOICE[e.id])) return HISTORICAL_CHOICE[e.id];
  const score = (c: (typeof e.choices)[number]) => {
    const a = c.advisors ?? {};
    const sc = a.scotsman ?? 0, sh = a.scholar ?? 0;
    switch (bot) {
      case "mercantilist": return -sc + (c.effects.some((x) => x.op === "treasury" && x.v > 0) ? 2 : 0);
      case "freeTrader": return sc * 2 + sh * 0.5;
      case "piousSteward": return sh * 2 + sc * 0.5;
      case "debaser": return c.effects.some((x) => x.op === "treasury" && x.v > 0) ? 3 : sc + sh;
      case "balanced": return sc + sh + (Math.min(sc, sh) < 0 ? -1 : 0);
      // No recorded historical choice: Parliament usually took the prudent, consensual course.
      default: return sc + sh;
    }
  };
  avail.sort((a, b) => score(b.c) - score(a.c) || a.i - b.i);
  return avail[0]?.i ?? 0;
}

function setTaxesAndPolicies(s: GameState, bot: BotId): GameState {
  // Set the strategy's stance once (policies re-checked every 5 years); taxes are then managed
  // year by year by balanceBudget, as a sensible player would.
  if (s.turn !== 0 && s.turn % 5 !== 0) return s;
  const firstYear = s.turn === 0;
  switch (bot) {
    case "mercantilist":
      if (firstYear) s = tryCmd(s, { type: "tax", taxes: { customs: 0.38, exciseNecessities: 0.1 } });
      for (const id of ["cornLaw", "navigationActs"] as const) s = tryCmd(s, { type: "policy", id, on: true });
      if (s.turn > 3) s = tryCmd(s, { type: "policy", id: "pinMonopoly", on: true });
      s = tryCmd(s, { type: "budget", line: "defense", value: 0.4 });
      break;
    case "freeTrader":
      if (firstYear) s = tryCmd(s, { type: "tax", taxes: { customs: 0.08, exciseNecessities: 0.08, exciseLuxuries: 0.2, land: 0.25 } });
      for (const id of ["cornLaw", "navigationActs", "internalTolls", "guildRules"] as const) s = tryCmd(s, { type: "policy", id, on: false });
      s = tryCmd(s, { type: "budget", line: "works", value: 0.15 });
      break;
    case "piousSteward":
      if (firstYear) s = tryCmd(s, { type: "tax", taxes: { exciseNecessities: 0.05, exciseLuxuries: 0.24, customs: 0.18, land: 0.24 } });
      for (const [line, v] of [["relief", 0.12], ["education", 0.12], ["justice", 0.12], ["defense", 0.18]] as const) s = tryCmd(s, { type: "budget", line, value: v });
      for (const id of ["testActs", "internalTolls"] as const) s = tryCmd(s, { type: "policy", id, on: false });
      break;
    case "debaser":
      break;
    case "balanced":
      if (firstYear) s = tryCmd(s, { type: "tax", taxes: { customs: 0.14, exciseNecessities: 0.07, exciseLuxuries: 0.2, land: 0.24 } });
      for (const id of ["internalTolls", "guildRules", "cornLaw", "testActs", "navigationActs"] as const) s = tryCmd(s, { type: "policy", id, on: false });
      for (const [line, v] of [["defense", 0.18], ["justice", 0.1], ["works", 0.12], ["education", 0.1], ["relief", 0.07]] as const) s = tryCmd(s, { type: "budget", line, value: v });
      break;
    case "historical":
      break;
  }
  // The debaser's strategy: whenever money is short and the coin still passes, clip it.
  if (bot === "debaser" && s.treasury < 1.0 * s.revenue && s.money.trust > 40) s = tryCmd(s, { type: "debase" });
  return s;
}

const INSTITUTION_ORDER: Record<BotId, InstitutionId[]> = {
  mercantilist: ["coinage", "marketSquares", "merchantShipping", "contractCourts", "jointStock", "banks", "railways", "centralBank"],
  freeTrader: ["coinage", "marketSquares", "merchantShipping", "canals", "banks", "railways", "jointStock", "centralBank"],
  piousSteward: ["coinage", "hisba", "marketSquares", "elementarySchools", "partnershipHouses", "printingPress", "publicSchooling", "factoryActs", "canals"],
  debaser: ["coinage", "marketSquares", "banks", "canals", "railways"],
  balanced: ["coinage", "marketSquares", "hisba", "elementarySchools", "canals", "partnershipHouses", "contractCourts", "railways", "publicSchooling", "factoryActs", "centralBank"],
  historical: ["banks", "canals", "jointStock", "railways", "factoryActs", "centralBank", "publicSchooling"],
};

/** Year each institution actually arrived in Britain, for the autopilot. */
const HISTORICAL_YEAR: Partial<Record<InstitutionId, number>> = {
  banks: 1776, canals: 1785, jointStock: 1825, railways: 1826, factoryActs: 1830, centralBank: 1840, publicSchooling: 1860,
};

function develop(s: GameState, bot: BotId): GameState {
  if (s.developing) return s;
  if (bot === "historical") {
    for (const id of INSTITUTION_ORDER.historical) {
      if ((HISTORICAL_YEAR[id] ?? 9999) <= s.year && institutionAvailable(s, id) === null) return tryCmd(s, { type: "institution", id });
    }
    return s;
  }
  for (const id of [...INSTITUTION_ORDER[bot], ...INSTITUTION_IDS]) {
    if (institutionAvailable(s, id) === null) return tryCmd(s, { type: "institution", id });
  }
  return s;
}

/** Build producers where prices signal shortage, root crafts in the tutorial, and civic buildings. */
function build(s: GameState, bot: BotId): GameState {
  if (bot === "historical") return s; // history: private capital builds (the invisible hand)
  const budget = s.treasury * 0.5;
  let spent = 0;
  const towns = [...s.towns].sort((a, b) => b.pop - a.pop);
  const site = (type: BuildingType) => {
    for (const town of towns) {
      const t = s.tiles
        .filter((t) => distance(t, town) >= 1 && distance(t, town) <= 3 && canPlace(s, type, t) === null)
        .sort((a, b) => distance(a, town) - distance(b, town) || a.q - b.q || a.r - b.r)[0];
      if (t) return t;
    }
    return undefined;
  };
  const want: BuildingType[] = [];
  if (s.tutorial && !s.tutorial.marketFormed) {
    for (const type of ["weaver", "builder", "courthouse"] as BuildingType[]) if (!s.buildings.some((b) => b.type === type)) want.push(type);
  }
  if (s.tutorial?.marketFormed && !s.buildings.some((b) => b.type === "pinworks")) want.push("pinworks");
  const ranked = PRODUCER_TYPES.filter((t) => BUILDINGS[t].good)
    .map((t) => ({ t, r: s.goods[BUILDINGS[t].good!].price / s.goods[BUILDINGS[t].good!].natural }))
    .filter((x) => x.r > 1.15)
    .sort((a, b) => b.r - a.r);
  if (s.labor.idle > 3) want.push(...ranked.slice(0, 2).map((x) => x.t));
  if ((bot === "piousSteward" || bot === "balanced") && s.turn % 6 === 3) want.push("school", "granary", "courthouse");
  if ((bot === "freeTrader" || bot === "balanced") && s.buildings.filter((b) => b.type === "port").length < 2 + s.turn / 10) want.push("port");
  for (const type of want) {
    const cost = buildCost(s, type);
    if (spent + cost > budget) continue;
    const t = site(type);
    if (!t) continue;
    const before = s.treasury;
    s = tryCmd(s, { type: "build", building: type, q: t.q, r: t.r });
    spent += before - s.treasury;
  }
  return s;
}

/** Link towns with the best available infrastructure, a few hexes per turn. */
function connect(s: GameState, bot: BotId): GameState {
  if (bot === "mercantilist" && s.turn % 3 !== 0) return s;
  const infra = s.institutions.railways ? "rail" : s.institutions.canals ? "canal" : "road";
  const g = buildGraph(s);
  const towns = [...s.towns].sort((a, b) => b.pop - a.pop);
  const budget = s.treasury * (bot === "historical" ? 0.25 : 0.35);
  let spent = 0;
  for (let i = 0; i < towns.length && spent < budget; i++) {
    for (let j = i + 1; j < towns.length && spent < budget; j++) {
      if (distance(towns[i], towns[j]) > 9) continue;
      const path = pathBetween(g, g.index.get(key(towns[i]))!, g.index.get(key(towns[j]))!);
      for (const ti of path) {
        const t = s.tiles[ti];
        let kind: "road" | "canal" | "rail" = infra;
        if (kind === "canal" && (t.terrain === "hills" || t.terrain === "mountains")) kind = "road";
        const cost = infraCost(s, kind, t.terrain);
        if (spent + cost > budget) break;
        const before = s.treasury;
        s = tryCmd(s, { type: "infra", infra: kind, q: t.q, r: t.r });
        spent += before - s.treasury;
      }
    }
  }
  return s;
}

/** Keep the budget near balance: raise taxes in deficit, ease them in surplus (all bots but the debaser). */
function balanceBudget(s: GameState, bot: BotId): GameState {
  if (bot === "debaser") return s;
  const deficit = (s.flags.deficitTurns ?? 0) > 0;
  const t = s.taxes;
  // Persistent deficits: trim discretionary spending (never below a working floor).
  if ((s.flags.deficitTurns ?? 0) >= 2) {
    for (const line of ["defense", "justice", "works", "education", "relief"] as const) {
      const floor = line === "defense" ? 0.12 : 0.03;
      if (s.budget[line] > floor) s = tryCmd(s, { type: "budget", line, value: Math.max(floor, s.budget[line] * 0.9) });
    }
  }
  if (deficit) {
    // Historically: excise first, then the land tax (and the 1799 income tax, an event).
    const nec = bot === "piousSteward" || bot === "balanced" ? t.exciseNecessities : Math.min(0.25, t.exciseNecessities + 0.02);
    return tryCmd(s, { type: "tax", taxes: { exciseNecessities: nec, exciseLuxuries: Math.min(0.35, t.exciseLuxuries + 0.02), land: Math.min(0.35, t.land + 0.01) } });
  }
  if (s.treasury > 2 * s.revenue && t.exciseNecessities > 0.04) return tryCmd(s, { type: "tax", taxes: { exciseNecessities: t.exciseNecessities - 0.01 } });
  return s;
}

export function botTurn(state: GameState, bot: BotId): GameState {
  let s = state;
  if (s.status === "reckoning") {
    const r = s.reckonings[s.reckonings.length - 1];
    const order = bot === "historical" ? HISTORICAL_REFORMS :
      bot === "mercantilist" ? ["canalMania", "foundCentralBank", "debtConsolidation"] :
      bot === "freeTrader" ? ["openPorts", "repealCornLaws", "abolishTolls", "canalMania"] :
      bot === "piousSteward" ? ["poorLawReform", "publicSchoolingAct", "marketInspectors", "factoryReform", "repealTestActs"] :
      ["abolishTolls", "canalMania", "repealCornLaws", "publicSchoolingAct", "marketInspectors", "openPorts", "foundMint"];
    const pick = order.find((id) => r.reforms.includes(id)) ?? r.reforms[0] ?? "none";
    s = tryCmd(s, { type: "reform", id: pick });
  }
  if (s.pendingEvent) s = tryCmd(s, { type: "eventChoice", eventId: s.pendingEvent.id, choice: chooseEvent(s, bot) });
  if (s.status !== "playing") return s;
  s = setTaxesAndPolicies(s, bot);
  s = balanceBudget(s, bot);
  s = develop(s, bot);
  s = build(s, bot);
  s = connect(s, bot);
  return endTurn(s);
}

export interface BotResult { bot: BotId; seed: number; ending: string; opulence: number; maslaha: number; turns: number; gdppc: number; realWage: number }

export function playGame(scenario: ScenarioId, bot: BotId, seed: number, maxTurns = 200): { result: BotResult; state: GameState } {
  let s = newGame(scenario, seed);
  for (let i = 0; i < maxTurns && s.status !== "ended"; i++) s = botTurn(s, bot);
  const last = s.history[s.history.length - 1];
  return {
    state: s,
    result: { bot, seed, ending: s.ending ?? "unfinished", opulence: s.meters.opulence.value, maslaha: s.meters.maslaha.value, turns: s.turn, gdppc: last.gdppc, realWage: last.realWage },
  };
}
