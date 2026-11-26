// Counterfactual replay (GDD §9): "What if?" reruns the last turns with one decision reversed,
// using the same seed, so every unrelated random draw stays the same.
import { applyCommand } from "./commands.ts";
import { EVENT_BY_ID, choiceAvailable } from "./events.ts";
import { endTurn } from "./turn.ts";
import { stepDay } from "./rt.ts";
import type { Command, GameState, TurnRecord } from "./types.ts";

export interface Decision {
  turn: number;
  index: number;
  command: Command;
}

/** Decisions in the log that have a meaningful reversal. */
export function reversibleDecisions(s: GameState, fromTurn: number): Decision[] {
  const out: Decision[] = [];
  for (const entry of s.log) {
    if (entry.turn < fromTurn) continue;
    entry.commands.forEach(({ cmd: c }, index) => {
      if (c.type === "policy" || c.type === "debase" || c.type === "tax" || c.type === "budget") out.push({ turn: entry.turn, index, command: c });
      if (c.type === "eventChoice") {
        const e = EVENT_BY_ID.get(c.eventId);
        if (e && e.choices.length > 1) out.push({ turn: entry.turn, index, command: c });
      }
    });
  }
  return out;
}

function reverse(c: Command, snapshot: GameState): Command | null {
  switch (c.type) {
    case "policy": return { ...c, on: !c.on };
    case "debase": return null;
    case "tax": {
      const undo: Partial<typeof snapshot.taxes> = {};
      for (const k of Object.keys(c.taxes) as (keyof typeof snapshot.taxes)[]) (undo as Record<string, unknown>)[k] = snapshot.taxes[k];
      return { type: "tax", taxes: undo };
    }
    case "budget": return { ...c, value: snapshot.budget[c.line] };
    case "eventChoice": {
      const e = EVENT_BY_ID.get(c.eventId)!;
      const alt = e.choices.findIndex((ch, i) => i !== c.choice && choiceAvailable(snapshot, ch));
      return alt >= 0 ? { ...c, choice: alt } : null;
    }
    default: return c;
  }
}

export interface Replay { actual: TurnRecord[]; alternative: TurnRecord[]; description: string }

/**
 * Re-simulate from `snapshot` (the state at the start of `snapshot.turn`) through the turns in
 * `actual.log`, with decision `d` reversed. Event choices for events that no longer fire are
 * dropped; new events in the alternative timeline take their first available choice.
 */
export function replay(snapshot: GameState, actual: GameState, d: Decision): Replay {
  let s = structuredClone(snapshot);
  const lastTurn = actual.turn;
  const resolveYearStart = () => {
    if (s.pendingEvent) {
      const e = EVENT_BY_ID.get(s.pendingEvent.id)!;
      const choice = Math.max(0, e.choices.findIndex((ch) => choiceAvailable(s, ch)));
      const r = applyCommand(s, { type: "eventChoice", eventId: e.id, choice });
      if (r.ok) s = r.state;
    }
    if (s.status === "reckoning") {
      const r = applyCommand(s, { type: "reform", id: actual.reckonings.find((x) => x.turn === s.turn)?.chosen ?? "none" });
      if (r.ok) s = r.state;
    }
  };
  for (let turn = snapshot.turn; turn < lastTurn && s.status !== "ended"; turn++) {
    const entry = actual.log.find((l) => l.turn === turn);
    const cmds = entry ? entry.commands : [];
    for (let i = 0; i < cmds.length; i++) {
      // Replay the year day by day up to the moment the decision was made.
      while (s.day < cmds[i].day && s.status === "playing") stepDay(s);
      let c: Command | null = cmds[i].cmd;
      if (turn === d.turn && i === d.index) c = reverse(c, s);
      if (!c) continue;
      if (c.type === "reform" && s.status !== "reckoning") continue;
      if (c.type === "eventChoice" && (!s.pendingEvent || s.pendingEvent.id !== c.eventId)) continue;
      const r = applyCommand(s, c);
      if (r.ok) s = r.state;
    }
    resolveYearStart();
    if (s.status === "playing" && !s.pendingEvent) s = endTurn(s);
  }
  const from = snapshot.turn;
  return {
    actual: actual.history.filter((h) => h.turn >= from),
    alternative: s.history.filter((h) => h.turn >= from),
    description: describe(d),
  };
}

export function describe(d: Decision): string {
  const c = d.command;
  switch (c.type) {
    case "policy": return `${c.on ? "enact" : "repeal"}:${c.id}`;
    case "eventChoice": return `event:${c.eventId}:${c.choice}`;
    case "debase": return "debase";
    case "tax": return "tax";
    case "budget": return `budget:${c.line}`;
    default: return c.type;
  }
}

