// Ghost-of-history data (§8, §10): bundled JSON from the data pipeline, never fetched at runtime.
import britain from "../data/ghost/britain1776.json" with { type: "json" };
import type { ScenarioId } from "../sim/types.ts";

export type GhostPoint = [year: number, value: number, kind: "observed" | "interpolated" | "estimated"];
export interface GhostSeries { units: string; source: string; points: GhostPoint[] }
export interface GhostBundle {
  scenario: string;
  label: string;
  startYear: number;
  endYear: number;
  series: Record<string, GhostSeries>;
  sources: Record<string, { title: string; citation: string; license: string; url: string; sha256: string; fetched: string }>;
}

export const GHOSTS: Partial<Record<ScenarioId, GhostBundle>> = { britain1776: britain as unknown as GhostBundle };

export function ghostForEndings() {
  const out: Record<string, { gdppc: [number, number][]; realWage: [number, number][] }> = {};
  for (const [id, g] of Object.entries(GHOSTS)) {
    if (!g) continue;
    out[id] = {
      gdppc: g.series.gdppc.points.map((p) => [p[0], p[1]]),
      realWage: g.series.realWage.points.map((p) => [p[0], p[1]]),
    };
  }
  return out;
}

export function ghostAt(g: GhostSeries, year: number): GhostPoint | undefined {
  let best: GhostPoint | undefined;
  for (const p of g.points) if (!best || Math.abs(p[0] - year) < Math.abs(best[0] - year)) best = p;
  return best && Math.abs(best[0] - year) <= 1 ? best : undefined;
}
