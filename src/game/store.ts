// Game controller: the single source of truth the map and the UI both subscribe to.
// The simulation core stays pure; this layer adds UI state, the worker bridge, snapshots for
// counterfactual replay, and saves (§12: IndexedDB in the browser, export/import as a file).
import {
  applyCommand, endTurn as endTurnSync, newGame as newGameSync, replay as replaySync, setGhostData,
  type BuildingType, type Command, type Decision, type GameState, type Infra, type Replay, type ScenarioId,
} from "../sim/index.ts";
import { ghostForEndings } from "./ghost.ts";
import * as db from "./saves.ts";

setGhostData(ghostForEndings());

export type Tool =
  | { kind: "inspect" }
  | { kind: "build"; building: BuildingType }
  | { kind: "infra"; infra: Infra }
  | { kind: "demolish" }
  | { kind: "foundTown" };

export type Overlay = "none" | "reach" | "prices" | "wages" | "mood";

export type Modal =
  | { kind: "title" }
  | { kind: "event" }
  | { kind: "reckoning" }
  | { kind: "ending" }
  | { kind: "codex"; entry?: string }
  | { kind: "tax" }
  | { kind: "budget" }
  | { kind: "institutions" }
  | { kind: "meter"; meter: "opulence" | "maslaha" }
  | { kind: "policy"; id: string }
  | { kind: "ghost" }
  | { kind: "menu" }
  | { kind: "help" }
  | null;

export interface Toast { id: number; kind: "discovery" | "error" | "info"; key: string; vars?: Record<string, string | number> }

export interface UiState {
  tool: Tool;
  overlay: Overlay;
  selected: { q: number; r: number } | null;
  hover: { q: number; r: number } | null;
  modal: Modal;
  toasts: Toast[];
  busy: boolean;
  lastTurnMs: number;
  textScale: number;
  whatIf: Replay | null;
}

export interface Snapshot { turn: number; state: GameState }

type Listener = () => void;

class Controller {
  state: GameState | null = null;
  ui: UiState = {
    tool: { kind: "inspect" }, overlay: "none", selected: null, hover: null, modal: { kind: "title" },
    toasts: [], busy: false, lastTurnMs: 0, textScale: 1, whatIf: null,
  };
  /** State at the start of each recent turn (before its commands) — for "What if?" (§9). */
  snapshots: Snapshot[] = [];
  private listeners = new Set<Listener>();
  private version = 0;
  private worker: Worker | null = null;
  private pending = new Map<number, (v: unknown) => void>();
  private nextReq = 1;
  private toastId = 1;

  constructor() {
    try {
      this.worker = new Worker(new URL("../worker/sim.worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (ev) => {
        const cb = this.pending.get(ev.data.id);
        if (cb) { this.pending.delete(ev.data.id); cb(ev.data); }
      };
      this.worker.onerror = () => { this.worker = null; };
    } catch {
      this.worker = null; // fall back to the main thread
    }
  }

  subscribe = (l: Listener) => { this.listeners.add(l); return () => this.listeners.delete(l); };
  getVersion = () => this.version;
  private emit() { this.version++; for (const l of this.listeners) l(); }

  setUi(patch: Partial<UiState>) { this.ui = { ...this.ui, ...patch }; this.emit(); }

  toast(kind: Toast["kind"], key: string, vars?: Toast["vars"]) {
    const t: Toast = { id: this.toastId++, kind, key, vars };
    this.ui = { ...this.ui, toasts: [...this.ui.toasts.slice(-4), t] };
    this.emit();
    setTimeout(() => {
      this.ui = { ...this.ui, toasts: this.ui.toasts.filter((x) => x.id !== t.id) };
      this.emit();
    }, kind === "discovery" ? 7000 : 4000);
  }

  // ------------------------------------------------------------ game lifecycle
  newGame(scenario: ScenarioId, seed = Math.floor(Math.random() * 1e9)) {
    this.state = newGameSync(scenario, seed);
    this.snapshots = [{ turn: 0, state: this.state }];
    this.setUi({ modal: null, selected: null, tool: { kind: "inspect" }, whatIf: null });
    void this.autosave();
  }

  command(cmd: Command): string | null {
    if (!this.state) return "noGame";
    const r = applyCommand(this.state, cmd);
    if (!r.ok) {
      this.toast("error", `error.${r.error}`);
      return r.error;
    }
    this.state = r.state;
    this.flushDiscoveries();
    if (cmd.type === "eventChoice") this.ui = { ...this.ui, modal: null };
    if (cmd.type === "reform") this.ui = { ...this.ui, modal: null, whatIf: null };
    this.emit();
    return null;
  }

  private flushDiscoveries() {
    const s = this.state;
    if (!s || !s.newDiscoveries.length) return;
    for (const id of s.newDiscoveries) this.toast("discovery", "toast.discovered", { id });
    this.state = { ...s, newDiscoveries: [] };
  }

  private call<T>(msg: Record<string, unknown>): Promise<T> {
    const id = this.nextReq++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve as (v: unknown) => void);
      this.worker!.postMessage({ id, ...msg });
    });
  }

  async endTurn() {
    const s = this.state;
    if (!s || this.ui.busy) return;
    if (s.pendingEvent) { this.setUi({ modal: { kind: "event" } }); return; }
    if (s.status !== "playing") return;
    this.setUi({ busy: true });
    const t = performance.now();
    let next: GameState;
    try {
      if (this.worker) {
        const r = await this.call<{ ok: boolean; state?: GameState; error?: string }>({ kind: "endTurn", state: s });
        if (!r.ok || !r.state) throw new Error(r.error);
        next = r.state;
      } else {
        next = endTurnSync(s);
      }
    } catch (e) {
      this.setUi({ busy: false });
      this.toast("error", "error.sim", { msg: String((e as Error).message) });
      return;
    }
    this.state = next;
    this.snapshots.push({ turn: next.turn, state: next });
    if (this.snapshots.length > 16) this.snapshots.shift();
    this.flushDiscoveries();
    const modal: Modal = next.status === "ended" ? { kind: "ending" } : next.status === "reckoning" ? { kind: "reckoning" } : next.pendingEvent ? { kind: "event" } : null;
    this.setUi({ busy: false, lastTurnMs: performance.now() - t, modal });
    void this.autosave();
  }

  /** "What if?" — rerun from the snapshot ~10 turns back with one decision reversed (§9). */
  async whatIf(d: Decision) {
    const s = this.state;
    if (!s) return;
    const snap = [...this.snapshots].reverse().find((x) => x.turn <= d.turn) ?? this.snapshots[0];
    this.setUi({ busy: true });
    let result: Replay;
    if (this.worker) {
      const r = await this.call<{ ok: boolean; result?: Replay; error?: string }>({ kind: "replay", snapshot: snap.state, actual: s, decision: d });
      if (!r.ok || !r.result) { this.setUi({ busy: false }); this.toast("error", "error.sim", { msg: r.error ?? "" }); return; }
      result = r.result;
    } else {
      result = replaySync(snap.state, s, d);
    }
    this.setUi({ busy: false, whatIf: result });
  }

  // ------------------------------------------------------------ saves
  async autosave() { if (this.state) await db.put("autosave", { state: this.state, snapshots: this.snapshots }); }
  async save(slot = "slot1") { if (this.state) { await db.put(slot, { state: this.state, snapshots: this.snapshots }); this.toast("info", "toast.saved"); } }
  async load(slot = "autosave") {
    const data = await db.get(slot);
    if (!data) { this.toast("error", "error.noSave"); return false; }
    this.state = data.state;
    this.snapshots = data.snapshots ?? [{ turn: data.state.turn, state: data.state }];
    const s = this.state!;
    this.setUi({ modal: s.status === "ended" ? { kind: "ending" } : s.status === "reckoning" ? { kind: "reckoning" } : s.pendingEvent ? { kind: "event" } : null, selected: null });
    return true;
  }
  async hasSave(slot = "autosave") { return !!(await db.get(slot)); }
  exportFile() {
    if (!this.state) return;
    const blob = new Blob([JSON.stringify({ format: "needle-and-pin-save", version: 1, state: this.state, snapshots: this.snapshots })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `needle-and-pin-${this.state.scenario}-${this.state.year}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async importFile(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== "needle-and-pin-save" || data.state?.version !== 1) throw new Error("format");
      this.state = data.state;
      this.snapshots = data.snapshots ?? [];
      this.setUi({ modal: null, selected: null });
      this.toast("info", "toast.loaded");
    } catch {
      this.toast("error", "error.badSave");
    }
  }
}

export const game = new Controller();
// Exposed for the Playwright UI tests and for curious players in the console.
(globalThis as unknown as { needleAndPin: Controller }).needleAndPin = game;
