# Balancing and calibration

> **Real-time model (current, branch `realtime-logistics`).** Historical autopilot, 8 seeds, comparing 5-year means
> against history's 5-year means (in the daily model a single year mostly measures where the inventory cycle is):
>
> | Checkpoint | GDP per capita | Real wage |
> | --- | --- | --- |
> | 1790 | 106% | 97% |
> | 1800 | 98% | 94% |
> | 1820 | 104% | 99% |
> | 1835 | 97% | 86% |
> | **1850** | **89%** | **97%** |
>
> Both 1850 values are **inside the ±15% band**, and every checkpoint is within 15%. The levers added for the real-time
> model are listed in [REALTIME.md](REALTIME.md#calibration-levers-added-for-real-time). The bot results and targets
> are in the "Real-time bots" section at the end. The turn-based figures below are kept for the record.

The method follows [GDD §13](GDD.md#13-simulation-math-and-balancing). Everything runs headless on the simulation core:

```sh
npm run balance -- autopilot 20          # historical autopilot vs the ghost band (exit 1 if outside)
npm run balance -- bots 30               # five strategies × 30 seeded games, Britain 1776
npm run balance -- bots 10 needle        # same for the tutorial
```

A Britain game takes about 0.3 s, so the GDD's "2,000 games per scenario overnight" is `npm run balance -- bots 2000`.

## 1. Historical autopilot (calibration, §10)

`src/sim/bots.ts`, bot `historical`. It plays the real historical policies:
- It keeps Britain's 1776 laws: Corn Law, Navigation Acts, guild rules, tolls, religious tests.
- On history cards it takes the choice Britain actually made (`HISTORICAL_CHOICE`). Otherwise it takes the council's
  consensus.
- It adopts institutions no earlier than their real dates: canals 1785, joint-stock 1825, railways 1826 and only once
  steam technology exists, Factory Acts 1830, central bank 1840.
- It raises excise and land tax when in deficit.
- It builds nothing itself. Private capital (the invisible hand) builds the workshops, turnpikes, canals and railways.

Requirement: within **±15% of actual GDP per capita and real wages by 1850**.

**Latest result** (20 seeds, mean ratio to history):

| Year | GDP per capita | Real wage |
| --- | --- | --- |
| 1790 | 106% | 107% |
| 1800 | 96% | 127% |
| 1820 | 92% | 95% |
| 1835 | 86% | 84% |
| **1850** | **86%** | **97%** |

Both 1850 values are inside the band. Known deviation: the model has no wartime food-price shock, so around 1800 (the
dearth of 1795–1801) real wages run about 27% above Allen's series.

The autopilot finishes with Opulence ≈ 49 and Maslaha ≈ 73, well below Britain's targets (79/86). History itself does
not win this scenario: you have to beat it.

## 2. Bot strategies (§13 targets)

| Bot | Plays | Target | Latest (30 games) |
| --- | --- | --- | --- |
| Balanced | Moderate taxes, repeals tolls, guild rules, Corn Law and tests; funds all duties; builds schools, courts and ports | ≈ 60% | **63%** |
| Mercantilist | 38% customs, Corn Law, Navigation Acts, pin monopoly, heavy defence | < 15% | **0%** |
| Debaser | Debases whenever money is short and the coin still passes | < 5% | **0%** |
| Free Trader | Customs 4%, repeals all restrictions, roads and ports; ignores relief and schooling | ≤ 75% | **10%** (mostly Gilded Age) |
| Pious Steward | Relief, education and justice at 12%; hisba; partnership houses | ≤ 75% | **43%** (otherwise Pious Stagnation) |

No strategy wins more than 75%. The losers lose in the ways the GDD intends: free trade without Maslaha ends Gilded,
piety without growth ends in Stagnation, mercantilism and debasement end in Decline or Collapse.

Britain targets: **Opulence 79, Maslaha 86** (`src/sim/scenarios.ts`).

## 3. Levers that were tuned, and why

| Lever | Value | Reason |
| --- | --- | --- |
| `R0` (Britain) | 70 | London's 1776 reach allows level 2–3 (Smith's pin factory existed); turnpikes, canals and ports unlock level 4–5. |
| Burn-in | ≥ 24 turns and until no level-ups for 6 turns | 1776 must start at the model's equilibrium, or turn 1 shows a spurious boom. |
| Invention rate | 0.0014/yr base | Late-period acceleration (1820–1850) without overshooting before 1800. |
| Malthusian response | 0.9 percentage points of growth per +100% real wage | Population absorbs part of wage gains ("Engels' pause"). |
| Partnership efficiency | 0.90 (banks 1.05 + cycle) | "Slower growth, fewer crashes" (§4.7). |
| Debasement memory | −6 trust home and −12 Property per debasement for 20 turns | Repeated debasement must not pay (Debaser < 5%). |

## 4. Playtest metrics to collect (§13)

These need real players: median session length, the turn of the first "Discovered" toast (target under 5 minutes; the
tutorial fires its first in turn 1–2), and the share of players who open at least one "Why?" button (target over 50%).
The game doesn't send telemetry yet. That needs a privacy decision first.

## Real-time bots (current)

Five strategies × 12 seeded Britain games on the final real-time code (`npm run balance -- bots 12`). The harness saves
every game (`scripts/.balance-britain1776.json`) and searches for the most demanding target pair that meets §13:

| Bot | Win rate at targets 65 / 83 | §13 target |
| --- | --- | --- |
| Balanced | 58% | ≈ 60% |
| Pious Steward | 50% | ≤ 75% |
| Free Trader | 17% (mostly Gilded Age) | ≤ 75% |
| Mercantilist | 0% (Decline) | < 15% |
| Debaser | 0% (a quarter go bankrupt) | < 5% |

Britain targets: **Opulence 65, Maslaha 83**. Caveat: the targets were chosen in-sample from these 12 games per
strategy. Confirm them on a larger, independent seed set (`npm run balance -- bots 100`) before launch.

**Design finding.** In the real-time model the Pious Steward (relief, schooling, justice, partnership finance) gives
up almost no Opulence to the Balanced player: 66 vs 64 mean. GDD §8 intends "High Maslaha, low Opulence" to mean
"rivals outgrow you". Rivals are out of MVP scope, so that pressure is missing. When rival nations arrive (version 1),
re-check this strategy.

The bots were also made realistic: they set their tax stance once and then manage deficits yearly by raising taxes and
trimming discretionary spending. Without that, every strategy went bankrupt under Britain's 1776 debt of about 11.5
years of revenue.
