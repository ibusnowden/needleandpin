// The simulation runs here so the screen never freezes (§12 performance targets).
import { endTurn, replay, setGhostData, type Decision, type GameState } from "../sim/index.ts";
import { ghostForEndings } from "../game/ghost.ts";

setGhostData(ghostForEndings());

export type WorkerRequest =
  | { id: number; kind: "endTurn"; state: GameState }
  | { id: number; kind: "replay"; snapshot: GameState; actual: GameState; decision: Decision };

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.kind === "endTurn") {
      const t = performance.now();
      const state = endTurn(msg.state);
      self.postMessage({ id: msg.id, ok: true, state, ms: performance.now() - t });
    } else {
      const result = replay(msg.snapshot, msg.actual, msg.decision);
      self.postMessage({ id: msg.id, ok: true, result });
    }
  } catch (e) {
    self.postMessage({ id: msg.id, ok: false, error: String((e as Error)?.message ?? e) });
  }
};
