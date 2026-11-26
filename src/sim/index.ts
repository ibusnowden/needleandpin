// Public API of the simulation core. Pure TypeScript, no engine imports (GDD §12).
export * from "./defs.ts";
export * from "./types.ts";
export * from "./hex.ts";
export { advanceDays } from "./turn.ts";
export { tradeCapacity, travelDays, yearRate, ctxFor } from "./rt.ts";
export { newGame, endTurn, canPlace, indicators, chapterOf, eraOf, eventDef, ghostRatio, setGhostData, REFORMS, tileIndex } from "./turn.ts";
export { applyCommand, buildCost, infraCost, institutionAvailable, FOUND_TOWN_COST } from "./commands.ts";
export { EVENTS, EVENT_BY_ID, choiceAvailable, currentEra, type EventDef, type EventChoice, type Text } from "./events.ts";
export { SCENARIOS, type ScenarioDef } from "./scenarios.ts";
export { buildGraph, costsFrom, reachFrom, maxLevelFor, pathBetween, moneyReachFactor } from "./transport.ts";
export { specMult, capacity, totalPop } from "./economy.ts";
export { taxGrades, gradeLetter, collectionCost, adequacy, justiceCoverage, nominalGdp } from "./society.ts";
export { replay, reversibleDecisions, describe, type Decision, type Replay } from "./counterfactual.ts";
export { botTurn, playGame, BOT_IDS, type BotId, type BotResult } from "./bots.ts";
