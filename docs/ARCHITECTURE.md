# Architecture

This follows the engine decision in [GDD §12](GDD.md#12-tech-stack-and-engine-decision): the simulation is a separate,
pure TypeScript library. **Phaser 4** draws only the map. Everything else is ordinary web UI (**React**), localised
with **i18next + ICU**.

```
            ┌───────────────────────── browser ──────────────────────────┐
            │                                                            │
 content ──▶│  src/sim  (pure TS, deterministic, no engine imports)      │◀── src/data/ghost/*.json
 JSON       │     ▲ applyCommand()             ▲ endTurn() / replay()    │    (from scripts/data)
            │     │                            │                         │
            │  src/game/store.ts  ── postMessage ──▶ src/worker/sim.worker.ts
            │  (controller: state, UI state, snapshots, saves)           │
            │     │ subscribe()                                          │
            │     ├──────────▶ src/map/MapScene.ts   (Phaser 4 canvas)   │
            │     └──────────▶ src/ui/*.tsx          (React, HTML/CSS)   │
            └────────────────────────────────────────────────────────────┘
```

## Layers

| Layer | Path | Job |
| --- | --- | --- |
| Simulation core | `src/sim/` | Economy, prices, classes, events, scoring, bots. Pure functions of `GameState`. Deterministic: the same seed always gives the same result. |
| Content | `src/content/events.json`, `src/content/codex.json` | 43 event cards and 22 codex entries, bilingual. Writers edit these without touching code (§12). |
| Data | `scripts/data/` → `src/data/ghost/` | Python pipeline: fetch → clean → map → bundle → check (§10). |
| Controller | `src/game/store.ts` | The one source of truth that the UI and the map subscribe to. It validates commands, keeps turn snapshots for "What if?", runs the worker and handles saves. |
| Worker | `src/worker/sim.worker.ts` | Runs `endTurn` and counterfactual `replay` off the main thread (§12: the screen never freezes). It falls back to the main thread if Workers are unavailable. |
| Map | `src/map/MapScene.ts`, `palette.ts` | Isometric hex map, moving caravans and ships, smoke, catchment glow, overlays, build preview. |
| UI | `src/ui/` | Top bar, side panel, bottom bar, ghost chart, dialogs, codex, toasts, tutorial. |
| i18n | `src/i18n/` | English and Arabic (RTL). ICU plurals and select. Locale digits through `fmt()`. |

## The simulation core (`src/sim`)

| File | Contents |
| --- | --- |
| `defs.ts` | Goods (§4.1), buildings, terrain costs, policies, budget lines, taxes, the 20 institutions in 4 tracks (§6), and the model constants (§13). |
| `types.ts` | `GameState`, `Command`, `Effect`, and the rest. The whole state is plain JSON, so it can be cloned, sent to the worker and saved. |
| `rng.ts` | `mulberry32` plus `streamRng(seed, turn, purpose)`. Each purpose has its own stream, so replaying a turn with one decision changed keeps every unrelated draw identical. |
| `hex.ts` | Axial hex math. |
| `scenarios.ts` | Scenario definitions (chapters, targets, starting institutions and policies, normalisation ranges) and procedural map generation. |
| `transport.ts` | Transport graph, Dijkstra, market reach `R = Σ P·e^(−c/c0)`, `s_max`, and path finding. |
| `economy.ts` | Labour market, production chains, household demand by class and need tier, port trade, the price rule, incomes, investment. |
| `society.ts` | Treasury and debt, the four-maxims tax grades, Money Trust, population, literacy, fraud, class politics. |
| `meters.ts` | Opulence and Maslaha with per-component breakdowns (§8). |
| `events.ts` | Event engine: conditions, a weighted draw, effect interpreter. |
| `discovery.ts` | "Play first, name second" (§9): detects when an idea has been met in play. |
| `turn.ts` | `newGame` (with burn-in and calibration), the end-of-turn pipeline, private investment, invention, chapters, Reckonings, reforms, endings. |
| `commands.ts` | Every player decision, validated, logged and judged by the council. |
| `counterfactual.ts` | "What if?" replay. |
| `bots.ts` | Five strategies plus the historical autopilot. |

### Turn pipeline (`turn.ts › simulate`)

1. Apply delayed effects that are now due ("the bill arrives ten turns later").
2. Build the transport graph. Compute each workshop's reach and `s_max`, and raise specialisation where there are enough hands.
3. Labour moves toward better wages. Slack trades lay workers off.
4. Natural prices are recomputed at the prevailing wage.
5. Production runs raw goods first, then processed goods, limited by inputs. The market clears, the price rule applies, then incomes, taxes and capital.
6. Treasury, money, society, private investment (capital widening, companies building infrastructure), invention of machines.
7. Riots and revolution checks. Institution progress.
8. Meters, then discoveries.

`endTurn` wraps this. It advances the calendar, records history, checks for collapse, opens a Reckoning at the end of a chapter, decides the ending after the last one, and otherwise draws the next event.

### Commands and determinism

Every player action is a `Command`, applied through `applyCommand(state, cmd)`, which returns a new state or an error
key. Commands accumulate in `state.pending` and move to `state.log[turn]` at end of turn. The log and the per-turn
snapshots kept by the controller are what make counterfactual replay possible.

## Rendering

- The map is redrawn only when the game state, overlay or selection changes. Moving goods, ships, smoke and the hover
  cursor animate every frame on a separate `Graphics` layer, capped at 500 movers (§12).
- Colours always come with an icon: ▲ ▼ = for prices, ! for bottlenecks, ✕ for "no buyers", ↑ for "can specialise",
  and level pips. The state colours come from the Okabe–Ito palette, which is colourblind-safe (§11).
- The camera fits the whole region on start and on resize, until the player pans. Wheel or +/− zooms; drag or
  WASD/arrows pans.

## Saves

`src/game/saves.ts` is a small IndexedDB key-value store with an in-memory fallback. The game autosaves after every
turn. "Export save file" downloads the state plus snapshots as JSON; "Import" validates the format and restores it.
No account is needed (§12).

## Localisation

- `src/i18n/locales/en.json` and `ar.json` must have the same keys. Content JSON carries `{en, ar}` pairs.
- `applyDirection()` sets `<html dir>`. The CSS uses logical properties (`inset-inline-start`,
  `border-inline-start`, …), so the whole HTML layer mirrors for Arabic. The map stays geographic.
- `fmt()` formats numbers in the active locale (Arabic-Indic digits for Arabic).

## Performance (measured)

| Target (§12) | Measured |
| --- | --- |
| First load < 5 MB | ≈ 0.6 MB gzipped (Phaser chunk 357 KB, app 211 KB) |
| End-of-turn < 200 ms | 8–15 ms for Britain (≈ 400 hexes, 45–60 buildings) on a laptop; enforced by a Vitest test |
| 60 fps, 500 moving units | Movers capped at 500; static layers are not redrawn per frame |
