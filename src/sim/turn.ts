// The turn loop (GDD §2): read the market → allocate → specialise → invest/consume → govern → resolve.
import {
  BASKET, BUDGET_LINES, BUILDINGS, GOOD_IDS, INSTITUTIONS, POLICY_IDS, PRODUCER_TYPES, SIM,
  type BuildingType, type GoodId, type InstitutionId,
} from "./defs.ts";
import { runDiscoveries } from "./discovery.ts";
import { realNaturalPrices, totalPop, capacity, type MarketResult } from "./economy.ts";
import { emptyAcc, initBuilding, initMarkets, newMarket, stepDay, sumRec } from "./rt.ts";
import { applyEffects, currentEra, drawEvent, EVENT_BY_ID } from "./events.ts";
import { distance, key, neighbors } from "./hex.ts";
import { computeMeters, marketAccess } from "./meters.ts";
import { makeRng } from "./rng.ts";
import {
  COASTAL_TOWNS, generateTiles, placeOnLand, SCENARIOS, townSeeds,
} from "./scenarios.ts";
import { laborerRealWage, nominalGdp, runMoney, runSociety, runTreasury } from "./society.ts";
import { buildGraph, pathBetween } from "./transport.ts";
import type { Building, GameState, GoodState, ScenarioId, Tile, TurnReport } from "./types.ts";

export const emptyReport = (): TurnReport => ({ levelUps: [], priceSpikes: [], privateBuilds: [], riots: false, notes: [] });

export function tileIndex(s: GameState): Map<string, number> {
  const m = new Map<string, number>();
  s.tiles.forEach((t, i) => m.set(key(t), i));
  return m;
}

export function chapterOf(s: GameState) {
  const ch = SCENARIOS[s.scenario].chapters;
  return ch[Math.min(s.chapter, ch.length - 1)];
}

export function canPlace(s: GameState, type: BuildingType, t: Tile | undefined): string | null {
  if (!t) return "noTile";
  const def = BUILDINGS[type];
  if (!def.terrain.includes(t.terrain)) return "terrain";
  if (def.needsDeposit && t.deposit !== def.needsDeposit) return "deposit";
  if (def.coastal && !t.coast) return "coastal";
  if (s.buildings.some((b) => b.q === t.q && b.r === t.r)) return "occupied";
  if (s.towns.some((tw) => tw.q === t.q && tw.r === t.r)) return "town";
  return null;
}

export function makeBuilding(s: GameState, type: BuildingType, q: number, r: number, workers = 0, priv = false): Building {
  return {
    id: `b${s.nextId++}`, type, q, r, workers, level: 1, maxLevel: 1, reach: 0,
    capital: BUILDINGS[type].good ? 2 : 0, wage: s.labor.avgWage || 1, output: 0, inputFill: 1, sold: 1,
    profit: 0, built: s.turn, private: priv || undefined,
    inBuf: {}, incoming: {}, outBuf: 0, status: BUILDINGS[type].good ? "idle" : "civic", cycle: 0, mRev: 0, mCost: 0,
  };
}

// ---------------------------------------------------------------- new game
export function newGame(scenario: ScenarioId, seed: number): GameState {
  const def = SCENARIOS[scenario];
  const tiles = generateTiles(scenario, seed);
  const taken = new Set<string>();
  const towns = townSeeds(scenario).map((ts, i) => {
    const t = placeOnLand(tiles, def.radius, ts.x, ts.y, taken, COASTAL_TOWNS.has(ts.name));
    taken.add(key(t));
    // Keep a ring of space around towns.
    return { id: `t${i}`, name: ts.name, q: t.q, r: t.r, pop: ts.pop, mood: 55, founded: 0 };
  });
  const goods = {} as Record<GoodId, GoodState>;
  for (const g of GOOD_IDS) goods[g] = { price: 1, natural: 1, stock: 0, produced: 0, supply: 0, demand: 0, sold: 0, imported: 0, exported: 0, shortage: 0, basePrice: 1, util: 1 };
  const s: GameState = {
    version: 1, scenario, seed, turn: 0, year: def.chapters[0].start, chapter: 0, status: "playing",
    radius: def.radius, tiles, towns, buildings: [], infra: {}, goods,
    labor: { workforce: 0, idle: 0, avgWage: 1, subsistence: 0.45, moved: 0, refWage: 1 },
    classes: {
      laborers: { satisfaction: 55, influence: 20, income: 0 },
      merchants: { satisfaction: 55, influence: 30, income: 0 },
      landlords: { satisfaction: 55, influence: 40, income: 0 },
    },
    treasury: 0, debt: 0, interestRate: def.interestRate, revenue: 0, spending: 0, revenueBreakdown: {},
    budget: { ...def.budget }, taxes: { ...def.taxes }, taxChanges: [],
    policies: Object.fromEntries(POLICY_IDS.map((p) => [p, def.policies.includes(p)])) as GameState["policies"],
    policyChangesThisTurn: 0,
    institutions: Object.fromEntries(def.institutions.map((i) => [i, true])),
    developing: null, progress: 0,
    money: { trust: def.trust, priceLevel: 1, pendingInflation: 0, hoarding: 0, debasements: 0, debaseTurns: [] },
    society: {
      literacy: def.literacy, fraud: 0.12, banditry: 0.08, granary: 0, famineDeaths: 0, unemployment: 0, emigration: 0,
      freedomOfWorship: def.policies.includes("testActs") ? 0.72 : 1, institutionTrust: 55, necessitySecured: 1,
      housingSecured: 1, smuggling: 0, credit: 0, technology: 1,
    },
    meters: { opulence: { value: 0, parts: [] }, maslaha: { value: 0, parts: [] }, goodSociety: false },
    advisors: { scotsman: { trust: 60, resigned: false, ignored: 0 }, scholar: { trust: 60, resigned: false, ignored: 0 } },
    pendingEvent: null, eventHistory: [], cooldowns: {}, flags: {}, delayed: [],
    discovered: [], newDiscoveries: [], history: [], chronicle: [], log: [], pending: [], reckonings: [], reforms: [],
    calibration: { gdpScale: 1, wageScale: 1, popScale: 1, capital0: 1, trade0: 0.01 },
    nextId: 1, report: emptyReport(),
    tutorial: def.tutorial ? { step: 0, marketFormed: false } : undefined,
    day: 0, markets: [], carts: [], netVersion: 0, entries: [], flow: [], jam: [], acc: emptyAcc(),
    mInc: { laborers: 0, merchants: 0, landlords: 0 }, nextCart: 1,
  };
  if (!def.coinage) delete s.institutions.coinage;
  const real = realNaturalPrices(s);
  for (const g of GOOD_IDS) {
    goods[g].price = goods[g].natural = goods[g].basePrice = real[g];
  }
  placeStartingEconomy(s);
  const pop = totalPop(s);
  for (const [g, q] of Object.entries(BASKET) as [GoodId, number][]) goods[g].stock = q * pop * 0.6;
  s.classes.laborers.income = pop * SIM.workforceShare * 0.9;
  s.classes.merchants.income = s.classes.laborers.income * 0.25;
  s.classes.landlords.income = s.classes.laborers.income * 0.15;
  s.revenue = nominalGdp(s) * 0.08;
  s.debt = 0;
  initMarkets(s);
  // Burn-in: let goods, prices, wages and labour settle on the roads before the player's first year.
  s.flags.burnIn = 1;
  let quiet = 0;
  for (let i = 0; i < 40 && (i < def.burnIn || quiet < 3); i++) {
    while (!stepDay(s)) { /* a year of days */ }
    closeYear(s);
    s.day = 0;
    s.acc = emptyAcc();
    s.flags.mmSettled = 0;
    s.turn += 1; // keeps per-turn parity rules (e.g. guild delays) moving during burn-in
    quiet = s.report.levelUps.length ? 0 : quiet + 1;
  }
  delete s.flags.burnIn;
  // Measure an ordinary year's revenue (burn-in years differ) before setting the historical debt.
  if (def.debtYears > 0) {
    const probe: GameState = structuredClone(s);
    probe.debt = 0;
    while (!stepDay(probe)) { /* one ordinary year */ }
    closeYear(probe);
    s.debt = def.debtYears * probe.revenue;
  } else s.debt = 0;
  s.treasury = def.tutorial ? 150 : def.treasury * s.revenue;
  s.turn = 0;
  s.year = def.chapters[0].start;
  s.history = [];
  s.chronicle = [];
  s.discovered = [];
  s.newDiscoveries = [];
  s.delayed = [];
  s.report = emptyReport();
  for (const b of s.buildings) b.built = -10;
  s.flags.pop0 = totalPop(s);
  calibrate(s);
  s.acc = emptyAcc();
  s.day = 0;
  // Production statistics start with the game, not the warm-up years.
  s.stats = [];
  s.mStat = undefined;
  s.history.push(record(s));
  return s;
}

function placeStartingEconomy(s: GameState): void {
  const def = SCENARIOS[s.scenario];
  const taken = new Set<string>([...s.towns.map((t) => key(t))]);
  const byKey = new Map(s.tiles.map((t) => [key(t), t]));
  const ring = (q: number, r: number, maxD: number) =>
    s.tiles
      .filter((t) => distance(t, { q, r }) >= 1 && distance(t, { q, r }) <= maxD && !taken.has(key(t)))
      .sort((a, b) => distance(a, { q, r }) - distance(b, { q, r }) || a.q - b.q || a.r - b.r);
  const place = (type: BuildingType, q: number, r: number, maxD = 3, fill = 0.7) => {
    const t = ring(q, r, maxD).find((t) => canPlace(s, type, t) === null);
    if (!t) return;
    taken.add(key(t));
    const b = makeBuilding(s, type, t.q, t.r);
    if (BUILDINGS[type].good) {
      b.workers = capacity(1) * fill;
      b.capital = 3;
    }
    s.buildings.push(b);
  };
  if (s.scenario === "needle") {
    const town = s.towns[0];
    place("farm", town.q, town.r, 2, 0.9);
    place("farm", town.q, town.r, 3, 0.9);
    place("bakery", town.q, town.r, 2, 0.6);
    place("bakery", town.q, town.r, 3, 0.4);
    place("lumber", town.q, town.r, 4, 0.6);
    const v1 = s.towns[1];
    place("farm", v1.q, v1.r, 2, 0.9);
    place("pasture", v1.q, v1.r, 2, 0.7);
    const v2 = s.towns[2];
    place("farm", v2.q, v2.r, 2, 0.9);
    void byKey;
    return;
  }
  // Plan each town's workshops from what its people need (workers per head ÷ ~5 per shop).
  const perHead: [BuildingType, number][] = [
    ["farm", (0.9 * 1.1) / 13], ["bakery", 0.99 / 20], ["pasture", 0.16 / 8.5], ["weaver", 0.16 / 5.5],
    ["lumber", 0.55 / 11], ["builder", 0.145 / 4.3], ["smithy", 0.05 / 3], ["pinworks", 0.04 / 10],
  ];
  const popTotal = s.towns.reduce((a, t) => a + t.pop, 0);
  for (const [type, wpc] of perHead) {
    // National count, shared out to towns by population (largest remainder).
    const n = Math.round((popTotal * wpc) / 5);
    const quotas = s.towns.map((t) => (n * t.pop) / popTotal);
    const counts = quotas.map(Math.floor);
    let left = n - counts.reduce((a, v) => a + v, 0);
    const order = quotas.map((q, i) => ({ i, r: q - Math.floor(q) })).sort((a, b) => b.r - a.r);
    for (const { i } of order) { if (left <= 0) break; counts[i]++; left--; }
    // Every sizeable town in 1776 could feed, warm, clothe and house itself locally.
    const basic = ["farm", "bakery", "lumber", "builder", "weaver"].includes(type);
    s.towns.forEach((town, i) => {
      const k0 = basic && town.pop >= 25 ? Math.max(1, counts[i]) : counts[i];
      for (let k = 0; k < k0; k++) place(type, town.q, town.r, type === "lumber" || type === "pasture" ? 5 : 3, 0.85);
    });
  }
  // Smith's own pin factory: one in the capital.
  const capital = s.towns[0];
  if (!s.buildings.some((b) => b.type === "pinworks")) place("pinworks", capital.q, capital.r, 3, 0.85);
  // Mines at the deposits nearest the industrial towns.
  for (const name of ["Birmingham", "Newcastle", "Glasgow", "Leeds", "Manchester"]) {
    const town = s.towns.find((t) => t.name === name);
    if (!town) continue;
    const dep = s.tiles
      .filter((t) => t.deposit && !taken.has(key(t)))
      .sort((a, b) => distance(a, town) - distance(b, town))[0];
    if (dep) {
      taken.add(key(dep));
      const b = makeBuilding(s, "mine", dep.q, dep.r, capacity(1) * 0.7);
      b.capital = 3;
      s.buildings.push(b);
    }
  }
  // Ports at the great harbours; courts in the capitals; Scotland's parish schools.
  for (const name of ["London", "Bristol", "Liverpool", "Glasgow", "Newcastle"]) {
    const town = s.towns.find((t) => t.name === name);
    if (town) place("port", town.q, town.r, 3);
  }
  for (const name of ["London", "Edinburgh"]) {
    const town = s.towns.find((t) => t.name === name);
    if (town) place("courthouse", town.q, town.r, 2);
  }
  for (const name of ["Edinburgh", "Glasgow"]) {
    const town = s.towns.find((t) => t.name === name);
    if (town) place("school", town.q, town.r, 2);
  }
  // Turnpike roads that existed by 1776 (stylised): London to the main towns.
  const g = buildGraph(s);
  const link = (a: string, b: string) => {
    const ta = s.towns.find((t) => t.name === a), tb = s.towns.find((t) => t.name === b);
    if (!ta || !tb) return;
    for (const i of pathBetween(g, g.index.get(key(ta))!, g.index.get(key(tb))!)) {
      const t = s.tiles[i];
      if (t.terrain !== "sea") s.infra[key(t)] = "road";
    }
  };
  link("London", "Bristol");
  link("London", "Birmingham");
  link("Birmingham", "Manchester");
  link("London", "Norwich");
  link("Edinburgh", "Glasgow");
  void def;
}

/** Fix the conversion from simulation units to scenario units so turn 0 equals history (§10). */
function calibrate(s: GameState): void {
  const def = SCENARIOS[s.scenario];
  const sim = simIndicators(s);
  s.calibration.gdpScale = def.start.gdppc / Math.max(1e-9, sim.gdppc);
  s.calibration.wageScale = def.start.realWage / Math.max(1e-9, sim.realWage);
  s.calibration.popScale = def.start.popDisplay / Math.max(1, totalPop(s));
  s.calibration.capital0 = sim.capitalPerWorker;
  s.calibration.trade0 = Math.max(0.01, sim.tradePerPerson);
  updateMeters(s, buildGraph(s));
}

interface SimIndicators { gdppc: number; realWage: number; capitalPerWorker: number; tradePerPerson: number }

function simIndicators(s: GameState): SimIndicators {
  const pop = totalPop(s);
  const basketCost = (Object.entries(BASKET) as [GoodId, number][]).reduce((a, [g, q]) => a + q * s.goods[g].price, 0);
  const capital = s.buildings.reduce((a, b) => a + b.capital, 0);
  let tradeReal = 0;
  for (const g of GOOD_IDS) tradeReal += (s.goods[g].imported + s.goods[g].exported) * s.goods[g].basePrice;
  return {
    gdppc: (s.flags.realGdp ?? 0) / Math.max(1, pop),
    realWage: laborerRealWage(s, basketCost),
    capitalPerWorker: capital / Math.max(1, s.labor.workforce || pop * SIM.workforceShare),
    tradePerPerson: tradeReal / Math.max(1, pop),
  };
}

/** Indicators in scenario units (2011 $, welfare ratio …). */
export function indicators(s: GameState): SimIndicators {
  const x = simIndicators(s);
  return { ...x, gdppc: x.gdppc * s.calibration.gdpScale, realWage: x.realWage * s.calibration.wageScale };
}

function updateMeters(s: GameState, g: ReturnType<typeof buildGraph>): void {
  const ind = indicators(s);
  const m = computeMeters(s, ind, marketAccess(s, g));
  const def = SCENARIOS[s.scenario];
  s.meters = {
    opulence: m.opulence,
    maslaha: m.maslaha,
    goodSociety: m.opulence.value >= Math.max(60, def.targets.opulence) && m.maslaha.value >= Math.max(60, def.targets.maslaha),
  };
}

function record(s: GameState) {
  const ind = indicators(s);
  return {
    turn: s.turn, year: s.year, gdppc: ind.gdppc, realWage: ind.realWage,
    opulence: s.meters.opulence.value, maslaha: s.meters.maslaha.value,
    treasury: s.treasury, trust: s.money.trust, pop: totalPop(s) * s.calibration.popScale,
    breadPrice: s.goods.bread.price,
  };
}

// ---------------------------------------------------------------- the yearly close
/** Turn the year's physical flows (s.acc) into the national accounts the annual systems use. */
function yearAccounts(s: GameState): MarketResult {
  const a = s.acc;
  let realGdp = 0;
  for (const g of GOOD_IDS) realGdp += (a.produced[g] - a.inputsUsed[g]) * s.goods[g].basePrice;
  realGdp += a.hhBought.spices * s.goods.spices.basePrice * 0.15;
  for (const g of GOOD_IDS) {
    const gs = s.goods[g];
    gs.produced = a.produced[g];
    gs.sold = a.hhBought[g];
    gs.imported = a.imported[g];
    gs.exported = a.exported[g];
    gs.demand = s.markets.reduce((x, m) => x + m.want[g] + m.draw[g], 0) * 360;
    gs.supply = gs.produced + gs.imported;
    gs.util = a.capacity[g] > 0 ? a.produced[g] / a.capacity[g] : 1;
  }
  return {
    laborerIncome: s.classes.laborers.income, merchantIncome: s.classes.merchants.income, landlordIncome: s.classes.landlords.income,
    wageBill: a.wages, rents: a.rents, profits: a.profits, importValue: a.importValue, exportValue: a.exportValue,
    customs: a.customs, exciseNec: a.exciseNec, exciseLux: a.exciseLux, landTax: a.landTax, investment: a.invested, realGdp,
    necessityFill: a.necNeed > 0 ? a.necGot / a.necNeed : 1,
    foodFill: a.foodNeed > 0 ? a.foodGot / a.foodNeed : 1,
    housingFill: a.housingNeed > 0 ? a.housingGot / a.housingNeed : 1,
  };
}

function closeYear(s: GameState): void {
  const report = s.report;
  const step = 1;
  // Delayed consequences come due ("the bill arrives ten turns later").
  const due = s.delayed.filter((d) => d.turn <= s.turn);
  s.delayed = s.delayed.filter((d) => d.turn > s.turn);
  for (const d of due) applyEffects(s, d.effects, d.source);
  const graph = buildGraph(s);
  const prevMax = new Map<string, number>();
  const m = yearAccounts(s);

  s.flags.realGdp = m.realGdp;
  runTreasury(s, m);
  // Income tax (1799 event): a light, proportional tax on profit and rent.
  if (s.flags.incomeTax) {
    const t = 0.06 * (Math.max(0, m.profits) + m.rents);
    s.treasury += t;
    s.revenue += t;
    s.revenueBreakdown.incomeTax = t;
  }
  runMoney(s, step);
  for (const mk of s.markets) for (const g of GOOD_IDS) mk.price[g] *= s.money.priceLevel / (s.flags.lastPriceLevel || s.money.priceLevel);
  s.flags.lastPriceLevel = s.money.priceLevel;
  const basketCost = (Object.entries(BASKET) as [GoodId, number][]).reduce((a, [g, q]) => a + q * s.goods[g].price, 0);
  const rw = laborerRealWage(s, basketCost) * s.calibration.wageScale;
  const realWageRel = rw / SCENARIOS[s.scenario].start.realWage;
  runSociety(s, m, step, s.flags.burnIn ? 1 : realWageRel);
  privateInvestment(s, report);
  inventMachines(s, step);
  // Riots and revolution (§4.6, §8 Collapse).
  if (s.classes.laborers.satisfaction < 25) {
    report.riots = true;
    s.flags.riotTurn = s.turn;
    const rng = makeRng(s.seed * 31 + s.turn);
    const victims = s.buildings.filter((b) => BUILDINGS[b.type].good);
    if (victims.length) rng.pick(victims).capital *= 0.5;
    s.society.institutionTrust = Math.max(0, s.society.institutionTrust - 4);
  }
  s.flags.revolution = s.classes.laborers.satisfaction < 12 ? (s.flags.revolution ?? 0) + 1 : 0;
  // Institutions develop with education and justice spending (§6).
  if (s.developing) {
    let pts = 3 + 16 * (s.budget.education + s.budget.justice) * Math.min(2, s.revenue / Math.max(1, nominalGdp(s) * 0.08));
    if (s.meters.goodSociety) pts *= 1.25;
    if (s.classes.landlords.satisfaction < 25) pts *= 0.5; // landlords block reforms
    if (s.institutions.printingPress && s.developing === "publicSchooling") pts *= 1.3;
    s.progress += pts * step;
    const def = INSTITUTIONS[s.developing];
    if (s.progress >= def.cost) {
      s.institutions[s.developing] = true;
      s.chronicle.push({ turn: s.turn, year: s.year, key: `inst.${s.developing}` });
      if (def.codex) report.notes.push(`codex:${def.codex}`);
      s.developing = null;
      s.progress = 0;
    }
  }
  updateMeters(s, graph);
  const ind = indicators(s);
  runDiscoveries(s, {
    prevMaxLevels: prevMax,
    realWageRel: ind.realWage / SCENARIOS[s.scenario].start.realWage,
    capitalRel: ind.capitalPerWorker / Math.max(1e-9, s.calibration.capital0),
  });
  for (const n of report.notes) if (n.startsWith("codex:")) {
    const id = n.slice(6);
    if (!s.discovered.includes(id)) { s.discovered.push(id); s.newDiscoveries.push(id); }
  }
}

/** Smith's third advantage of the division of labour (§4.2): people who spend their days on one
 *  simple operation invent machines for it. Specialised (level 4–5) shops, literacy and learned
 *  societies drive slow, steady technical progress. */
function inventMachines(s: GameState, step: number): void {
  if (s.flags.burnIn) return;
  const producers = s.buildings.filter((b) => BUILDINGS[b.type].good);
  const workers = producers.reduce((a, b) => a + b.workers, 0) || 1;
  const specialised = producers.filter((b) => b.level >= 4).reduce((a, b) => a + b.workers, 0) / workers;
  const middling = producers.filter((b) => b.level === 3).reduce((a, b) => a + b.workers, 0) / workers;
  const rate = 0.0017 * (0.4 + 3 * specialised + 1 * middling) * (0.4 + s.society.literacy) * (s.institutions.learnedSocieties ? 1.5 : 1);
  s.society.technology += s.society.technology * rate * step;
}

/** The invisible hand builds (§13): savings found workshops where prices pay and hands are idle,
 *  and companies lay turnpikes, canals and railways between towns. */
function privateInvestment(s: GameState, report: TurnReport): void {
  if (s.flags.burnIn) return;
  if (s.scenario === "needle" && !s.tutorial?.marketFormed) return;
  const def = SCENARIOS[s.scenario];
  const towns = [...s.towns].sort((a, b) => b.pop - a.pop);
  const idleShare = s.labor.workforce > 0 ? s.labor.idle / s.labor.workforce : 0;
  let builds = 0;
  while (builds < 3) {
    const candidates = PRODUCER_TYPES
      .map((type) => ({ type, g: BUILDINGS[type].good! }))
      .filter(({ g }) => {
        const gs = s.goods[g];
        if (gs.demand <= 0) return false;
        // Dear and running flat out: expand. Or idle hands and a trade that is not glutted.
        return gs.price >= gs.natural * 1.12 ||
          (gs.price >= gs.natural * 1.02 && gs.util > 0.85) ||
          (idleShare > 0.03 && gs.util >= 0.85 && gs.price >= gs.natural * 0.9);
      })
      .sort((a, b) => s.goods[b.g].price / s.goods[b.g].natural - s.goods[a.g].price / s.goods[a.g].natural);
    const pick = candidates[0];
    if (!pick) break;
    const cost = BUILDINGS[pick.type].cost * def.costScale;
    if ((s.flags.privatePool ?? 0) < cost) break;
    let placed = false;
    for (const town of towns) {
      const site = s.tiles
        .filter((t) => distance(t, town) >= 1 && distance(t, town) <= 3 && canPlace(s, pick.type, t) === null)
        .sort((a, b) => distance(a, town) - distance(b, town) || a.q - b.q || a.r - b.r)[0];
      if (!site) continue;
      const b = makeBuilding(s, pick.type, site.q, site.r, 0, true);
      s.buildings.push(b);
      s.netVersion++;
      s.flags.privatePool -= cost;
      report.privateBuilds.push(b.id);
      placed = true;
      break;
    }
    if (!placed) break;
    // Mark the good as supplied for the rest of this loop.
    s.goods[pick.g].util = 0.85;
    builds++;
  }
  // Companies: turnpike trusts, canal and railway companies link the busiest pairs of towns
  // with the best works they can afford (§5: growth by building and trading).
  const per: Record<string, number> = { road: 4, canal: 14, rail: 26 };
  const rank: Record<string, number> = { road: 1, canal: 2, rail: 3 };
  const best = ["rail", "canal", "road"].filter((k) => k === "road" || (k === "canal" ? s.institutions.canals : s.institutions.railways));
  let pool = s.flags.privatePool ?? 0;
  const g = buildGraph(s);
  const pairs: { a: (typeof towns)[number]; b: (typeof towns)[number]; w: number }[] = [];
  for (let i = 0; i < towns.length; i++) for (let j = i + 1; j < towns.length; j++) {
    const d = distance(towns[i], towns[j]);
    if (d <= 10) pairs.push({ a: towns[i], b: towns[j], w: (towns[i].pop * towns[j].pop) / d });
  }
  pairs.sort((x, y) => y.w - x.w);
  for (const kind of best) {
    const unit = per[kind] * def.costScale;
    if (pool < unit * 2) continue;
    for (const { a, b } of pairs) {
      const path = pathBetween(g, g.index.get(key(a))!, g.index.get(key(b))!);
      const todo = path.map((ti) => s.tiles[ti]).filter((t) => {
        const k = kind === "canal" && (t.terrain === "hills" || t.terrain === "mountains") ? "road" : kind;
        const cur = s.infra[key(t)];
        return t.terrain !== "sea" && (!cur || rank[cur] < rank[k]);
      });
      if (!todo.length) continue;
      for (const t of todo) {
        const k = kind === "canal" && (t.terrain === "hills" || t.terrain === "mountains") ? "road" : kind;
        const c = per[k] * def.costScale;
        if (pool < c) break;
        s.infra[key(t)] = k as "road" | "canal" | "rail";
        s.netVersion++;
        pool -= c;
      }
      s.flags.privatePool = pool;
      if (!report.notes.includes(`company:${kind}`)) report.notes.push(`company:${kind}`);
      return;
    }
  }
}

// ---------------------------------------------------------------- end turn (player-facing)
export function endTurn(prev: GameState): GameState {
  if (prev.status !== "playing") throw new Error("not playing");
  if (prev.pendingEvent) throw new Error("answer the pending event first");
  const s: GameState = structuredClone(prev);
  while (!stepDay(s)) { /* the rest of the year */ }
  return finishYear(s);
}

/** Real-time play: advance up to `n` days in place. Stops at the year's end (closing it) and
 *  returns the number of days actually run. Pauses itself for events, Reckonings and endings. */
export function advanceDays(s: GameState, n: number): number {
  let ran = 0;
  while (ran < n && s.status === "playing" && !s.pendingEvent) {
    ran++;
    if (stepDay(s)) {
      const next = finishYear(s);
      Object.assign(s, next);
      break;
    }
  }
  return ran;
}

function finishYear(s: GameState): GameState {
  s.log.push({ turn: s.turn, commands: s.pending });
  s.pending = [];
  s.newDiscoveries = [];
  closeYear(s);
  s.day = 0;
  s.acc = emptyAcc();
  s.flags.mmSettled = 0;
  s.report = emptyReport();
  // Advance the calendar.
  const def = SCENARIOS[s.scenario];
  const ch = chapterOf(s);
  s.turn += 1;
  s.year += 1;
  s.policyChangesThisTurn = 0;
  s.history.push(record(s));
  tutorialProgress(s);
  // Collapse (early loss): revolution, state bankruptcy, or famine above a threshold.
  if ((s.flags.revolution ?? 0) >= 3) return finish(s, "collapse", "revolution");
  if ((s.flags.fiscalCrisis ?? 0) >= 3) return finish(s, "collapse", "bankruptcy");
  if (s.society.famineDeaths > 0.06) return finish(s, "collapse", "famine");
  if (s.year > ch.end) {
    if (s.chapter >= def.chapters.length - 1) return finish(s, endingFor(s));
    // Reckoning (§2 era loop).
    s.status = "reckoning";
    s.reckonings.push({ chapter: s.chapter, turn: s.turn, year: s.year - 1, reforms: reformOptions(s) });
    s.year = def.chapters[s.chapter + 1].start;
    discoverNow(s, "five-protections");
    return s;
  }
  // Draw the next event card.
  const e = drawEvent(s);
  if (e) {
    s.pendingEvent = { id: e.id, turn: s.turn };
    s.cooldowns[e.id] = s.turn;
    if (e.onFire) applyEffects(s, e.onFire, e.id);
    if (e.codex) discoverNow(s, e.codex);
  }
  return s;
}

function discoverNow(s: GameState, id: string) {
  if (!s.discovered.includes(id)) { s.discovered.push(id); s.newDiscoveries.push(id); }
}

function tutorialProgress(s: GameState): void {
  const t = s.tutorial;
  if (!t) return;
  const has = (c: string) => s.buildings.some((b) => BUILDINGS[b.type].rootCraft === c);
  if (!t.marketFormed && has("farming") && has("weaving") && has("building") && has("governance")) {
    t.marketFormed = true;
    s.institutions.marketSquares = true;
    s.chronicle.push({ turn: s.turn, year: s.year, key: "tutorial.market" });
    discoverNow(s, "markets-from-need");
  }
}

// ---------------------------------------------------------------- endings (§8)
export function ghostRatio(s: GameState, ghost?: { gdppc: [number, number][]; realWage: [number, number][] }): number | undefined {
  if (!ghost) return undefined;
  const last = s.history[s.history.length - 1];
  const at = (pts: [number, number][], y: number) => {
    let best = pts[0];
    for (const p of pts) if (Math.abs(p[0] - y) < Math.abs(best[0] - y)) best = p;
    return best?.[1];
  };
  const g = at(ghost.gdppc, last.year), w = at(ghost.realWage, last.year);
  if (!g || !w) return undefined;
  return (last.gdppc / g + last.realWage / w) / 2;
}

/** Endings are decided with the ghost data passed in by the caller (kept out of the core state). */
export let GHOST_FOR_ENDINGS: Partial<Record<ScenarioId, { gdppc: [number, number][]; realWage: [number, number][] }>> = {};
export function setGhostData(d: typeof GHOST_FOR_ENDINGS) { GHOST_FOR_ENDINGS = d; }

function endingFor(s: GameState) {
  const def = SCENARIOS[s.scenario];
  const o = s.meters.opulence.value >= def.targets.opulence;
  const m = s.meters.maslaha.value >= def.targets.maslaha;
  const ratio = ghostRatio(s, GHOST_FOR_ENDINGS[s.scenario]);
  if (ratio !== undefined && ratio >= 1.25) s.medal = true;
  if (o && m) return ratio === undefined || ratio >= 1 ? "golden" : "gilded";
  if (o) return "gilded";
  if (m) return "pious";
  return "decline";
}

function finish(s: GameState, ending: GameState["ending"], reason?: string): GameState {
  s.status = "ended";
  s.ending = ending;
  if (reason) s.collapseReason = reason;
  s.pendingEvent = null;
  return s;
}

// ---------------------------------------------------------------- reforms at each Reckoning (§2)
export const REFORMS: Record<string, { era: number[]; available: (s: GameState) => boolean }> = {
  openPorts: { era: [1, 2, 3, 4], available: (s) => !s.flags.openPorts },
  repealCornLaws: { era: [3, 4], available: (s) => s.policies.cornLaw },
  abolishTolls: { era: [1, 2, 3, 4], available: (s) => s.policies.internalTolls },
  canalMania: { era: [3], available: (s) => !s.institutions.canals },
  foundCentralBank: { era: [4], available: (s) => !s.institutions.centralBank },
  publicSchoolingAct: { era: [4], available: (s) => !s.institutions.publicSchooling },
  factoryReform: { era: [4], available: (s) => !s.institutions.factoryActs },
  debtConsolidation: { era: [2, 3, 4], available: (s) => s.debt > 0 && !s.flags.debtConsolidation },
  poorLawReform: { era: [2, 3, 4], available: (s) => !s.flags.poorLawReform },
  foundMint: { era: [1, 2], available: (s) => !s.institutions.coinage },
  marketInspectors: { era: [1, 2, 3], available: (s) => !s.institutions.hisba },
  repealTestActs: { era: [3, 4], available: (s) => s.policies.testActs },
};

function reformOptions(s: GameState): string[] {
  const next = SCENARIOS[s.scenario].chapters[s.chapter + 1];
  const rng = makeRng(s.seed * 7 + s.chapter);
  const pool = Object.entries(REFORMS).filter(([, r]) => r.era.includes(next.era) && r.available(s)).map(([id]) => id);
  const out: string[] = [];
  while (pool.length && out.length < 3) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  return out;
}

export function applyReform(s: GameState, id: string): void {
  s.reforms.push(id);
  const grant = (i: InstitutionId) => { s.institutions[i] = true; if (s.developing === i) { s.developing = null; s.progress = 0; } };
  switch (id) {
    case "openPorts": s.flags.openPorts = 1; s.policies.navigationActs = false; s.taxes.customs = Math.min(s.taxes.customs, 0.08); s.classes.merchants.satisfaction -= 6; s.classes.landlords.satisfaction -= 6; break;
    case "repealCornLaws": s.policies.cornLaw = false; s.flags.lock_cornLaw = 1; s.classes.landlords.satisfaction -= 18; s.classes.laborers.satisfaction += 8; break;
    case "abolishTolls": s.policies.internalTolls = false; s.flags.lock_internalTolls = 1; s.classes.landlords.satisfaction -= 6; break;
    case "canalMania": grant("canals"); s.treasury -= 0.3 * s.revenue; break;
    case "foundCentralBank": grant("centralBank"); s.money.trust = Math.min(100, s.money.trust + 5); break;
    case "publicSchoolingAct": grant("publicSchooling"); s.budget.education = Math.max(s.budget.education, 0.12); break;
    case "factoryReform": grant("factoryActs"); s.classes.merchants.satisfaction -= 8; s.classes.laborers.satisfaction += 6; break;
    case "debtConsolidation": s.flags.debtConsolidation = 1; s.money.trust = Math.min(100, s.money.trust + 4); break;
    case "poorLawReform": s.flags.poorLawReform = 1; s.budget.relief = Math.max(s.budget.relief, 0.08); break;
    case "foundMint": grant("coinage"); break;
    case "marketInspectors": grant("hisba"); break;
    case "repealTestActs": s.policies.testActs = false; s.flags.lock_testActs = 1; s.society.freedomOfWorship = 1; break;
  }
  if (s.treasury < 0) { s.debt -= s.treasury; s.treasury = 0; }
}

/** Reveal per-chapter era for UI code. */
export function eraOf(s: GameState): number { return currentEra(s); }

export function eventDef(id: string) { return EVENT_BY_ID.get(id); }

export const _internals = { closeYear, calibrate, indicators, record, BUDGET_LINES, neighbors, initBuilding, newMarket, sumRec };
