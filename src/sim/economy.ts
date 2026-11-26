// The market economy (GDD §4, §13). Mutates a working copy of the state; called from turn.ts.
import {
  BASKET, BUILDINGS, GOODS, GOOD_IDS, SIM,
  type GoodId, type ClassId,
} from "./defs.ts";
import { key } from "./hex.ts";
import { SCENARIOS } from "./scenarios.ts";
import { buildGraph, costsFrom, maxLevelFor, reachFrom, type Graph } from "./transport.ts";
import type { Building, GameState, TurnReport } from "./types.ts";

export const specMult = (s: number) => Math.pow(SIM.specBase, s - 1);
export const capacity = (level: number) => Math.round(SIM.maxWorkersPerLevel * level) + 2;

const PRODUCTION_ORDER: GoodId[] = ["grain", "wool", "timber", "ore", "bread", "cloth", "tools", "housing", "pins"];

/** Comfort and luxury spending shares by class (§4.6). Necessities are bought first. */
const SPEND: Record<ClassId, Partial<Record<GoodId, number>>> = {
  laborers: { pins: 0.28, cloth: 0.26, housing: 0.2, tools: 0.08, bread: 0.12, spices: 0.06 },
  merchants: { pins: 0.12, cloth: 0.2, housing: 0.25, tools: 0.08, spices: 0.35 },
  landlords: { pins: 0.08, cloth: 0.17, housing: 0.3, spices: 0.45 },
};
const SAVINGS: Record<ClassId, number> = { laborers: 0.04, merchants: 0.38, landlords: 0.1 };

export function landShare(b: Building): number {
  const def = BUILDINGS[b.type];
  if (!def.good) return 0;
  if (GOODS[def.good].land) return SIM.rentShare;
  return b.type === "builder" ? 0.25 : 0;
}

export function terrainMult(s: GameState, b: Building, tileIdx: Map<string, number>): number {
  const def = BUILDINGS[b.type];
  const t = s.tiles[tileIdx.get(key(b))!];
  return def.terrainBonus?.[t.terrain] ?? 1;
}

/** Real (base-wage) natural price of each good: labour + capital + land + inputs at normal rates (§4.4). */
export function realNaturalPrices(s: GameState): Record<GoodId, number> {
  // Natural price reflects what a worker *can* make at normal rates, not a slack turn's output.
  const prod: Partial<Record<GoodId, { out: number; workers: number }>> = {};
  for (const b of s.buildings) {
    const g = BUILDINGS[b.type].good;
    if (!g || b.workers <= 0.01 || !b.explain) continue;
    const e = b.explain;
    const p = (prod[g] ??= { out: 0, workers: 0 });
    p.out += b.workers * e.base * e.specMult * e.capitalMult * e.terrainMult * e.other;
    p.workers += b.workers;
  }
  const out = {} as Record<GoodId, number>;
  for (const g of PRODUCTION_ORDER) {
    const def = GOODS[g];
    const p = prod[g];
    const perWorker = p && p.workers > 0 && p.out > 0 ? p.out / p.workers : def.baseOutput;
    let inputs = 0;
    for (const [ig, q] of Object.entries(def.inputs) as [GoodId, number][]) inputs += q * (out[ig] ?? 1);
    // Value added at normal rates: wages are laborShare of it; rent and profit make up the rest
    // (the same split the income accounts use, so p = p* pays exactly the ordinary wage).
    const labour = 1 / Math.max(0.05, perWorker);
    out[g] = inputs + labour / SIM.laborShare;
  }
  out.spices = GOODS.spices.worldPrice;
  return out;
}

export interface EconomyCtx {
  graph: Graph;
  report: TurnReport;
  /** Investment funds available this turn (savings). */
  investFunds: number;
  realGdp: number;
}

// ---------------------------------------------------------------- reach & specialisation
export function updateReachAndLevels(s: GameState, graph: Graph, report: TurnReport): void {
  const def = SCENARIOS[s.scenario];
  for (const b of s.buildings) {
    if (!BUILDINGS[b.type].good) continue;
    const src = graph.index.get(key(b))!;
    const r = reachFrom(s, graph, costsFrom(graph, src));
    b.reach = r.reach;
    b.maxLevel = maxLevelFor(r.reach, def.r0);
    if (b.level > b.maxLevel) {
      b.level = b.maxLevel;
    } else if (b.level < b.maxLevel && b.workers >= SIM.workersPerLevel * b.level - 0.01) {
      // Guild rules slow the reorganisation of work: half the turns, nothing happens.
      if (!(s.policies.guildRules && (s.turn + b.q + b.r) % 2 === 0)) {
        report.levelUps.push({ id: b.id, from: b.level, to: b.level + 1 });
        b.level += 1;
      }
    }
  }
}

// ---------------------------------------------------------------- labour (the invisible hand, §13)
export function moveLabor(s: GameState): void {
  const pop = s.towns.reduce((a, t) => a + t.pop, 0);
  const workforce = pop * SIM.workforceShare;
  const producers = s.buildings.filter((b) => BUILDINGS[b.type].good);
  const civic = s.buildings.filter((b) => BUILDINGS[b.type].civic || b.type === "port");
  // Civic staff and dockworkers are a fixed small draw.
  const civicStaff = civic.length * 2;
  for (const b of civic) b.workers = 2;
  let employed = producers.reduce((a, b) => a + b.workers, 0);
  // If population fell, lay off proportionally.
  const room = Math.max(0, workforce - civicStaff);
  if (employed > room && employed > 0) {
    const f = room / employed;
    for (const b of producers) b.workers *= f;
    employed = room;
  }
  let pool = Math.max(0, room - employed);
  const sub = s.labor.subsistence;
  const avg = s.labor.avgWage || 1;
  let eta = SIM.eta * (0.6 + s.society.literacy);
  if (s.policies.guildRules) eta *= 0.4;
  let moved = 0;
  // Quits and layoffs: workers leave badly paying or loss-making shops.
  for (const b of producers) {
    const cap = capacity(b.level);
    let leave = 0;
    if (b.workers > cap) leave += b.workers - cap;
    if (b.wage < avg) leave += Math.min(b.workers, eta * b.workers * Math.min(1, (avg - b.wage) / avg));
    if (b.wage < sub) leave += 0.3 * b.workers;
    // Slack shops lay off: a trade running below capacity needs fewer hands (§13 labour moves).
    const g = BUILDINGS[b.type].good!;
    const util = s.goods[g].util ?? 1;
    if (util < 0.95) leave += 0.5 * (1 - util) * b.workers;
    leave = Math.min(leave, b.workers);
    b.workers -= leave;
    pool += leave;
    moved += leave;
  }
  // Hiring: the pool flows to shops in proportion to how far their wage exceeds subsistence.
  const weights = producers.map((b) => {
    const gap = capacity(b.level) - b.workers;
    if (gap <= 0) return 0;
    const attraction = Math.max(0.05, (b.wage || avg) - sub * 0.9);
    const fresh = s.turn - b.built < 2 ? 2 : 1; // new shops recruit eagerly
    return gap * attraction * fresh;
  });
  const totalW = weights.reduce((a, v) => a + v, 0);
  if (totalW > 0 && pool > 0) {
    const hires = Math.min(pool, producers.reduce((a, b) => a + Math.max(0, capacity(b.level) - b.workers), 0));
    producers.forEach((b, i) => {
      const h = Math.min((hires * weights[i]) / totalW, capacity(b.level) - b.workers);
      if (h > 0) {
        b.workers += h;
        pool -= h;
      }
    });
  }
  s.labor.workforce = workforce;
  s.labor.idle = Math.max(0, pool);
  s.labor.moved = moved;
  s.society.unemployment = workforce > 0 ? s.labor.idle / workforce : 0;
}

// ---------------------------------------------------------------- production
export function produce(s: GameState, tileIdx: Map<string, number>): Record<GoodId, number> {
  const inputUse = Object.fromEntries(GOOD_IDS.map((g) => [g, 0])) as Record<GoodId, number>;
  for (const g of GOOD_IDS) {
    s.goods[g].produced = 0;
    s.goods[g].imported = 0;
    s.goods[g].exported = 0;
    s.goods[g].shortage = 0;
  }
  const tech = s.society.technology;
  for (const g of PRODUCTION_ORDER) {
    const def = GOODS[g];
    const shops = s.buildings.filter((b) => BUILDINGS[b.type].good === g);
    if (!shops.length) continue;
    // Planned output before inputs.
    const planned = shops.map((b) => {
      if (b.workers <= 0.01) return 0;
      const K = Math.max(0, b.capital);
      const theta = SIM.theta * (b.level >= 4 ? 1.3 : 1);
      const capMult = Math.pow(1 + (theta * K) / b.workers, SIM.alpha);
      let other = tech * (s.institutions.factoryActs ? 0.96 : 1);
      if (g === "pins" && s.policies.pinMonopoly) other *= 0.7; // the monopolist restricts supply
      const tm = terrainMult(s, b, tileIdx);
      const y = b.workers * def.baseOutput * specMult(b.level) * capMult * tm * other;
      b.explain = { workers: b.workers, base: def.baseOutput, specMult: specMult(b.level), capitalMult: capMult, terrainMult: tm, inputFill: 1, other };
      return y;
    });
    // Producers read last turn's market (§4.4): a price at or above natural says "make more";
    // a price below natural with unsold stock piling up says "cut back". They adjust gradually.
    const gs0 = s.goods[g];
    const lastOfftake = gs0.demand + gs0.exported;
    let wantUtil = 1;
    if (lastOfftake > 0) {
      const cheap = Math.max(0, 0.95 - gs0.price / gs0.natural);
      const piled = Math.max(0, gs0.stock / lastOfftake - 0.3);
      wantUtil = Math.max(0.3, Math.min(1, 1 - 1.5 * cheap - 0.8 * piled));
    }
    gs0.util = (gs0.util ?? 1) + 0.35 * (wantUtil - (gs0.util ?? 1));
    const throttle = gs0.util;
    // Inputs from the pooled national market (stock + what was produced this turn).
    let fill = throttle;
    const needs = Object.entries(def.inputs) as [GoodId, number][];
    if (needs.length) {
      const totalPlanned = planned.reduce((a, v) => a + v, 0) * throttle;
      for (const [ig, q] of needs) {
        const coef = q * 0.97;
        const need = totalPlanned * coef;
        const gs = s.goods[ig];
        // Households also burn timber; reserve their share proportionally.
        const householdTimber = ig === "timber" ? (BASKET.timber ?? 0) * totalPop(s) : 0;
        const avail = gs.stock + gs.produced + gs.imported - inputUse[ig];
        const share = need > 0 ? need / (need + householdTimber) : 1;
        if (need > 0) fill = Math.min(fill, throttle * Math.max(0, (avail * share) / need));
      }
    }
    fill = Math.min(throttle, fill);
    shops.forEach((b, i) => {
      // Level 3+ shops waste less material: "no time lost passing from one work to another".
      const y = planned[i] * fill;
      b.output = y;
      b.inputFill = needs.length ? Math.min(1, fill / throttle) : 1;
      if (b.explain) b.explain.inputFill = b.inputFill;
      s.goods[g].produced += y;
      for (const [ig, q] of needs) {
        const coef = q * (b.level >= 3 ? 0.9 : 1);
        inputUse[ig] += y * coef;
      }
    });
  }
  return inputUse;
}

export function totalPop(s: GameState): number {
  return s.towns.reduce((a, t) => a + t.pop, 0);
}

// ---------------------------------------------------------------- trade through ports
export function tradeCapacity(s: GameState): number {
  const ports = s.buildings.filter((b) => b.type === "port").length;
  return ports * 14 * (s.institutions.merchantShipping ? 2 : 1) * (s.flags.openPorts ? 1.3 : 1);
}

/** World price in base units: a multiple of the base natural price (absolute for import-only goods). */
export function worldPrice(s: GameState, g: GoodId): number {
  const d = GOODS[g];
  return d.importOnly ? d.worldPrice : d.worldPrice * s.goods[g].basePrice;
}

function importDuty(s: GameState, g: GoodId): number {
  let d = s.taxes.customs;
  if (g === "grain" && s.policies.cornLaw) d += 0.6;
  if (s.policies.navigationActs) d += 0.1;
  return d;
}

export function trade(s: GameState, demand: Record<GoodId, number>): { importValue: number; exportValue: number; customs: number } {
  let cap = tradeCapacity(s);
  const res = { importValue: 0, exportValue: 0, customs: 0 };
  if (cap <= 0) return res;
  const level = s.money.priceLevel;
  const smuggled = Math.min(0.8, Math.max(0, (s.taxes.customs - 0.25) * 2));
  s.society.smuggling = smuggled;
  const foreignTariff = Math.min(0.5, s.taxes.customs * 0.6 + (s.policies.navigationActs ? 0.1 : 0)) * (s.flags.openPorts ? 0.5 : 1);
  const order = [...GOOD_IDS].sort((a, b) => Math.abs(s.goods[b].price / (worldPrice(s, b) * level) - 1) - Math.abs(s.goods[a].price / (worldPrice(s, a) * level) - 1));
  for (const g of order) {
    if (cap <= 0) break;
    const def = GOODS[g];
    if (g === "housing") continue;
    const gs = s.goods[g];
    const pw = worldPrice(s, g) * level;
    const supply = gs.stock + gs.produced;
    const landed = pw * (1.08 + importDuty(s, g));
    if (def.importOnly) {
      const q = Math.min(cap, demand[g]);
      if (q > 0) {
        gs.imported += q;
        cap -= q;
        res.importValue += q * pw;
        res.customs += q * pw * importDuty(s, g) * (1 - smuggled);
      }
      continue;
    }
    if (gs.price > landed) {
      const want = Math.max(0, demand[g] - supply) + 0.25 * supply * (gs.price / landed - 1);
      const q = Math.min(cap, want);
      if (q > 0.01) {
        gs.imported += q;
        cap -= q;
        res.importValue += q * pw;
        res.customs += q * pw * importDuty(s, g) * (1 - smuggled);
      }
    } else {
      const fob = pw * 0.92 * (1 - foreignTariff);
      if (gs.price < fob) {
        const q = Math.min(cap, supply * 0.5 * Math.min(1, fob / gs.price - 1) * 2);
        if (q > 0.01) {
          gs.exported += q;
          cap -= q;
          res.exportValue += q * fob;
        }
      }
    }
  }
  return res;
}

// ---------------------------------------------------------------- the whole market turn
export interface MarketResult {
  laborerIncome: number;
  merchantIncome: number;
  landlordIncome: number;
  wageBill: number;
  rents: number;
  profits: number;
  importValue: number;
  exportValue: number;
  customs: number;
  exciseNec: number;
  exciseLux: number;
  landTax: number;
  investment: number;
  realGdp: number;
  necessityFill: number;
  foodFill: number;
  housingFill: number;
}

export function runMarket(s: GameState, tileIdx: Map<string, number>, report: TurnReport): MarketResult {
  const pop = totalPop(s);
  const popBy: Record<ClassId, number> = { laborers: pop * 0.85, merchants: pop * 0.1, landlords: pop * 0.05 };
  const inputUse = produce(s, tileIdx);

  // Household demand from last turn's class incomes (one-turn lag keeps the model stable).
  const demand = Object.fromEntries(GOOD_IDS.map((g) => [g, inputUse[g]])) as Record<GoodId, number>;
  const hoardDrag = 1 - s.money.hoarding * 0.6; // hoarded coin buys nothing (§4.5)
  const inc = {
    laborers: s.classes.laborers.income * hoardDrag,
    merchants: s.classes.merchants.income * hoardDrag,
    landlords: s.classes.landlords.income * hoardDrag,
  };
  // Necessities in order of urgency (Ghazali's daruriyyat): bread, then fuel, cloth, shelter.
  // Each class buys what it can afford of what is actually on offer, and spends the rest later.
  const URGENCY: GoodId[] = ["bread", "timber", "cloth", "housing"];
  const necSpend: Record<ClassId, number> = { laborers: 0, merchants: 0, landlords: 0 };
  for (const c of ["laborers", "merchants", "landlords"] as ClassId[]) {
    let budget = inc[c] * (1 - SAVINGS[c]);
    for (const g of URGENCY) {
      const q = (BASKET[g] ?? 0) * popBy[c];
      const onOffer = s.goods[g].stock + s.goods[g].produced + 0.5 * (s.goods[g].demand > 0 ? s.goods[g].imported : 0);
      if (onOffer <= 0.01 && g !== "bread") continue; // nothing to buy: the money is not spent here
      const p = s.goods[g].price;
      const buy = Math.min(q, budget / Math.max(1e-6, p));
      demand[g] += buy;
      budget -= buy * p;
      necSpend[c] += buy * p;
    }
  }
  let investFunds = 0;
  for (const c of ["laborers", "merchants", "landlords"] as ClassId[]) {
    const disposable = Math.max(0, inc[c] * (1 - SAVINGS[c]) - necSpend[c]);
    investFunds += inc[c] * SAVINGS[c];
    for (const [g, share] of Object.entries(SPEND[c]) as [GoodId, number][]) {
      demand[g] += (disposable * share) / Math.max(1e-6, s.goods[g].price);
    }
  }
  // Finance paths change how much of savings becomes productive capital (§4.7).
  let investEff = 0.85;
  if (s.institutions.banks) investEff = 1.05 + Math.max(-0.4, s.society.credit);
  if (s.institutions.partnershipHouses) investEff = 0.9; // shared risk, slower growth (§4.7)
  if (s.money.trust < 50) investEff *= 0.7 + s.money.trust / 170;
  if (s.classes.merchants.satisfaction < 25) investEff *= 0.6; // capital flight
  // Capital widening vs deepening: when hands stand idle, part of savings founds new workshops
  // and companies (turnpikes, canals); the rest buys tools for existing shops.
  const idleShare = s.labor.workforce > 0 ? s.labor.idle / s.labor.workforce : 0;
  const widen = s.flags.burnIn ? 0 : Math.max(0.3, Math.min(0.7, 0.3 + idleShare * 6));
  // Founding workshops is spending too: builders' wages, timber and tools (no leak from the
  // circular flow). The capital formed accumulates until merchants place a new workshop.
  const widenFunds = investFunds * investEff * widen;
  s.flags.privatePool = Math.min((s.flags.privatePool ?? 0) + widenFunds, 400 * SCENARIOS[s.scenario].costScale);
  demand.timber += (0.35 * widenFunds) / Math.max(1e-6, s.goods.timber.price);
  demand.tools += (0.25 * widenFunds) / Math.max(1e-6, s.goods.tools.price);
  s.flags.constructionWages = 0.4 * widenFunds;
  const investQty = (investFunds * investEff * (1 - widen)) / Math.max(1e-6, s.goods.tools.price);
  demand.tools += investQty;

  // Public granary: buy grain cheap, release it dear (§4.8 fifth budget line).
  const relief = s.budget.relief * s.revenue;
  const bread = s.goods.bread;
  if (bread.price > bread.natural * 1.3 && s.society.granary > 0) {
    const release = Math.min(s.society.granary, s.society.granary * 0.5 + 1);
    s.goods.grain.stock += release;
    s.society.granary -= release;
  } else if (relief > 0 && s.goods.grain.price < s.goods.grain.natural * 1.05) {
    const buy = Math.min((relief * 0.4) / s.goods.grain.price, s.goods.grain.stock * 0.3);
    s.goods.grain.stock -= buy;
    s.society.granary += buy;
  }

  const t = trade(s, demand);

  // Clear markets, update prices with the §13 rule.
  const prevPrice = Object.fromEntries(GOOD_IDS.map((g) => [g, s.goods[g].price])) as Record<GoodId, number>;
  let necFill = 0, necW = 0, housingFill = 1, foodFill = 1;
  for (const g of GOOD_IDS) {
    const gs = s.goods[g];
    const supply = gs.stock + gs.produced + gs.imported - gs.exported;
    const used = inputUse[g];
    const finalSupply = Math.max(0, supply - used);
    const finalDemand = Math.max(0, demand[g] - used);
    gs.supply = supply;
    gs.demand = demand[g];
    let sold = Math.min(finalSupply, finalDemand);
    // Price cap on bread: the legal price stops rationing by price; queues and black markets follow.
    if (g === "bread" && s.policies.breadPriceCap && finalDemand > finalSupply) {
      gs.shortage = finalDemand - finalSupply;
      s.society.fraud = Math.min(1, s.society.fraud + 0.015 * Math.min(4, gs.shortage / Math.max(1, finalSupply)));
    }
    gs.sold = sold;
    const left = Math.max(0, finalSupply - sold);
    gs.stock = left * (1 - GOODS[g].spoil);
    if (BASKET[g]) {
      const need = (BASKET[g] ?? 0) * pop;
      const got = Math.min(1, sold / Math.max(1e-6, need));
      necFill += got * (BASKET[g] ?? 0);
      necW += BASKET[g] ?? 0;
      if (g === "housing") housingFill = got;
      if (g === "bread") foodFill = got;
    }
    // p_{t+1} = p_t (1 + λ (D−S)/S) + μ (p* − p_t). S is the quantity brought to market this
    // turn: new output and imports, plus the part of old stock that sellers release.
    // Only stock beyond a normal working inventory (a quarter of a turn's offtake) presses on
    // price; a depleted store makes sellers hold back and buyers bid up.
    const flow = gs.produced + gs.imported - gs.exported;
    const oldStock = supply - flow;
    const brought = flow + 0.3 * (oldStock - 0.25 * demand[g]);
    const S = Math.max(0.5, brought);
    const excess = Math.max(-0.9, Math.min(2.5, (demand[g] - brought) / S));
    let p = gs.price * (1 + SIM.lambda * excess) + SIM.mu * (gs.natural - gs.price);
    if (g === "bread" && s.policies.breadPriceCap) p = Math.min(p, gs.natural * 1.0);
    if (g === "pins" && s.policies.pinMonopoly) p = Math.max(p, gs.natural * 1.6);
    // With nothing at all on the market, a price is only a rumour: cap it.
    gs.price = Math.min(gs.natural * 4, Math.max(gs.natural * 0.2, p));
    if (gs.price > gs.natural * 1.4 && prevPrice[g] <= gs.natural * 1.4) report.priceSpikes.push(g);
  }

  // Incomes from this turn's sales (§4.6: wages, profit, rent).
  let wageBill = 0, rents = 0, profits = 0, realGdp = 0;
  for (const g of GOOD_IDS) realGdp += s.goods[g].produced * s.goods[g].basePrice;
  for (const g of GOOD_IDS) realGdp -= inputUse[g] * s.goods[g].basePrice;
  realGdp += s.goods.spices.sold * s.goods.spices.basePrice * 0.15; // distribution margin
  const producers = s.buildings.filter((b) => BUILDINGS[b.type].good);
  let wageW = 0, wageSum = 0;
  for (const b of producers) {
    const g = BUILDINGS[b.type].good!;
    const gs = s.goods[g];
    // Share of everything on offer that found a buyer (households, other workshops, or abroad).
    const sellShare = gs.supply > 0 ? Math.min(1, (gs.sold + inputUse[g] + gs.exported) / gs.supply) : 0;
    b.sold = sellShare;
    // Value added on what was produced (unsold output is inventory investment, still part of
    // GDP): wages are paid on it. Profits are on what actually sold, so a glut hits the masters.
    let inputCost = 0;
    for (const [ig, q] of Object.entries(GOODS[g].inputs) as [GoodId, number][]) inputCost += b.output * q * (b.level >= 3 ? 0.9 : 1) * prevPrice[ig];
    const vaProduced = b.output * prevPrice[g] - inputCost;
    const vaSold = b.output * sellShare * prevPrice[g] - inputCost;
    const rent = Math.max(0, vaProduced * landShare(b));
    const target = b.workers > 0.01 ? Math.max(0, (SIM.laborShare * vaProduced) / b.workers) : 0;
    b.wage = b.wage > 0 ? b.wage + 0.4 * (target - b.wage) : target; // wages are sticky
    const bill = b.wage * b.workers;
    b.profit = vaSold - rent - bill;
    wageBill += bill;
    rents += rent;
    profits += b.profit;
    if (b.workers > 0.01) { wageW += b.workers; wageSum += bill; }
  }
  s.labor.avgWage = wageW > 0 ? wageSum / wageW : s.labor.avgWage;
  // Trade margin accrues to merchants.
  const tradeMargin = (t.exportValue + t.importValue) * 0.08;

  // Taxes (§4.8).
  let exciseNec = 0, exciseLux = 0;
  for (const g of GOOD_IDS) {
    const val = s.goods[g].sold * s.goods[g].price;
    if (GOODS[g].need === "necessity") exciseNec += val * s.taxes.exciseNecessities;
    else if (GOODS[g].need) exciseLux += val * s.taxes.exciseLuxuries;
  }
  const landTax = rents * s.taxes.land;
  const idleIncome = s.labor.idle * s.labor.subsistence;
  // Last turn's public spending comes back as income: soldiers, clerks, teachers and contractors
  // are paid, relief reaches the poor, and bondholders collect their interest.
  const gov = s.flags.govSpend ?? 0, relief0 = s.flags.govRelief ?? 0, interest = s.flags.govInterest ?? 0;
  // Excise is passed on to buyers, and mostly falls on laborers who spend most on necessities.
  const laborerIncome = wageBill + idleIncome + gov * 0.7 + relief0 + (s.flags.constructionWages ?? 0) - exciseNec * 0.85 - exciseLux * 0.3;
  const merchantIncome = Math.max(0, profits) + tradeMargin + gov * 0.3 + interest * 0.6 - exciseLux * 0.35 - exciseNec * 0.1;
  const landlordIncome = rents - landTax + interest * 0.4 - exciseLux * 0.35 - exciseNec * 0.05;
  s.classes.laborers.income = Math.max(0.1, laborerIncome);
  s.classes.merchants.income = Math.max(0.1, merchantIncome);
  s.classes.landlords.income = Math.max(0.1, landlordIncome);

  // Capital accumulation: K_{t+1} = (1−δ)K_t + investment, allocated to the best profit rates.
  // Investors get the same fill ratio as every other final buyer of tools.
  const toolsFinal = demand.tools - inputUse.tools;
  const investShare = toolsFinal > 0 ? Math.min(1, s.goods.tools.sold / toolsFinal) : 0;
  const invested = investQty * investShare;
  const weights = producers.map((b) => Math.max(0, b.profit) / Math.max(1, b.capital + 2) + 0.02 * b.workers);
  const tw = weights.reduce((a, v) => a + v, 0);
  for (let i = 0; i < producers.length; i++) {
    const b = producers[i];
    b.capital = (1 - SIM.delta) * b.capital + (tw > 0 ? (invested * weights[i]) / tw : 0);
    if (s.classes.merchants.satisfaction < 25) b.capital *= 0.99;
  }
  return {
    laborerIncome, merchantIncome, landlordIncome, wageBill, rents, profits,
    importValue: t.importValue, exportValue: t.exportValue, customs: t.customs,
    exciseNec, exciseLux, landTax, investment: invested, realGdp,
    necessityFill: necW > 0 ? necFill / necW : 1, foodFill, housingFill,
  };
}

/** Recompute natural prices: real natural price × price level (§4.4, §4.5). */
export function updateNaturalPrices(s: GameState): void {
  // "The ordinary or average rate of wages" (Book I, ch. 7): natural prices are costed at the
  // prevailing wage, smoothed so a sudden inflation shows up first as prices above natural.
  // Half anchored to the coin itself (a silver standard has a nominal anchor), half to wages.
  const anchor = 0.5 * (s.labor.avgWage || 1) + 0.5 * s.money.priceLevel;
  s.labor.refWage = 0.85 * (s.labor.refWage || 1) + 0.15 * anchor;
  const real = realNaturalPrices(s);
  for (const g of GOOD_IDS) s.goods[g].natural = real[g] * (s.labor.refWage || 1);
  // Import-only goods are priced abroad: their natural price moves with the exchange (price level).
  s.goods.spices.natural = real.spices * s.money.priceLevel;
}

export function makeGraph(s: GameState): Graph {
  return buildGraph(s);
}
