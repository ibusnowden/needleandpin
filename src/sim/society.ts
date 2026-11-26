// The sovereign, money and society (GDD §4.5–4.8, §8 interactions).
import { BUDGET_LINES, BUILDINGS, SIM, type BudgetLine } from "./defs.ts";
import { distance } from "./hex.ts";
import type { MarketResult } from "./economy.ts";
import { totalPop } from "./economy.ts";
import { SCENARIOS } from "./scenarios.ts";
import type { GameState } from "./types.ts";

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/** Spending that each budget line needs to be fully effective, as a share of nominal output. */
const NEED: Record<BudgetLine, number> = { defense: 0.03, justice: 0.012, works: 0.015, education: 0.012, relief: 0.01 };

export function nominalGdp(s: GameState): number {
  return (s.classes.laborers.income + s.classes.merchants.income + s.classes.landlords.income) || 1;
}

export function adequacy(s: GameState, line: BudgetLine): number {
  const need = NEED[line] * nominalGdp(s);
  return clamp((s.budget[line] * s.revenue) / Math.max(1e-6, need), 0, 1.5);
}

// ---------------------------------------------------------------- taxes: Smith's four maxims (V.2)
export interface TaxGrades { equality: number; certainty: number; convenience: number; economy: number }
export const gradeLetter = (x: number) => (x >= 0.85 ? "A" : x >= 0.7 ? "B" : x >= 0.55 ? "C" : x >= 0.4 ? "D" : x >= 0.25 ? "E" : "F");

export function collectionCost(s: GameState): number {
  const t = s.taxes;
  const active = [t.land, t.exciseNecessities, t.exciseLuxuries, t.customs].filter((x) => x > 0.001).length;
  return (t.collection === "farmers" ? 0.18 : 0.06) + active * 0.01;
}

export function taxGrades(s: GameState): TaxGrades {
  const rb = s.revenueBreakdown;
  const total = (rb.landTax ?? 0) + (rb.exciseNec ?? 0) + (rb.exciseLux ?? 0) + (rb.customs ?? 0);
  const incomeTotal = nominalGdp(s);
  const labShareIncome = s.classes.laborers.income / incomeTotal;
  const labBurden = total > 0 ? ((rb.exciseNec ?? 0) * 0.85 + (rb.exciseLux ?? 0) * 0.3 + (rb.customs ?? 0) * 0.5) / total : labShareIncome;
  const equality = clamp(1 - Math.max(0, labBurden - labShareIncome) * 2.2 - Math.max(0, s.taxes.exciseNecessities - 0.12));
  const recentChanges = s.taxChanges.filter((t) => s.turn - t < 5).length;
  const certainty = clamp(1 - (s.taxes.collection === "farmers" ? 0.45 : 0) - recentChanges * 0.12);
  const convenience = clamp(1 - s.society.smuggling * 0.9 - Math.max(0, s.taxes.exciseNecessities - 0.1) * 2 - Math.max(0, s.taxes.land - 0.3));
  const economy = clamp(1 - (collectionCost(s) - 0.05) * 4);
  return { equality, certainty, convenience, economy };
}

// ---------------------------------------------------------------- the treasury
export function runTreasury(s: GameState, m: MarketResult): void {
  const gross = m.landTax + m.exciseNec + m.exciseLux + m.customs;
  const net = gross * (1 - collectionCost(s));
  s.revenueBreakdown = { landTax: m.landTax, exciseNec: m.exciseNec, exciseLux: m.exciseLux, customs: m.customs, collection: gross - net };
  const prevRevenue = s.revenue || net;
  s.revenue = net;
  const spend = BUDGET_LINES.reduce((a, l) => a + s.budget[l], 0) * prevRevenue;
  const interest = s.debt * s.interestRate;
  s.flags.govRelief = s.budget.relief * prevRevenue * 0.6;
  // Collectors and revenue officers are paid too: collection cost is spending, not a hole.
  s.flags.govSpend = spend - s.flags.govRelief + (gross - net);
  s.flags.govInterest = interest;
  s.spending = spend + interest;
  s.treasury += net - spend - interest;
  if (s.treasury < 0) {
    // Borrow to cover the deficit (§4.8: borrowing now, interest drag later).
    s.debt += -s.treasury;
    s.treasury = 0;
    s.flags.deficitTurns = (s.flags.deficitTurns ?? 0) + 1;
  } else {
    s.flags.deficitTurns = 0;
  }
  const debtRatio = s.debt / Math.max(1, nominalGdp(s));
  s.interestRate = clamp(SCENARIOS[s.scenario].interestRate + 0.02 * Math.max(0, debtRatio - 1.2) + Math.max(0, 80 - s.money.trust) / 1200 - (s.flags.debtConsolidation ? 0.008 : 0), 0.02, 0.2);
  // State bankruptcy: interest swallowing revenue, turn after turn (§8 Collapse).
  if (interest > 0.75 * Math.max(1e-6, net)) s.flags.fiscalCrisis = (s.flags.fiscalCrisis ?? 0) + 1;
  else s.flags.fiscalCrisis = 0;
}

// ---------------------------------------------------------------- money (§4.5, §13)
export function runMoney(s: GameState, step: number): void {
  const mo = s.money;
  const infl = mo.pendingInflation * 0.4;
  mo.pendingInflation -= infl;
  const drift = Math.max(0, 60 - mo.trust) / 1500;
  const total = infl + drift;
  if (total > 0) {
    mo.priceLevel *= 1 + total;
    for (const g of Object.values(s.goods)) g.price *= 1 + total;
  }
  // Each recent debasement lowers the level trust can recover to: the market remembers.
  const recent = mo.debaseTurns.filter((t) => s.turn - t < 20).length;
  const home = (s.institutions.centralBank ? 85 : SIM.trustHome) - 6 * recent;
  const rate = s.institutions.centralBank ? 0.2 : 0.15;
  if ((s.flags.lastDebase ?? -99) < s.turn) {
    if (mo.trust < home) mo.trust += Math.min(3 * step, (home - mo.trust) * rate * step);
    else mo.trust -= (mo.trust - home) * 0.05;
  }
  if (s.society.fraud > 0.4) mo.trust -= (s.society.fraud - 0.4) * 4;
  mo.trust = clamp(mo.trust, 0, 100);
  const hoardTarget = clamp((45 - mo.trust) / 90, 0, 0.5);
  mo.hoarding += (hoardTarget - mo.hoarding) * 0.4;
  // Interest-banking credit cycle: booms build, then bust (§4.7).
  if (s.institutions.banks) {
    const c = s.society.credit;
    s.society.credit = c > 0.35 ? -0.3 : c + 0.06 + (mo.trust - 70) / 800;
    if (c > 0.35) s.flags.bankPanic = s.turn;
  } else if (s.institutions.partnershipHouses) {
    s.society.credit = s.society.credit * 0.5;
  }
}

// ---------------------------------------------------------------- society
export function justiceCoverage(s: GameState): number {
  const courts = s.buildings.filter((b) => b.type === "courthouse");
  const pop = totalPop(s);
  let covered = 0;
  for (const t of s.towns) if (courts.some((c) => distance(c, t) <= 4)) covered += t.pop;
  return clamp(0.45 * Math.min(1, adequacy(s, "justice")) + 0.55 * (pop > 0 ? covered / pop : 0));
}

export function schoolCoverage(s: GameState): number {
  const schools = s.buildings.filter((b) => b.type === "school");
  const pop = totalPop(s);
  let covered = 0;
  for (const t of s.towns) if (schools.some((c) => distance(c, t) <= 3)) covered += t.pop;
  return pop > 0 ? covered / pop : 0;
}

export function runSociety(s: GameState, m: MarketResult, step: number, realWageRel: number): void {
  const so = s.society;
  so.necessitySecured = m.necessityFill;
  so.housingSecured = m.housingFill;
  // Security.
  const banditTarget = 0.03 + 0.32 * Math.max(0, 1 - adequacy(s, "defense"));
  so.banditry += (banditTarget - so.banditry) * 0.3;
  // Honest markets: justice, the hisba office, and courts lower fraud (Ghazali Book 13).
  const jc = justiceCoverage(s);
  const fraudEq = 0.3 - 0.16 * jc - (s.institutions.hisba ? 0.09 : 0) - (s.institutions.contractCourts ? 0.04 : 0) + (s.taxes.collection === "farmers" ? 0.08 : 0) + (s.policies.breadPriceCap ? 0.05 : 0) + Math.max(0, 50 - s.money.trust) / 400;
  so.fraud = clamp(so.fraud + (fraudEq - so.fraud) * 0.2, 0.02, 1);
  // Literacy (§8 'aql).
  const edu = Math.min(1.2, adequacy(s, "education"));
  const target = clamp(0.12 + 0.42 * edu + 0.22 * schoolCoverage(s) + (s.institutions.publicSchooling ? 0.2 : 0) + (s.institutions.elementarySchools ? 0.06 : 0), 0, 0.98);
  let speed = 0.03 * step * (s.institutions.printingPress ? 1.5 : 1) * (s.institutions.publicSchooling ? 1.6 : 1);
  if (target < so.literacy) speed *= 0.3;
  so.literacy += (target - so.literacy) * Math.min(1, speed);
  // Freedom of worship and trust in institutions (§8 din — freedom and trust, never doctrine).
  so.freedomOfWorship = s.policies.testActs ? Math.min(so.freedomOfWorship, 0.72) : Math.min(1, so.freedomOfWorship + 0.05);
  const recentDebase = s.turn - (s.flags.lastDebase ?? -99) < 8 ? 1 : 0;
  const instTarget = 28 + 25 * jc + 15 * (1 - so.fraud) - (s.policies.pinMonopoly ? 10 : 0) - recentDebase * 15 + (s.advisors.scholar.resigned ? -5 : 0) + (s.advisors.scotsman.resigned ? -5 : 0) + 10 * Math.min(1, adequacy(s, "works"));
  so.institutionTrust += (clamp(instTarget, 0, 100) - so.institutionTrust) * 0.25;
  s.flags.worksAdequacy = adequacy(s, "works");

  // Population (§8 nafs, nasl).
  // Famine kills through want of food; cloth and shelter shortages hurt Maslaha, not mortality.
  let famine = 0;
  if (m.foodFill < 0.86) famine = (0.86 - m.foodFill) * 0.25;
  if (s.flags.burnIn) famine = 0;
  if (so.granary > 0 && famine > 0) famine *= 0.7;
  so.famineDeaths = famine;
  // Malthus: births respond to real wages and housing; growth absorbs much of any wage gain.
  const growth = (0.006 * Math.min(1, m.housingFill + 0.3) + 0.009 * clamp(realWageRel - 1, -1, 1)) * step - famine;
  let emigr = 0;
  if (s.classes.laborers.satisfaction < 30) emigr = 0.008 * step * (30 - s.classes.laborers.satisfaction) / 30;
  if (s.meters.opulence.value - s.meters.maslaha.value > 25) emigr += 0.003 * step; // rich and brittle
  so.emigration = emigr;
  const factor = s.flags.burnIn ? 1 : 1 + growth - emigr;
  // Towns with good markets and mood attract more of the growth (urbanisation).
  const weights = s.towns.map((t) => Math.max(0.3, t.mood / 50));
  const wAvg = weights.reduce((a, v) => a + v, 0) / Math.max(1, weights.length);
  s.towns.forEach((t, i) => {
    const local = 1 + (factor - 1) * (factor >= 1 ? weights[i] / wAvg : 1);
    t.pop = Math.max(5, t.pop * local);
  });

  // Classes (§4.6).
  const lab = s.classes.laborers, mer = s.classes.merchants, lan = s.classes.landlords;
  const grades = taxGrades(s);
  const labTarget =
    32 * m.necessityFill ** 2 +
    26 * clamp((realWageRel - 0.7) / 0.8) +
    14 * clamp(1 - so.unemployment * 2.5) +
    10 * Math.min(1, edu) +
    8 * (1 - so.fraud) +
    10 * grades.equality -
    (s.taxes.collection === "farmers" ? 6 : 0) +
    (s.policies.breadPriceCap ? 4 : 0) -
    (s.flags.riotTurn === s.turn - 1 ? 5 : 0);
  const capitalTotal = s.buildings.reduce((a, b) => a + b.capital, 0);
  const profitRate = m.profits / Math.max(1, capitalTotal + s.buildings.length * 5);
  const taxBurden = (s.taxes.exciseLuxuries + s.taxes.customs * 0.3);
  const merTarget =
    38 * clamp(profitRate / 0.25) +
    18 * clamp(1 - taxBurden * 2) +
    14 * (s.policies.pinMonopoly ? 1 : 0) +
    8 * (s.policies.navigationActs || s.taxes.customs >= 0.2 ? 1 : 0) +
    12 * (s.money.trust / 100) +
    10 * grades.certainty;
  const rentPc = m.rents / Math.max(1, totalPop(s));
  const rent0 = s.flags.rentPc0 || rentPc || 1;
  if (!s.flags.rentPc0 && rentPc > 0) s.flags.rentPc0 = rentPc;
  const lanTarget =
    42 * clamp(rentPc / rent0 / 1.5) +
    24 * clamp(1 - s.taxes.land / 0.4) +
    20 * (s.policies.cornLaw ? 1 : 0) +
    14 * (1 - so.banditry * 2);
  lab.satisfaction += (clamp(labTarget, 0, 100) - lab.satisfaction) * 0.35;
  mer.satisfaction += (clamp(merTarget, 0, 100) - mer.satisfaction) * 0.35;
  lan.satisfaction += (clamp(lanTarget, 0, 100) - lan.satisfaction) * 0.35;
  const incTot = nominalGdp(s);
  mer.influence += ((mer.income / incTot) * 100 * (s.policies.pinMonopoly ? 1.3 : 1) - mer.influence) * 0.3;
  lan.influence += ((lan.income / incTot) * 100 * 1.4 - lan.influence) * 0.3;
  lab.influence += ((lab.income / incTot) * 100 * 0.35 * (0.5 + so.literacy) - lab.influence) * 0.3;
  for (const t of s.towns) t.mood += (lab.satisfaction + (t.pop > 60 ? -3 : 3) - t.mood) * 0.5;
}

export function laborerRealWage(s: GameState, basketCost: number): number {
  const pop = totalPop(s);
  const workers = s.labor.workforce || pop * SIM.workforceShare;
  const perWorker = s.classes.laborers.income / Math.max(1e-6, workers);
  // Welfare ratio: a worker's earnings over the cost of a family basket (3 adult equivalents, §13).
  return perWorker / Math.max(1e-6, basketCost * 3 / (SIM.workforceShare * 2.2));
}

export const CIVIC = (Object.values(BUILDINGS)).filter((b) => b.civic).map((b) => b.type);
