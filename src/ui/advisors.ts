// The council's standing counsel (§7). Lines are original game writing in each thinker's spirit —
// paraphrase, never invented quotations (§3 accuracy rules). Picked from the state by simple rules.
import { BUILDINGS, type GameState } from "../sim/index.ts";

export function scotsmanLine(s: GameState): string {
  const capped = s.buildings.filter((b) => BUILDINGS[b.type].good && b.level >= b.maxLevel && b.workers >= 3 * b.level).length;
  if (s.money.trust < 55) return "coin";
  if (s.policies.pinMonopoly) return "monopoly";
  if (s.taxes.customs > 0.25 || s.policies.navigationActs) return "tariffs";
  if (s.policies.internalTolls) return "tolls";
  if (s.policies.guildRules) return "guilds";
  if (capped >= 3) return "widen";
  if (s.debt > 1.3 * (s.classes.laborers.income + s.classes.merchants.income + s.classes.landlords.income)) return "debt";
  if (s.society.literacy < 0.35 && s.budget.education < 0.08) return "schools";
  if (s.classes.merchants.satisfaction < 30) return "capitalShort";
  return "fine";
}

export function scholarLine(s: GameState): string {
  if (s.tutorial && !s.tutorial.marketFormed) return "crafts";
  if (s.society.necessitySecured < 0.95) return "bread";
  if (s.money.trust < 55) return "mirror";
  if (s.money.hoarding > 0.1) return "hoard";
  if (s.society.fraud > 0.22) return "fraud";
  if (s.meters.opulence.value - s.meters.maslaha.value > 20) return "richFor";
  if (s.classes.laborers.satisfaction < 40 && s.society.granary < 1) return "poor";
  if (s.policies.testActs) return "worship";
  if (s.society.literacy < 0.4) return "knowledge";
  return "fine";
}
