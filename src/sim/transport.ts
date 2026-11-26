import {
  CANAL_COST, RAIL_COST, RIVER_COST, ROAD_COST, SEA_LANE_COST, SIM, TERRAIN_COST,
} from "./defs.ts";
import { DIRS, key } from "./hex.ts";
import { SCENARIOS } from "./scenarios.ts";
import type { GameState, Tile } from "./types.ts";

export interface Graph {
  n: number;
  index: Map<string, number>;
  tiles: Tile[];
  /** Cost to enter node i from a land neighbour. */
  enter: Float64Array;
  isSea: Uint8Array;
  isPort: Uint8Array;
  nbrs: Int32Array; // 6 per node, -1 for none
}

/** Per-hex transport cost multipliers from policy and security. */
export function landCostMultiplier(s: GameState): number {
  let m = 1 + s.society.banditry * 0.8;
  if (s.policies.internalTolls) m *= 1.3;
  return m;
}

export function buildGraph(s: GameState): Graph {
  const tiles = s.tiles;
  const n = tiles.length;
  const index = new Map<string, number>();
  tiles.forEach((t, i) => index.set(key(t), i));
  const enter = new Float64Array(n);
  const isSea = new Uint8Array(n);
  const isPort = new Uint8Array(n);
  const nbrs = new Int32Array(n * 6).fill(-1);
  const landMult = landCostMultiplier(s);
  const seaMult = s.institutions.merchantShipping ? 0.7 : 1;
  for (const b of s.buildings) if (b.type === "port") isPort[index.get(key(b))!] = 1;
  for (let i = 0; i < n; i++) {
    const t = tiles[i];
    if (t.terrain === "sea") {
      isSea[i] = 1;
      enter[i] = SEA_LANE_COST * seaMult;
    } else {
      const infra = s.infra[key(t)];
      let c = TERRAIN_COST[t.terrain];
      if (t.river) c = Math.min(c, RIVER_COST);
      if (infra === "road") c = Math.min(c, ROAD_COST * (s.policies.internalTolls ? 1.25 : 1));
      if (infra === "canal") c = Math.min(c, CANAL_COST);
      if (infra === "rail") c = Math.min(c, RAIL_COST);
      enter[i] = c * landMult;
    }
    for (let d = 0; d < 6; d++) {
      const j = index.get(`${t.q + DIRS[d].q},${t.r + DIRS[d].r}`);
      if (j !== undefined) nbrs[i * 6 + d] = j;
    }
  }
  return { n, index, tiles, enter, isSea, isPort, nbrs };
}

/** Binary-heap Dijkstra from one source tile. Sea is only entered or left through ports. */
export function costsFrom(g: Graph, src: number): Float64Array {
  const dist = new Float64Array(g.n).fill(Infinity);
  const heap: number[] = [];
  const hd: number[] = [];
  const push = (node: number, d: number) => {
    heap.push(node); hd.push(d);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hd[p] <= hd[i]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      [hd[p], hd[i]] = [hd[i], hd[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top: [number, number] = [heap[0], hd[0]];
    const ln = heap.pop()!, ld = hd.pop()!;
    if (heap.length) {
      heap[0] = ln; hd[0] = ld;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && hd[l] < hd[m]) m = l;
        if (r < heap.length && hd[r] < hd[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        [hd[m], hd[i]] = [hd[i], hd[m]];
        i = m;
      }
    }
    return top;
  };
  dist[src] = 0;
  push(src, 0);
  while (heap.length) {
    const [u, du] = pop();
    if (du > dist[u]) continue;
    for (let d = 0; d < 6; d++) {
      const v = g.nbrs[u * 6 + d];
      if (v < 0) continue;
      // Land→sea only from a port; sea→land only into a port.
      if (g.isSea[v] && !g.isSea[u] && !g.isPort[u]) continue;
      if (!g.isSea[v] && g.isSea[u] && !g.isPort[v]) continue;
      const nd = du + g.enter[v];
      if (nd < dist[v]) {
        dist[v] = nd;
        push(v, nd);
      }
    }
  }
  return dist;
}

export interface ReachResult {
  reach: number;
  foreign: number;
  /** Per-town discounted population contributions, by town index. */
  towns: number[];
  /** Cheapest cost to any port (Infinity if none reachable). */
  portCost: number;
}

/** Penalty multipliers that apply to every route: Money Trust and barter (§4.5, §13). */
export function moneyReachFactor(s: GameState): number {
  const barter = s.institutions.coinage ? 1 : 0.5;
  return (s.money.trust / 100) * barter * (1 - s.money.hoarding * 0.5);
}

/** R_w = Σ_j P_j e^{-c_wj/c0}, times money factors, plus foreign markets reached by sea. */
export function reachFrom(s: GameState, g: Graph, dist: Float64Array): ReachResult {
  const def = SCENARIOS[s.scenario];
  const towns: number[] = [];
  const square = s.institutions.marketSquares ? 1.2 : 1;
  let reach = 0;
  for (const t of s.towns) {
    const i = g.index.get(key(t));
    const c = i === undefined ? Infinity : dist[i];
    const v = Number.isFinite(c) ? t.pop * square * Math.exp(-c / SIM.c0) : 0;
    towns.push(v);
    reach += v;
  }
  let portCost = Infinity;
  for (const b of s.buildings) {
    if (b.type !== "port") continue;
    const i = g.index.get(key(b))!;
    portCost = Math.min(portCost, dist[i]);
  }
  let foreign = 0;
  if (Number.isFinite(portCost)) {
    const seaMult = s.institutions.merchantShipping ? 0.7 : 1;
    let tariffDrag = 1 - Math.min(0.6, s.taxes.customs * 0.8); // rivals retaliate in kind
    if (s.policies.navigationActs) tariffDrag *= 0.8;
    if (s.flags.openPorts) tariffDrag *= 1.3;
    foreign = def.foreign.pop * (s.flags.foreignMult || 1) * Math.exp(-(portCost + def.foreign.seaCost * seaMult) / SIM.c0) * tariffDrag;
  }
  const f = moneyReachFactor(s);
  return { reach: (reach + foreign) * f, foreign: foreign * f, towns: towns.map((v) => v * f), portCost };
}

/** s_max = min(5, 1 + floor(log2(R/R0))) */
export function maxLevelFor(reach: number, r0: number): number {
  if (reach <= r0) return 1;
  return Math.max(1, Math.min(5, 1 + Math.floor(Math.log2(reach / r0))));
}

/** Cheapest path between two tiles (for laying historical turnpikes and drawing caravans). */
export function pathBetween(g: Graph, from: number, to: number): number[] {
  const dist = new Float64Array(g.n).fill(Infinity);
  const prev = new Int32Array(g.n).fill(-1);
  const done = new Uint8Array(g.n);
  dist[from] = 0;
  // Small graphs (≤ 600 hexes): a simple O(n²) Dijkstra is plenty and keeps this obvious.
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < g.n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0 || u === to) break;
    done[u] = 1;
    for (let d = 0; d < 6; d++) {
      const v = g.nbrs[u * 6 + d];
      if (v < 0 || g.isSea[v]) continue;
      const nd = dist[u] + g.enter[v];
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
    }
  }
  if (!Number.isFinite(dist[to])) return [];
  const out: number[] = [];
  for (let v = to; v >= 0; v = prev[v]) out.unshift(v);
  return out;
}
