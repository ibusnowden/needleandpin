// Real-time logistics (pausable real time, GDD §14 open question → resolved as "pausable real
// time"). The economy runs day by day on the map: workshops fill input stores and produce into an
// output store; carts, barges, trains and ships carry every unit along the road network to town
// markets and storehouses (Ghazali, Ihya' 3:227) and on to the workshops that need it. Roads have a
// daily capacity, so traffic queues where the network is too thin: bottlenecks you can see.
//
// Each day: produce → ship output → order inputs → merchants and imports → move carts → households
// buy → prices adjust. Each month: wages and accounts, labour moves, natural prices, demand.
// The yearly close (taxes, society, meters, events) lives in turn.ts and reads `s.acc`.
import {
  BASKET, BUILDINGS, CARRY_COST, CLASS_IDS, DAYS_PER_YEAR, GOODS, GOOD_IDS, HEX_CAPACITY, SIM, STOREHOUSE_BUY, TOOL_WEAR,
  type ClassId, type GoodId,
} from "./defs.ts";
import { PRODUCTION_ORDER, capacity, landShare, realNaturalPrices, specMult, totalPop, updateReachAndLevels, worldPrice } from "./economy.ts";
import { key } from "./hex.ts";
import { streamRng } from "./rng.ts";
import { buildGraph, type Graph } from "./transport.ts";
import type { Building, Cart, GameState, Market, YearAcc } from "./types.ts";

const D = DAYS_PER_YEAR;
const zero = () => Object.fromEntries(GOOD_IDS.map((g) => [g, 0])) as Record<GoodId, number>;

export function emptyAcc(): YearAcc {
  return {
    produced: zero(), inputsUsed: zero(), hhBought: zero(), hhSpend: zero(), imported: zero(), exported: zero(),
    importValue: 0, exportValue: 0, customs: 0, wages: 0, rents: 0, profits: 0, carriers: 0, merchantMargin: 0,
    necNeed: 0, necGot: 0, foodNeed: 0, foodGot: 0, housingNeed: 0, housingGot: 0, invested: 0, capacity: zero(),
    exciseNec: 0, exciseLux: 0, landTax: 0,
  };
}

// ---------------------------------------------------------------- network context (not serialised)
interface Ctx {
  version: string;
  g: Graph;
  cap: Float64Array;
  /** Shortest-path trees per source tile: dist + predecessor. */
  trees: Map<number, { dist: Float64Array; prev: Int32Array }>;
  edgeSea: number[];
  marketTile: Map<string, number>;
}
let CTX: Ctx | null = null;

export function ctxFor(s: GameState): Ctx {
  const version = `${s.seed}|${s.scenario}|${s.netVersion}|${s.towns.length}|${s.buildings.length}|${s.policies.internalTolls ? 1 : 0}|${s.institutions.merchantShipping ? 1 : 0}|${Math.round(s.society.banditry * 20)}`;
  if (CTX && CTX.version === version) return CTX;
  const g = buildGraph(s);
  const cap = new Float64Array(g.n);
  const special = new Set<string>([...s.towns.map((t) => key(t)), ...s.buildings.map((b) => key(b))]);
  for (let i = 0; i < g.n; i++) {
    const t = s.tiles[i];
    const k = key(t);
    const inf = s.infra[k];
    cap[i] = t.terrain === "sea" || special.has(k) ? HEX_CAPACITY.free
      : inf === "rail" ? HEX_CAPACITY.rail : inf === "canal" ? HEX_CAPACITY.canal : inf === "road" ? HEX_CAPACITY.road
      : t.river ? HEX_CAPACITY.river : HEX_CAPACITY.land;
  }
  // Sea tiles on the edge of the map: where ships come from and go to.
  const edgeSea: number[] = [];
  for (let i = 0; i < g.n; i++) {
    if (!g.isSea[i]) continue;
    let n = 0;
    for (let d = 0; d < 6; d++) if (g.nbrs[i * 6 + d] >= 0) n++;
    if (n < 6) edgeSea.push(i);
  }
  const marketTile = new Map(s.towns.map((t) => [t.id, g.index.get(key(t))!]));
  CTX = { version, g, cap, trees: new Map(), edgeSea, marketTile };
  return CTX;
}

function tree(ctx: Ctx, src: number) {
  let t = ctx.trees.get(src);
  if (t) return t;
  const g = ctx.g;
  const dist = new Float64Array(g.n).fill(Infinity);
  const prev = new Int32Array(g.n).fill(-1);
  // True binary min-heap (parallel arrays keep hot Dijkstra allocations small).
  const hn: number[] = [src];
  const hd: number[] = [0];
  const push = (node: number, d: number) => {
    hn.push(node); hd.push(d);
    let i = hn.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hd[p] <= hd[i]) break;
      [hn[p], hn[i]] = [hn[i], hn[p]];
      [hd[p], hd[i]] = [hd[i], hd[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top: [number, number] = [hd[0], hn[0]];
    const ln = hn.pop()!, ld = hd.pop()!;
    if (hn.length) {
      hn[0] = ln; hd[0] = ld;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < hn.length && hd[l] < hd[m]) m = l;
        if (r < hn.length && hd[r] < hd[m]) m = r;
        if (m === i) break;
        [hn[m], hn[i]] = [hn[i], hn[m]];
        [hd[m], hd[i]] = [hd[i], hd[m]];
        i = m;
      }
    }
    return top;
  };
  dist[src] = 0;
  while (hn.length) {
    const [du, u] = pop();
    if (du > dist[u]) continue;
    for (let d = 0; d < 6; d++) {
      const v = g.nbrs[u * 6 + d];
      if (v < 0) continue;
      if (g.isSea[v] && !g.isSea[u] && !g.isPort[u]) continue;
      if (!g.isSea[v] && g.isSea[u] && !g.isPort[v]) continue;
      const nd = du + g.enter[v];
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push(v, nd); }
    }
  }
  t = { dist, prev };
  ctx.trees.set(src, t);
  return t;
}

function pathTo(ctx: Ctx, from: number, to: number): number[] {
  const { prev, dist } = tree(ctx, from);
  if (!Number.isFinite(dist[to])) return [];
  const out: number[] = [];
  for (let v = to; v >= 0; v = prev[v]) out.unshift(v);
  return out;
}

const days = (ctx: Ctx, from: number, to: number) => tree(ctx, from).dist[to];

/** Cheapest sea-edge tile reachable from a tile (through a port), with its distance. */
function nearestAbroad(ctx: Ctx, from: number): { tile: number; days: number } | null {
  const { dist } = tree(ctx, from);
  let best = -1, bd = Infinity;
  for (const e of ctx.edgeSea) if (dist[e] < bd) { bd = dist[e]; best = e; }
  return best >= 0 ? { tile: best, days: bd } : null;
}

// ---------------------------------------------------------------- setup
export function initMarkets(s: GameState): void {
  const pop = totalPop(s);
  s.markets = s.towns.map((t) => newMarket(s, t.id, t.pop / Math.max(1, pop)));
  s.carts = [];
  s.entries = new Array(s.tiles.length).fill(0);
  s.flow = new Array(s.tiles.length).fill(0);
  s.jam = new Array(s.tiles.length).fill(0);
  s.acc = emptyAcc();
  s.mInc = { laborers: 0, merchants: 0, landlords: 0 };
  for (const b of s.buildings) initBuilding(b);
}

export function newMarket(s: GameState, town: string, share: number): Market {
  const stock = zero(), price = zero();
  const pop = totalPop(s);
  for (const g of GOOD_IDS) {
    price[g] = s.goods[g].price;
    stock[g] = (BASKET[g] ?? 0.05) * pop * share * 0.15;
  }
  return { town, stock, price, want: zero(), draw: zero(), short: zero() };
}

export function initBuilding(b: Building): void {
  b.inBuf ??= {};
  b.incoming ??= {};
  b.outBuf ??= 0;
  b.status ??= BUILDINGS[b.type].good ? "idle" : "civic";
  b.cycle ??= 0;
  b.mRev ??= 0;
  b.mCost ??= 0;
}

// ---------------------------------------------------------------- production
/** Annual output rate at full inputs (the §13 production function). */
export function yearRate(s: GameState, b: Building): number {
  const def = BUILDINGS[b.type];
  if (!def.good || b.workers <= 0.01) return 0;
  const g = def.good;
  const K = Math.max(0, b.capital);
  const theta = SIM.theta * (b.level >= 4 ? 1.3 : 1);
  const capMult = Math.pow(1 + (theta * K) / b.workers, SIM.alpha);
  const t = s.tiles.find((x) => x.q === b.q && x.r === b.r)!;
  const terrainMult = def.terrainBonus?.[t.terrain] ?? 1;
  let other = s.society.technology * (s.institutions.factoryActs ? 0.96 : 1);
  if (g === "pins" && s.policies.pinMonopoly) other *= 0.7;
  // Ricardo's diminishing returns: more people on the same land means poorer land brought in.
  if (GOODS[g].land && g !== "ore") other *= Math.pow(Math.max(0.5, landPressure(s)), -0.3);
  const rate = b.workers * GOODS[g].baseOutput * specMult(b.level, g) * capMult * terrainMult * other;
  b.explain = { workers: b.workers, base: GOODS[g].baseOutput, specMult: specMult(b.level, g), capitalMult: capMult, terrainMult, inputFill: 1, other };
  return rate;
}

/** Population relative to the scenario's start: the pressure on land (1 at start). */
export function landPressure(s: GameState): number {
  const p0 = s.flags.pop0 || totalPop(s);
  return totalPop(s) / p0;
}

const usesTools = (b: Building) => !!BUILDINGS[b.type].good && GOODS[BUILDINGS[b.type].good!].land;

/** What a workshop needs per unit of output (inputs) and per day (tool wear). */
function needs(b: Building): [GoodId, number][] {
  const g = BUILDINGS[b.type].good!;
  return (Object.entries(GOODS[g].inputs) as [GoodId, number][]).map(([ig, q]) => [ig, q * (b.level >= 3 ? 0.9 : 1)]);
}

function produce(s: GameState): void {
  for (const b of s.buildings) {
    const def = BUILDINGS[b.type];
    if (!def.good) { b.status = "civic"; continue; }
    const g = def.good;
    const full = yearRate(s, b) / D;
    if (full <= 0) { b.status = "idle"; continue; }
    let fill = 1;
    b.missing = undefined;
    for (const [ig, q] of needs(b)) {
      const f = (b.inBuf[ig] ?? 0) / (full * q);
      if (f < fill) { fill = f; b.missing = ig; }
    }
    let toolMult = 1;
    if (usesTools(b)) {
      const wear = (TOOL_WEAR * b.workers) / D;
      if ((b.inBuf.tools ?? 0) >= wear) b.inBuf.tools! -= wear;
      else { toolMult = 0.6; b.missing ??= "tools"; }
    }
    const outCap = Math.max(3, full * 25);
    if (b.outBuf >= outCap) { b.status = "blocked"; continue; }
    const q = full * Math.max(0, Math.min(1, fill)) * toolMult;
    for (const [ig, c] of needs(b)) {
      b.inBuf[ig] = Math.max(0, (b.inBuf[ig] ?? 0) - q * c);
      s.acc.inputsUsed[ig] += q * c;
      stat(s).used[ig] += q * c;
    }
    b.outBuf += q;
    b.output = q * D;
    b.inputFill = full > 0 ? q / full : 0;
    if (b.explain) b.explain.inputFill = b.inputFill;
    s.acc.produced[g] += q;
    stat(s).made[g] += q;
    s.acc.capacity[g] += full;
    b.cycle = (b.cycle + (q / Math.max(1e-6, full)) * 0.25) % 1;
    b.status = fill < 0.5 ? "starved" : toolMult < 1 && fill >= 0.5 ? "starved" : "working";
    if (b.status === "working") b.missing = undefined;
  }
}

// ---------------------------------------------------------------- carts
function spawn(s: GameState, c: Omit<Cart, "id" | "seg" | "acc" | "waited">): void {
  if (c.path.length < 2) {
    // Already there: deliver at once.
    deliver(s, { ...c, id: -1, seg: c.path.length - 1, acc: 0, waited: 0 });
    return;
  }
  s.carts.push({ ...c, id: s.nextCart++, seg: 0, acc: 0, waited: 0 });
}

function marketOf(s: GameState, townId: string) {
  return s.markets.find((m) => m.town === townId);
}

function foreignTariff(s: GameState): number {
  return Math.min(0.5, s.taxes.customs * 0.6 + (s.policies.navigationActs ? 0.1 : 0)) * (s.flags.openPorts ? 0.5 : 1);
}

function importDuty(s: GameState, g: GoodId): number {
  let d = s.taxes.customs;
  if (g === "grain" && s.policies.cornLaw) d += 0.6;
  if (s.policies.navigationActs) d += 0.1;
  return d;
}

const carry = (s: GameState) => CARRY_COST * (s.labor.refWage || 1);

/** Ports' yearly throughput (ships), shared by imports and exports. */
export function tradeCapacity(s: GameState): number {
  const ports = s.buildings.filter((b) => b.type === "port").length;
  return ports * 40 * (s.institutions.merchantShipping ? 2 : 1) * (s.flags.openPorts ? 1.3 : 1) * (s.flags.foreignMult || 1);
}

/** Workshops send finished goods to the market that pays best after carriage (or abroad). */
function shipOutputs(s: GameState, ctx: Ctx): void {
  const c = carry(s);
  const tradeLeft = tradeCapacity(s) - sumRec(s.acc.imported) - sumRec(s.acc.exported);
  for (const b of s.buildings) {
    const g = BUILDINGS[b.type].good;
    if (!g || b.outBuf < 1) continue;
    const from = ctx.g.index.get(key(b))!;
    let sent = 0;
    while (b.outBuf >= 1 && sent < 6) {
      let best: { dest: string; to: number; value: number } | null = null;
      for (const m of s.markets) {
        const to = ctx.marketTile.get(m.town)!;
        const d = days(ctx, from, to);
        if (!Number.isFinite(d)) continue;
        const v = m.price[g] * STOREHOUSE_BUY - c * d;
        if (!best || v > best.value) best = { dest: `m:${m.town}`, to, value: v };
      }
      if (tradeLeft - sent > 0 && g !== "housing") {
        const ab = nearestAbroad(ctx, from);
        if (ab) {
          const v = worldPrice(s, g) * s.money.priceLevel * (1 - foreignTariff(s)) - c * ab.days;
          if (!best || v > best.value * 1.05) best = { dest: "abroad", to: ab.tile, value: v };
        }
      }
      if (!best || best.value <= (s.goods[g].anchor ?? s.goods[g].natural) * 0.12) { b.status = b.status === "working" ? "blocked" : b.status; break; }
      b.outBuf -= 1;
      spawn(s, { good: g, qty: 1, kind: best.dest === "abroad" ? "export" : "goods", path: pathTo(ctx, from, best.to), dest: best.dest, from: b.id, paid: 0 });
      sent++;
    }
  }
}

/** Workshops order inputs (and tools) from the market that sells cheapest after carriage. */
function orderInputs(s: GameState, ctx: Ctx): void {
  const c = carry(s);
  for (const b of s.buildings) {
    if (!BUILDINGS[b.type].good || b.workers <= 0.01) continue;
    const full = yearRate(s, b) / D;
    const list: [GoodId, number][] = needs(b).map(([ig, q]) => [ig, full * q]);
    if (usesTools(b)) list.push(["tools", (TOOL_WEAR * b.workers) / D]);
    const to = ctx.g.index.get(key(b))!;
    for (const [ig, perDay] of list) {
      const target = Math.max(1.2, perDay * 25);
      let have = (b.inBuf[ig] ?? 0) + (b.incoming[ig] ?? 0);
      let orders = 0;
      while (have < target && orders < 5) {
        let best: { m: Market; from: number; cost: number } | null = null;
        for (const m of s.markets) {
          if (m.stock[ig] < 1) continue;
          const from = ctx.marketTile.get(m.town)!;
          const d = days(ctx, from, to);
          if (!Number.isFinite(d)) continue;
          const cost = m.price[ig] + c * d;
          if (!best || cost < best.cost) best = { m, from, cost };
        }
        if (!best) {
          // Unmet: register the want so the nearest market's price rises.
          const near = s.markets[0];
          if (near) near.short[ig] += 0.02;
          break;
        }
        best.m.stock[ig] -= 1;
        best.m.draw[ig] += 0.05;
        const price = best.m.price[ig];
        b.mCost += price;
        s.acc.merchantMargin += price; // storehouse sale (its purchase is netted on delivery)
        b.incoming[ig] = (b.incoming[ig] ?? 0) + 1;
        spawn(s, { good: ig, qty: 1, kind: "supply", path: pathTo(ctx, best.from, to), dest: `b:${b.id}`, paid: price });
        have += 1;
        orders++;
      }
    }
  }
}

/** Merchants carry goods from cheap markets to dear ones when the difference pays the journey. */
function merchants(s: GameState, ctx: Ctx): void {
  if (s.markets.length < 2) return;
  const c = carry(s);
  const rng = streamRng(s.seed, s.turn * D + s.day, "merchants");
  for (const g of GOOD_IDS) {
    if (g === "housing") continue;
    const ms = [...s.markets].filter((m) => m.stock[g] >= 3);
    if (!ms.length) continue;
    for (let k = 0; k < 5; k++) {
      const a = rng.pick(ms);
      let best: { m: Market; to: number; gain: number } | null = null;
      const from = ctx.marketTile.get(a.town)!;
      for (const m of s.markets) {
        if (m === a) continue;
        const to = ctx.marketTile.get(m.town)!;
        const d = days(ctx, from, to);
        if (!Number.isFinite(d)) continue;
        const gain = m.price[g] * STOREHOUSE_BUY - a.price[g] - c * d;
        if (gain > (s.goods[g].anchor ?? s.goods[g].natural) * 0.06 && (!best || gain > best.gain)) best = { m, to, gain };
      }
      if (!best) continue;
      // Wider gaps justify bigger lots.
      const qty = Math.max(1, Math.min(Math.floor(a.stock[g] / 3), Math.round(best.gain / Math.max(1e-6, (s.goods[g].anchor ?? s.goods[g].natural) * 0.1))));
      a.stock[g] -= qty;
      a.draw[g] += 0.05 * qty;
      s.acc.merchantMargin += a.price[g] * qty;
      spawn(s, { good: g, qty, kind: "merchant", path: pathTo(ctx, from, best.to), dest: `m:${best.m.town}`, paid: a.price[g] * qty });
    }
  }
}

/** Dear markets with a port in reach send for imports (spices only ever come by sea). */
function imports(s: GameState, ctx: Ctx): void {
  let left = tradeCapacity(s) - sumRec(s.acc.imported) - sumRec(s.acc.exported);
  if (left <= 0) return;
  const c = carry(s);
  const smuggled = Math.min(0.8, Math.max(0, (s.taxes.customs - 0.25) * 2));
  s.society.smuggling = smuggled;
  for (const m of s.markets) {
    const to = ctx.marketTile.get(m.town)!;
    const ab = nearestAbroad(ctx, to);
    if (!ab) continue;
    for (const g of GOOD_IDS) {
      if (g === "housing" || left <= 0) continue;
      const pw = worldPrice(s, g) * s.money.priceLevel;
      const landed = pw * (1 + importDuty(s, g)) + c * ab.days;
      const cover = m.stock[g] / Math.max(0.01, (m.want[g] + m.draw[g]) * 20);
      if (m.price[g] < landed * 1.05 || cover > 1) continue;
      const n = Math.min(3, Math.ceil(left));
      for (let k = 0; k < n; k++) {
        s.acc.imported[g] += 1;
        s.acc.importValue += pw;
        s.acc.customs += pw * importDuty(s, g) * (1 - smuggled);
        s.acc.merchantMargin -= landed;
        spawn(s, { good: g, qty: 1, kind: "import", path: pathTo(ctx, ab.tile, to), dest: `m:${m.town}`, paid: landed });
        left--;
      }
    }
  }
}

function deliver(s: GameState, c: Cart): void {
  const tripDays = c.path.length;
  const carriers = carry(s) * tripDays * c.qty * 0.6;
  s.acc.carriers += carriers;
  s.mInc.laborers += carriers;
  // Carriage per unit, by good and direction (part of the cost of bringing goods to market).
  if (c.qty > 0 && c.kind !== "merchant") {
    const gs = s.goods[c.good];
    const k = c.dest.startsWith("b:") ? "carryIn" : "carryOut";
    gs[k] = (gs[k] ?? 0) + 0.05 * (carriers / c.qty - (gs[k] ?? 0));
  }
  if (c.dest.startsWith("b:")) {
    const b = s.buildings.find((x) => x.id === c.dest.slice(2));
    if (b) {
      b.inBuf[c.good] = (b.inBuf[c.good] ?? 0) + c.qty;
      b.incoming[c.good] = Math.max(0, (b.incoming[c.good] ?? 0) - c.qty);
      b.mCost += carriers;
      return;
    }
    // The workshop is gone: the goods go to the first market.
    c.dest = `m:${s.markets[0]?.town}`;
  }
  if (c.dest === "abroad") {
    const pw = worldPrice(s, c.good) * s.money.priceLevel * (1 - foreignTariff(s));
    s.acc.exported[c.good] += c.qty;
    s.acc.exportValue += pw * c.qty;
    const b = s.buildings.find((x) => x.id === c.from);
    if (b) b.mRev += pw * c.qty - carriers;
    return;
  }
  const m = marketOf(s, c.dest.slice(2)) ?? s.markets[0];
  if (!m) return;
  m.stock[c.good] += c.qty;
  const buy = m.price[c.good] * STOREHOUSE_BUY * c.qty;
  if (c.kind === "goods") {
    const b = s.buildings.find((x) => x.id === c.from);
    if (b) b.mRev += buy - carriers;
    s.acc.merchantMargin -= buy;
  } else if (c.kind === "merchant") {
    // The merchant sells into the storehouse: his gain is the price difference less carriage.
    s.acc.merchantMargin -= buy;
    s.mInc.merchants += buy - c.paid - carriers;
    return;
  }
}

function moveCarts(s: GameState, ctx: Ctx): void {
  const ent = s.entries;
  ent.fill(0);
  const keep: Cart[] = [];
  for (const c of s.carts) {
    c.acc += 1;
    let blocked = false;
    while (c.seg < c.path.length - 1) {
      const nxt = c.path[c.seg + 1];
      const cost = ctx.g.enter[nxt] ?? 1;
      if (c.acc < cost) break;
      if (ent[nxt] >= ctx.cap[nxt]) { blocked = true; break; }
      ent[nxt]++;
      c.acc -= cost;
      c.seg++;
    }
    if (blocked) {
      c.waited++;
      const here = c.path[c.seg + 1];
      s.jam[here] += 1;
      c.acc = Math.min(c.acc, (ctx.g.enter[here] ?? 1) * 1.01);
    }
    if (c.seg >= c.path.length - 1) deliver(s, c);
    else keep.push(c);
  }
  s.carts = keep;
  for (let i = 0; i < ent.length; i++) {
    s.flow[i] += (ent[i] - s.flow[i]) * 0.1;
    s.jam[i] *= 0.9;
  }
}

// ---------------------------------------------------------------- households and prices
function consume(s: GameState): void {
  const pop = totalPop(s);
  for (const m of s.markets) {
    const town = s.towns.find((t) => t.id === m.town);
    const share = town ? town.pop / Math.max(1, pop) : 0;
    for (const g of GOOD_IDS) {
      const want = m.want[g];
      const got = Math.min(m.stock[g], want);
      m.stock[g] -= got;
      stat(s).used[g] += got;
      m.draw[g] += (want - m.draw[g]) * 0.05;
      m.short[g] = m.short[g] * 0.95 + (want - got) * 0.05;
      if (g === "tools" && s.flags.investToolsDay) {
        // Investors' share of tool purchases becomes capital at month end.
        const inv = Math.min(got, (s.flags.investToolsDay ?? 0) * share);
        s.flags.toolCapital = (s.flags.toolCapital ?? 0) + inv;
        s.acc.invested += inv;
        s.acc.hhBought[g] += got - inv;
      } else s.acc.hhBought[g] += got;
      const value = got * m.price[g];
      s.acc.hhSpend[g] += value;
      s.acc.merchantMargin += value;
      // Excise: collected on sales, paid out of buyers' incomes (85% of necessity excise by laborers).
      if (GOODS[g].need === "necessity") {
        const t = value * s.taxes.exciseNecessities;
        s.acc.exciseNec += t; s.mInc.laborers -= t * 0.85; s.mInc.merchants -= t * 0.1; s.mInc.landlords -= t * 0.05;
      } else if (GOODS[g].need) {
        const t = value * s.taxes.exciseLuxuries;
        s.acc.exciseLux += t; s.mInc.laborers -= t * 0.3; s.mInc.merchants -= t * 0.35; s.mInc.landlords -= t * 0.35;
      }
      const nec = (BASKET[g] ?? 0) * (town?.pop ?? 0) / D;
      if (nec > 0) {
        s.acc.necNeed += nec * (BASKET[g] ?? 0);
        s.acc.necGot += Math.min(nec, got) * (BASKET[g] ?? 0);
        if (g === "bread") { s.acc.foodNeed += nec; s.acc.foodGot += Math.min(nec, got); }
        if (g === "housing") { s.acc.housingNeed += nec; s.acc.housingGot += Math.min(nec, got); }
      }
      // Stock spoils.
      m.stock[g] *= Math.pow(1 - GOODS[g].spoil, 1 / D);
    }
  }
}

/** Smith's market price around the natural price, set by each storehouse's stock against its trade. */
function prices(s: GameState): void {
  for (const m of s.markets) {
    for (const g of GOOD_IDS) {
      const nat = s.goods[g].anchor ?? s.goods[g].natural;
      const rate = Math.max(0.02, m.want[g] + m.draw[g] * 0.5 + m.short[g]);
      const cover = m.stock[g] / (rate * 20);
      let target = nat * Math.min(3.5, Math.max(0.4, Math.pow(Math.max(0.01, cover), -0.45)));
      // Laws act on Smith's natural price: a cap at the cost of bread, a monopoly charging well above the cost of pins.
      if (g === "bread" && s.policies.breadPriceCap) target = Math.min(target, s.goods.bread.natural);
      if (g === "pins" && s.policies.pinMonopoly) target = Math.max(target, s.goods.pins.natural * 1.6);
      // Low gain: a high gain makes prices oscillate in boom-bust cycles that players read as random.
      m.price[g] += (target - m.price[g]) * 0.035;
      // A legal price cap is a ceiling, not a tendency.
      if (g === "bread" && s.policies.breadPriceCap) m.price[g] = Math.min(m.price[g], s.goods.bread.natural);
    }
  }
}

// ---------------------------------------------------------------- monthly settlement
const SPEND: Record<ClassId, Partial<Record<GoodId, number>>> = {
  laborers: { pins: 0.28, cloth: 0.26, housing: 0.2, tools: 0.08, bread: 0.12, spices: 0.06 },
  merchants: { pins: 0.12, cloth: 0.2, housing: 0.25, tools: 0.08, spices: 0.35 },
  landlords: { pins: 0.08, cloth: 0.17, housing: 0.3, spices: 0.45 },
};
export const SAVINGS: Record<ClassId, number> = { laborers: 0.04, merchants: 0.38, landlords: 0.1 };
const URGENCY: GoodId[] = ["bread", "timber", "cloth", "housing"];

function month(s: GameState, ctx: Ctx): void {
  // Accounts: wages are laborShare of value added, sticky; rent to landlords; the rest is profit.
  let wageW = 0, wageSum = 0;
  for (const b of s.buildings) {
    const def = BUILDINGS[b.type];
    if (!def.good) continue;
    const va = b.mRev - b.mCost;
    const rent = Math.max(0, va * landShare(b, landPressure(s)));
    const target = b.workers > 0.01 ? Math.max(0, (SIM.laborShare * va * 12) / b.workers) : 0;
    b.wage = b.wage > 0 ? b.wage + 0.25 * (target - b.wage) : target;
    const bill = (b.wage * b.workers) / 12;
    b.profit = (va - rent - bill) * 12;
    s.acc.wages += bill; s.acc.rents += rent; s.acc.profits += va - rent - bill;
    s.mInc.laborers += bill;
    const lt = rent * s.taxes.land;
    s.acc.landTax += lt;
    s.mInc.landlords += rent - lt;
    s.mInc.merchants += Math.max(0, va - rent - bill);
    if (b.workers > 0.01) { wageW += b.workers; wageSum += b.wage * b.workers; }
    b.mRev = 0; b.mCost = 0;
  }
  if (wageW > 0) s.labor.avgWage = wageSum / wageW;
  // Merchants' storehouse margin, settled monthly.
  s.mInc.merchants += Math.max(0, s.acc.merchantMargin - (s.flags.mmSettled ?? 0));
  s.flags.mmSettled = s.acc.merchantMargin;
  // Public spending, interest and relief come back as income (see society.runTreasury).
  const gov = (s.flags.govSpend ?? 0) / 12, relief = (s.flags.govRelief ?? 0) / 12, interest = (s.flags.govInterest ?? 0) / 12;
  const idle = (s.labor.idle * s.labor.subsistence) / 12;
  const inc = {
    laborers: s.mInc.laborers + gov * 0.7 + relief + idle + (s.flags.constructionWages ?? 0) / 12,
    merchants: s.mInc.merchants + gov * 0.3 + interest * 0.6,
    landlords: s.mInc.landlords + interest * 0.4,
  };
  // Excise is paid by buyers, mostly laborers (as in the annual model).
  for (const c of CLASS_IDS) {
    const annual = Math.max(0.1, inc[c] * 12);
    s.classes[c].income = s.classes[c].income > 0 ? s.classes[c].income * 0.5 + annual * 0.5 : annual;
  }
  s.mInc = { laborers: 0, merchants: 0, landlords: 0 };
  // Output per worker actually achieved this month, by good (for the natural price).
  const st = stat(s);
  const workersOf = {} as Record<GoodId, number>;
  for (const b of s.buildings) { const g = BUILDINGS[b.type].good; if (g) workersOf[g] = (workersOf[g] ?? 0) + b.workers; }
  for (const g of GOOD_IDS) {
    const w = workersOf[g] ?? 0;
    if (w > 0.5 && st.made[g] > 0) {
      const y = (st.made[g] * 12) / w;
      s.goods[g].perWorker = s.goods[g].perWorker ? s.goods[g].perWorker! + 0.3 * (y - s.goods[g].perWorker!) : y;
    }
  }
  s.labor.ordWage = s.labor.ordWage ? s.labor.ordWage + 0.25 * (s.labor.avgWage - s.labor.ordWage) : s.labor.avgWage;
  // Production statistics: one entry per month, ten years kept.
  (s.stats ??= []).push({ year: s.year, month: Math.floor((s.day - 1) / 30), made: st.made, used: st.used });
  if (s.stats.length > 120) s.stats.shift();
  s.mStat = { made: zero(), used: zero() };
  monthlyLabor(s);
  monthlyNatural(s);
  monthlyDemand(s);
  // Tools bought by investors become capital in the shops with the best profit rates.
  const tools = s.flags.toolCapital ?? 0;
  if (tools > 0) {
    const shops = s.buildings.filter((b) => BUILDINGS[b.type].good);
    const w = shops.map((b) => Math.max(0, b.profit) / Math.max(1, b.capital + 2) + 0.02 * b.workers);
    const tw = w.reduce((a, v) => a + v, 0);
    shops.forEach((b, i) => { b.capital += tw > 0 ? (tools * w[i]) / tw : 0; });
    s.flags.toolCapital = 0;
  }
  for (const b of s.buildings) b.capital *= 1 - SIM.delta / 12;
  void ctx;
}

/** Monthly labour market: the invisible hand, at a twelfth of the yearly pace. */
function monthlyLabor(s: GameState): void {
  const pop = totalPop(s);
  const workforce = pop * SIM.workforceShare;
  const producers = s.buildings.filter((b) => BUILDINGS[b.type].good);
  const civic = s.buildings.length - producers.length;
  for (const b of s.buildings) if (!BUILDINGS[b.type].good) b.workers = 2;
  const room = Math.max(0, workforce - civic * 2);
  let employed = producers.reduce((a, b) => a + b.workers, 0);
  if (employed > room && employed > 0) { const f = room / employed; for (const b of producers) b.workers *= f; employed = room; }
  let pool = Math.max(0, room - employed);
  const sub = s.labor.subsistence, avg = s.labor.avgWage || 1;
  let eta = (SIM.eta * (0.6 + s.society.literacy)) / 12;
  if (s.policies.guildRules) eta *= 0.4;
  let moved = 0;
  for (const b of producers) {
    let leave = 0;
    if (b.workers > capacity(b.level)) leave += b.workers - capacity(b.level);
    if (b.wage < avg) leave += eta * b.workers * Math.min(1, (avg - b.wage) / avg);
    if (b.wage < sub) leave += 0.03 * b.workers;
    // A shop that cannot sell lays off.
    if (b.status === "blocked") leave += 0.06 * b.workers;
    leave = Math.min(leave, b.workers);
    b.workers -= leave; pool += leave; moved += leave;
  }
  const weights = producers.map((b) => {
    const gap = capacity(b.level) - b.workers;
    if (gap <= 0 || b.status === "blocked") return 0;
    const fresh = s.turn * 12 - b.built * 12 < 24 ? 2 : 1;
    return gap * Math.max(0.05, (b.wage || avg) - sub * 0.9) * fresh;
  });
  const tw = weights.reduce((a, v) => a + v, 0);
  if (tw > 0 && pool > 0) {
    const hires = Math.min(pool * 0.35, producers.reduce((a, b) => a + Math.max(0, capacity(b.level) - b.workers), 0));
    producers.forEach((b, i) => {
      const h = Math.min((hires * weights[i]) / tw, capacity(b.level) - b.workers);
      if (h > 0) { b.workers += h; pool -= h; }
    });
  }
  s.labor.workforce = workforce;
  s.labor.idle = Math.max(0, pool);
  s.labor.moved = (s.labor.moved ?? 0) * 0.9 + moved;
  s.society.unemployment = workforce > 0 ? s.labor.idle / workforce : 0;
}

function monthlyNatural(s: GameState): void {
  const anchor = 0.5 * (s.labor.avgWage || 1) + 0.5 * s.money.priceLevel;
  s.labor.refWage = (s.labor.refWage || 1) + ((anchor - (s.labor.refWage || 1)) * 0.15) / 12 * 12 / 12;
  const real = realNaturalPrices(s);
  for (const g of GOOD_IDS) s.goods[g].anchor = g === "spices" ? real.spices * s.money.priceLevel : real[g] * (s.labor.refWage || 1);
  smithNatural(s);
  // National market price: population-weighted average of the town markets.
  const pop = totalPop(s);
  for (const g of GOOD_IDS) {
    let p = 0, st = 0;
    for (const m of s.markets) {
      const t = s.towns.find((x) => x.id === m.town);
      p += m.price[g] * (t ? t.pop : 0);
      st += m.stock[g];
    }
    s.goods[g].price = pop > 0 ? p / pop : s.goods[g].price;
    if (g === "bread" && s.policies.breadPriceCap) s.goods[g].price = Math.min(s.goods[g].price, s.goods[g].natural);
    s.goods[g].stock = st;
  }
}

/**
 * Smith's natural price, in production order: inputs at their natural prices plus labour at the ordinary wage
 * (economy-wide, so a monopoly or a cap cannot feed back on itself) over the output a worker actually achieves,
 * grossed up for ordinary profit and rent (labour's share of value added). Imports cost the world price.
 */
function smithNatural(s: GameState): void {
  const w = s.labor.ordWage || s.labor.avgWage || 1;
  for (const g of PRODUCTION_ORDER) {
    const def = GOODS[g];
    let inputs = 0;
    for (const [ig, q] of Object.entries(def.inputs) as [GoodId, number][]) inputs += q * (s.goods[ig].natural + (s.goods[ig].carryIn ?? 0));
    const y = s.goods[g].perWorker;
    // At the workshop door: inputs + labour at the ordinary wage, with ordinary profit and rent. At market: plus
    // carriage, and the storehouse keeper's margin (he buys at STOREHOUSE_BUY of the market price).
    const door = inputs + w / Math.max(0.05, y ?? 0) / SIM.laborShare;
    s.goods[g].natural = y && y > 0 ? (door + (s.goods[g].carryOut ?? 0)) / STOREHOUSE_BUY : (s.goods[g].anchor ?? s.goods[g].natural);
  }
  // Imports: the world price with duties paid, carried in from the port, through the storehouse.
  const sp = s.goods.spices;
  sp.natural = (worldPrice(s, "spices") * s.money.priceLevel * (1 + importDuty(s, "spices")) + (sp.carryOut ?? 0)) / STOREHOUSE_BUY;
}

/** Household and investor demand per market per day, from class incomes (§4.6, Ghazali's tiers). */
function monthlyDemand(s: GameState): void {
  const pop = totalPop(s);
  const hoardDrag = 1 - s.money.hoarding * 0.6;
  let investFunds = 0;
  for (const c of CLASS_IDS) investFunds += s.classes[c].income * SAVINGS[c];
  let investEff = 0.85;
  if (s.institutions.banks) investEff = 1.05 + Math.max(-0.4, s.society.credit);
  if (s.institutions.partnershipHouses) investEff = 0.9;
  if (s.money.trust < 50) investEff *= 0.7 + s.money.trust / 170;
  if (s.classes.merchants.satisfaction < 25) investEff *= 0.6;
  const idleShare = s.labor.workforce > 0 ? s.labor.idle / s.labor.workforce : 0;
  const widen = s.flags.burnIn ? 0 : Math.max(0.3, Math.min(0.7, 0.3 + idleShare * 6));
  const widenFunds = (investFunds * investEff * widen) / 12;
  s.flags.privatePool = Math.min((s.flags.privatePool ?? 0) + widenFunds, 400);
  s.flags.constructionWages = widenFunds * 0.4 * 12;
  const toolsYear = (investFunds * investEff * (1 - widen)) / Math.max(1e-6, s.goods.tools.price);
  s.flags.investToolsDay = toolsYear / D;
  for (const m of s.markets) {
    const town = s.towns.find((t) => t.id === m.town);
    const share = town ? town.pop / Math.max(1, pop) : 0;
    const want = zero();
    const popBy: Record<ClassId, number> = { laborers: (town?.pop ?? 0) * 0.85, merchants: (town?.pop ?? 0) * 0.1, landlords: (town?.pop ?? 0) * 0.05 };
    for (const c of CLASS_IDS) {
      let budget = s.classes[c].income * share * hoardDrag * (1 - SAVINGS[c]);
      for (const g of URGENCY) {
        const q = (BASKET[g] ?? 0) * popBy[c];
        const buy = Math.min(q, budget / Math.max(1e-6, m.price[g]));
        want[g] += buy;
        budget -= buy * m.price[g];
      }
      for (const [g, sh] of Object.entries(SPEND[c]) as [GoodId, number][]) want[g] += (Math.max(0, budget) * sh) / Math.max(1e-6, m.price[g]);
    }
    want.tools += toolsYear * share;
    // Granary: relief buys grain while cheap (§4.8); it is released by events or in dearth.
    for (const g of GOOD_IDS) m.want[g] = want[g] / D;
  }
  // Public granary purchases and releases.
  const relief = s.budget.relief * s.revenue / 12;
  const grain = s.goods.grain;
  if (s.goods.bread.price > s.goods.bread.natural * 1.3 && s.society.granary > 0) {
    const r = Math.min(s.society.granary, s.society.granary * 0.25 + 0.5);
    s.society.granary -= r;
    const m = s.markets[0];
    if (m) m.stock.grain += r;
  } else if (relief > 0 && grain.price < grain.natural * 1.05) {
    const m = [...s.markets].sort((a, b) => b.stock.grain - a.stock.grain)[0];
    if (m) {
      const buy = Math.min((relief * 0.4) / grain.price, m.stock.grain * 0.2);
      m.stock.grain -= buy;
      s.society.granary += buy;
    }
  }
}

function stat(s: GameState) {
  return (s.mStat ??= { made: zero(), used: zero() });
}

function sumRec(r: Record<GoodId, number>): number {
  let x = 0;
  for (const g of GOOD_IDS) x += r[g];
  return x;
}

// ---------------------------------------------------------------- the day
/** Advance one day. Returns true when the year is complete (the caller runs the yearly close). */
export function stepDay(s: GameState): boolean {
  const ctx = ctxFor(s);
  produce(s);
  shipOutputs(s, ctx);
  orderInputs(s, ctx);
  merchants(s, ctx);
  if (s.day % 5 === 0) imports(s, ctx);
  moveCarts(s, ctx);
  consume(s);
  prices(s);
  s.day += 1;
  if (s.day % 30 === 0) month(s, ctx);
  if (s.day % 90 === 0) updateReachAndLevels(s, ctx.g, s.report);
  return s.day >= D;
}

/** Recompute paths of carts in flight after the network changed. */
export function reroute(s: GameState): void {
  const ctx = ctxFor(s);
  for (const c of s.carts) {
    const here = c.path[c.seg];
    const to = c.path[c.path.length - 1];
    const p = pathTo(ctx, here, to);
    if (p.length) { c.path = p; c.seg = 0; }
  }
}

/** Days of travel between two tiles on the current network (Infinity if unreachable). */
export function travelDays(s: GameState, a: number, b: number): number {
  return days(ctxFor(s), a, b);
}

export { sumRec };

// ---------------------------------------------------------------- bottleneck explainer
/** Why is this workshop short? Traces the cause upstream instead of blaming the stalled building
 *  (simgrammar: "starvation far upstream is hard to diagnose without flow statistics"). */
export interface Explanation { key: string; vars: Record<string, string | number>; focus?: { q: number; r: number } }

export function explainShortage(s: GameState, b: Building): Explanation | null {
  if (b.status !== "starved" || !b.missing) return null;
  const g = b.missing;
  const ctx = ctxFor(s);
  const here = ctx.g.index.get(key(b))!;
  const makers = s.buildings.filter((x) => BUILDINGS[x.type].good === g);
  if (!makers.length) {
    const type = Object.values(BUILDINGS).find((d) => d.good === g)?.type ?? "";
    return { key: "why.noMaker", vars: { good: g, building: type } };
  }
  // On the way but held up in traffic?
  const enRoute = s.carts.filter((c) => c.dest === `b:${b.id}` && c.good === g);
  const stuck = enRoute.filter((c) => c.waited > 2);
  if (stuck.length) {
    const c = stuck[0];
    const t = s.tiles[c.path[Math.min(c.seg + 1, c.path.length - 1)]];
    return { key: "why.jam", vars: { good: g, n: stuck.length }, focus: { q: t.q, r: t.r } };
  }
  const reachable = s.markets.filter((m) => Number.isFinite(days(ctx, ctx.marketTile.get(m.town)!, here)));
  const withStock = reachable.filter((m) => m.stock[g] >= 1);
  if (!reachable.length) return { key: "why.noRoad", vars: { good: g } };
  if (!withStock.length) {
    const starved = makers.filter((x) => x.status === "starved");
    if (starved.length) {
      const up = starved[0];
      return { key: "why.upstream", vars: { good: g, upstream: up.missing ?? "tools", n: starved.length, total: makers.length }, focus: { q: up.q, r: up.r } };
    }
    const blocked = makers.filter((x) => x.status === "blocked");
    if (blocked.length) return { key: "why.makersCut", vars: { good: g, n: blocked.length }, focus: { q: blocked[0].q, r: blocked[0].r } };
    return { key: "why.notEnough", vars: { good: g, total: makers.length } };
  }
  const best = Math.min(...withStock.map((m) => days(ctx, ctx.marketTile.get(m.town)!, here)));
  if (best > 12) return { key: "why.far", vars: { good: g, days: Math.round(best) } };
  return { key: "why.waiting", vars: { good: g, n: enRoute.length } };
}
