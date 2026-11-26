import { describe, expect, it } from "vitest";
import {
  applyCommand, buildGraph, capacity, costsFrom, endTurn, indicators, maxLevelFor, newGame, pathBetween, reachFrom,
  replay, reversibleDecisions, specMult, totalPop, type Command, type GameState,
} from "../../src/sim/index.ts";
import { canPlace } from "../../src/sim/turn.ts";

function run(s: GameState, cmd: Command): GameState {
  const r = applyCommand(s, cmd);
  if (!r.ok) throw new Error(`${cmd.type}: ${r.error}`);
  return r.state;
}

function firstAvailable(s: GameState): GameState {
  if (!s.pendingEvent) return s;
  for (let c = 0; c < 4; c++) {
    const r = applyCommand(s, { type: "eventChoice", eventId: s.pendingEvent.id, choice: c });
    if (r.ok) return r.state;
  }
  return s;
}

function advanceSafe(s: GameState, n: number): GameState {
  for (let i = 0; i < n && s.status !== "ended"; i++) {
    s = firstAvailable(s);
    if (s.status === "reckoning") s = run(s, { type: "reform", id: "none" });
    s = endTurn(s);
  }
  return s;
}

describe("determinism (§12: same seed, same result)", () => {
  it("two games from one seed are identical after 15 turns", () => {
    const a = advanceSafe(newGame("britain1776", 7), 15);
    const b = advanceSafe(newGame("britain1776", 7), 15);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("different seeds give different maps", () => {
    const a = newGame("britain1776", 1), b = newGame("britain1776", 2);
    expect(JSON.stringify(a.tiles)).not.toBe(JSON.stringify(b.tiles));
  });
});

describe("formulas (§13)", () => {
  it("m(s) = 1.6^(s-1): level 5 is ~6.5× level 1", () => {
    expect(specMult(1)).toBe(1);
    expect(specMult(5)).toBeCloseTo(6.5536, 3);
  });
  it("each doubling of reach unlocks one more level, capped at 5", () => {
    expect(maxLevelFor(50, 100)).toBe(1);
    expect(maxLevelFor(200, 100)).toBe(2);
    expect(maxLevelFor(400, 100)).toBe(3);
    expect(maxLevelFor(1e9, 100)).toBe(5);
  });
  it("a level-s workshop has room for the hands it needs to split the work", () => {
    for (let lv = 1; lv <= 5; lv++) expect(capacity(lv)).toBeGreaterThanOrEqual(3 * lv);
  });
});

describe("scenario starts from real data (§10)", () => {
  it("Britain 1776 turn 0 equals Maddison GDP per capita and Allen's London welfare ratio", () => {
    const s = newGame("britain1776", 1);
    const ind = indicators(s);
    expect(ind.gdppc).toBeCloseTo(2962, 0);
    expect(ind.realWage).toBeCloseTo(1.298, 2);
  });
  it("the map has 300–600 hexes (§5)", () => {
    const s = newGame("britain1776", 1);
    expect(s.tiles.length).toBeGreaterThanOrEqual(300);
    expect(s.tiles.length).toBeLessThanOrEqual(600);
  });
});

describe("extent of the market (§4.3)", () => {
  it("a road to the next village raises a workshop's reach", () => {
    let s = newGame("needle", 3);
    const town = s.towns[0], v1 = s.towns[1];
    const site = s.tiles.find((t) => canPlace(s, "pinworks", t) === null && Math.abs(t.q - town.q) + Math.abs(t.r - town.r) <= 2)!;
    s = run(s, { type: "build", building: "pinworks", q: site.q, r: site.r });
    const before = reachFrom(s, buildGraph(s), costsFrom(buildGraph(s), buildGraph(s).index.get(`${site.q},${site.r}`)!)).reach;
    // Lay a road along the cheapest path to the village.
    const g = buildGraph(s);
    for (const i of pathBetween(g, g.index.get(`${site.q},${site.r}`)!, g.index.get(`${v1.q},${v1.r}`)!)) {
      const t = s.tiles[i];
      s.infra[`${t.q},${t.r}`] = "road";
    }
    const g2 = buildGraph(s);
    const after = reachFrom(s, g2, costsFrom(g2, g2.index.get(`${site.q},${site.r}`)!)).reach;
    expect(after).toBeGreaterThan(before);
  });
  it("Money Trust multiplies reach (§13)", () => {
    const s = newGame("britain1776", 1);
    const g = buildGraph(s);
    const src = g.index.get(`${s.buildings[0].q},${s.buildings[0].r}`)!;
    const full = reachFrom(s, g, costsFrom(g, src)).reach;
    const t0 = s.money.trust;
    s.money.trust = 40;
    expect(reachFrom(s, g, costsFrom(g, src)).reach).toBeCloseTo(full * (40 / t0), 6);
  });
});

describe("money and trust (§4.5)", () => {
  it("debasement pays now and costs about ten turns of trust", () => {
    let s = newGame("britain1776", 4);
    const trust0 = s.money.trust, tre0 = s.treasury;
    s = run(s, { type: "debase" });
    expect(s.treasury).toBeGreaterThan(tre0);
    expect(s.money.trust).toBeCloseTo(trust0 - 26, 5);
    s = advanceSafe(s, 4);
    expect(s.money.priceLevel).toBeGreaterThan(1.05);
    expect(s.money.trust).toBeLessThan(trust0);
  });
  it("the card limit is two policy changes per turn (§2)", () => {
    let s = newGame("britain1776", 4);
    s = run(s, { type: "policy", id: "guildRules", on: false });
    s = run(s, { type: "policy", id: "internalTolls", on: false });
    const r = applyCommand(s, { type: "policy", id: "navigationActs", on: false });
    expect(r.ok).toBe(false);
  });
});

describe("prices (§4.4)", () => {
  it("a bread price cap produces shortages when supply fails", () => {
    let s = newGame("britain1776", 5);
    s = run(s, { type: "policy", id: "breadPriceCap", on: true });
    s.goods.grain.stock = 0;
    for (const b of s.buildings) if (b.type === "farm") b.workers = 0.5;
    s = advanceSafe(s, 2);
    expect(s.goods.bread.price).toBeLessThanOrEqual(s.goods.bread.natural * 1.0001);
    expect(s.society.fraud).toBeGreaterThan(0);
  });
});

describe("tutorial (§15 B: four root crafts)", () => {
  it("the market forms once farming, weaving, building and governance exist", () => {
    let s = newGame("needle", 2);
    const town = s.towns[0];
    for (const type of ["weaver", "builder", "courthouse"] as const) {
      const t = s.tiles.find((t) => canPlace(s, type, t) === null && Math.max(Math.abs(t.q - town.q), Math.abs(t.r - town.r)) <= 3)!;
      s = run(s, { type: "build", building: type, q: t.q, r: t.r });
    }
    s = advanceSafe(s, 1);
    expect(s.tutorial?.marketFormed).toBe(true);
    expect(s.discovered).toContain("markets-from-need");
  });
});

describe("counterfactual replay (§9)", () => {
  it("reversing a policy gives a different alternative line from the same seed", () => {
    let s = newGame("britain1776", 9);
    const snapshot = structuredClone(s);
    s = run(s, { type: "policy", id: "internalTolls", on: false });
    s = advanceSafe(s, 6);
    const ds = reversibleDecisions(s, snapshot.turn);
    expect(ds.length).toBeGreaterThan(0);
    const d = ds.find((x) => x.command.type === "policy")!;
    const r = replay(snapshot, s, d);
    expect(r.alternative.length).toBeGreaterThan(1);
    expect(r.alternative.map((h) => h.gdppc)).not.toEqual(r.actual.map((h) => h.gdppc));
  });
});

describe("performance (§12: end of turn under 200 ms)", () => {
  it("Britain end-turn runs well under budget", () => {
    let s = newGame("britain1776", 1);
    s = advanceSafe(s, 2);
    const t = performance.now();
    s = endTurn(firstAvailable(s));
    expect(performance.now() - t).toBeLessThan(200);
    expect(totalPop(s)).toBeGreaterThan(0);
  });
});

