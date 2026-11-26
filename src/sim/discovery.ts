// "Play first, name second, read third" (GDD §9). Watches the simulation for the moment a player
// meets an idea in play, then names it with a "Discovered" toast and unlocks the codex entry.
import { BUILDINGS } from "./defs.ts";
import type { GameState } from "./types.ts";

export function discover(s: GameState, id: string): void {
  if (s.discovered.includes(id)) return;
  s.discovered.push(id);
  s.newDiscoveries.push(id);
}

export interface DiscoveryCtx {
  prevMaxLevels: Map<string, number>;
  realWageRel: number;
  capitalRel: number;
}

export function runDiscoveries(s: GameState, ctx: DiscoveryCtx): void {
  const r = s.report;
  if (r.levelUps.length) {
    discover(s, "division-of-labour");
    if (s.scenario === "needle") discover(s, "needle-hands");
  }
  for (const b of s.buildings) {
    const before = ctx.prevMaxLevels.get(b.id);
    if (before !== undefined && b.maxLevel > before) discover(s, "extent-of-market");
  }
  if (r.priceSpikes.length) discover(s, "natural-price");
  if (s.labor.moved > 0.05 * s.labor.workforce || r.privateBuilds.length) discover(s, "invisible-hand");
  if (s.money.debasements > 0 || s.money.trust < 50) discover(s, "money-mirror");
  if (s.institutions.coinage && s.scenario === "needle") discover(s, "origin-of-money");
  if (ctx.realWageRel > 1.1) discover(s, "real-wages");
  if (ctx.capitalRel > 1.25) discover(s, "capital");
  if (s.policies.pinMonopoly) discover(s, "conspiracy-against-public");
  if (s.institutions.banks || s.institutions.partnershipHouses) discover(s, "two-finance-paths");
  if (s.institutions.hisba) discover(s, "hisba");
  if (s.society.necessitySecured < 0.95) discover(s, "three-needs");
  if (s.goods.spices.imported > 0) discover(s, "three-needs");
  if ((s.flags.deficitTurns ?? 0) > 0 && s.turn > 1) discover(s, "public-debt");
  if (s.society.smuggling > 0.1) discover(s, "four-maxims");
  if (s.buildings.some((b) => b.type === "school") || s.budget.education > 0.12) discover(s, "duties-of-sovereign");
  if (s.buildings.some((b) => BUILDINGS[b.type].rootCraft)) {
    if (s.scenario === "needle") discover(s, "root-crafts");
  }
  if (s.tutorial?.marketFormed || s.institutions.marketSquares) discover(s, "markets-from-need");
}
