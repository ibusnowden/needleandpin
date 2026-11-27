// Balancing harness (GDD §13). Usage:
//   node scripts/balance.ts autopilot [seeds]      historical autopilot vs the ghost band (§10)
//   node scripts/balance.ts bots [games] [scenario] five bot strategies, win rates vs targets
import ghost from "../src/data/ghost/britain1776.json" with { type: "json" };
import { BOT_IDS, playGame, setGhostData, type BotId } from "../src/sim/index.ts";

type Pt = [number, number, string];
const series = (name: "gdppc" | "realWage") => (ghost.series[name].points as Pt[]).map((p) => [p[0], p[1]] as [number, number]);
setGhostData({ britain1776: { gdppc: series("gdppc"), realWage: series("realWage") } });

const mode = process.argv[2] ?? "autopilot";
if (mode === "autopilot") {
  const seeds = Number(process.argv[3] ?? 5);
  const years = [1790, 1800, 1820, 1835, 1850];
  const ratios: Record<number, { g: number[]; w: number[] }> = {};
  const finals: { op: number; ma: number }[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const { state } = playGame("britain1776", "historical", seed);
    // Compare 5-year means (y-4 … y): single years mostly measure where the cycle happens to be.
    const mean5 = (pts: { year: number; v: number }[], y: number) => {
      const w = pts.filter((p) => p.year > y - 5 && p.year <= y);
      return w.length ? w.reduce((a, p) => a + p.v, 0) / w.length : NaN;
    };
    const row = years.map((y) => {
      const you = (k: "gdppc" | "realWage") => mean5(state.history.map((h) => ({ year: h.year, v: h[k] })), y);
      const hist = (k: "gdppc" | "realWage") => mean5(series(k).map(([year, v]) => ({ year, v })), y);
      const g = you("gdppc") / hist("gdppc"), w = you("realWage") / hist("realWage");
      (ratios[y] ??= { g: [], w: [] }).g.push(g);
      ratios[y].w.push(w);
      return `${y}: gdp ${(g * 100).toFixed(0)}% wage ${(w * 100).toFixed(0)}%`;
    });
    finals.push({ op: state.meters.opulence.value, ma: state.meters.maslaha.value });
    console.log(`seed ${seed} [${state.ending ?? state.status}${state.collapseReason ? ":" + state.collapseReason : ""}] op ${state.meters.opulence.value.toFixed(0)} ma ${state.meters.maslaha.value.toFixed(0)} | ${row.join(" | ")}`);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log("\nmean ratio to history, 5-year averages (target: within ±15% by 1850):");
  for (const y of years) console.log(`  ${y}: GDP per capita ${(mean(ratios[y].g) * 100).toFixed(0)}%, real wage ${(mean(ratios[y].w) * 100).toFixed(0)}%`);
  console.log(`  final meters: opulence ${mean(finals.map((f) => f.op)).toFixed(1)}, maslaha ${mean(finals.map((f) => f.ma)).toFixed(1)}`);
  const g1850 = mean(ratios[1850].g), w1850 = mean(ratios[1850].w);
  const ok = Math.abs(g1850 - 1) <= 0.15 && Math.abs(w1850 - 1) <= 0.15;
  console.log(ok ? "AUTOPILOT INSIDE GHOST BAND" : "AUTOPILOT OUTSIDE GHOST BAND");
  process.exitCode = ok ? 0 : 1;
} else {
  const games = Number(process.argv[3] ?? 20);
  const scenario = (process.argv[4] ?? "britain1776") as "britain1776" | "needle";
  // §13: Balanced ≈ 60%, Mercantilist < 15%, Debaser < 5%, no strategy above 75%.
  const targets: Record<BotId, [number, number]> = { balanced: [0.45, 0.75], mercantilist: [0, 0.15], debaser: [0, 0.05], freeTrader: [0, 0.75], piousSteward: [0, 0.75], historical: [0, 1] };
  let pass = true;
  const all: Record<string, { op: number; ma: number; ratio: number; ending: string }[]> = {};
  for (const bot of BOT_IDS) {
    const tally: Record<string, number> = {};
    let op = 0, ma = 0;
    for (let seed = 1; seed <= games; seed++) {
      const { result, state } = playGame(scenario, bot, 1000 + seed);
      tally[result.ending] = (tally[result.ending] ?? 0) + 1;
      const g = ghost.series.gdppc.points as Pt[], w = ghost.series.realWage.points as Pt[];
      const y = state.history[state.history.length - 1].year;
      const near = (pts: Pt[]) => pts.reduce((b, p) => (Math.abs(p[0] - y) < Math.abs(b[0] - y) ? p : b))[1];
      const ratio = scenario === "britain1776" ? (result.gdppc / near(g) + result.realWage / near(w)) / 2 : 1;
      (all[bot] ??= []).push({ op: result.opulence, ma: result.maslaha, ratio, ending: result.ending });
      op += result.opulence; ma += result.maslaha;
    }
    const win = (tally.golden ?? 0) / games;
    const [lo, hi] = targets[bot];
    const ok = win >= lo && win <= hi;
    pass &&= ok;
    console.log(`${bot.padEnd(13)} win ${(win * 100).toFixed(0).padStart(3)}% [target ${lo * 100}–${hi * 100}%] ${ok ? "ok " : "OFF"} op ${(op / games).toFixed(0)} ma ${(ma / games).toFixed(0)} ${JSON.stringify(tally)}`);
  }
  // Save every game and search the target pair that best meets §13 (Balanced ~60%, none > 75%,
  // Mercantilist < 15%, Debaser < 5%). Endings: golden needs both meters and history beaten.
  const fs = await import("node:fs");
  fs.writeFileSync(`scripts/.balance-${scenario}.json`, JSON.stringify(all));
  const winRate = (bot: string, o: number, m: number) => {
    const r = all[bot] ?? [];
    return r.filter((x) => x.ending !== "collapse" && x.op >= o && x.ma >= m && x.ratio >= 1).length / Math.max(1, r.length);
  };
  let best: { o: number; m: number; score: number } | null = null;
  for (let o = 30; o <= 90; o++) for (let m = 40; m <= 95; m++) {
    const b = winRate("balanced", o, m);
    const worst = Math.max(...BOT_IDS.map((x) => winRate(x, o, m)));
    const ok = worst <= 0.75 && winRate("mercantilist", o, m) <= 0.15 && winRate("debaser", o, m) <= 0.05;
    if (!ok) continue;
    // Closest to Balanced ≈ 60%; among ties, the most demanding targets (meters must mean something).
    const score = -Math.abs(b - 0.6) * 1000 + o + m;
    if (!best || score > best.score) best = { o, m, score };
  }
  if (best) console.log(`suggested targets: opulence ${best.o}, maslaha ${best.m} -> ` + BOT_IDS.map((x) => `${x} ${(winRate(x, best!.o, best!.m) * 100).toFixed(0)}%`).join(", "));
  else console.log("no target pair meets the §13 constraints with these strategies");
  process.exitCode = pass ? 0 : 1;
}
