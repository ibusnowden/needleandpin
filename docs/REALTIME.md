# Real-time logistics

This resolves GDD §14's open question ("real-time or turn-based on the map?") as **pausable real time**. All the GDD's
systems stay: chapters, Reckonings, events, reforms, the meters, the ghost of history and the endings. What changes is
that goods now exist physically on the map. The aim is Factorio's satisfaction of watching a network work, and of
fixing it when it doesn't, while keeping the GDD's principle that the player sets conditions and does not command
individual citizens.

## Time

- One game year is 360 days. At 1× speed it lasts one real minute (6 days per second). The speeds are pause, 1×, 2×
  and 4×.
  - Keys: Space pauses and resumes, `.` speeds up, `,` slows down. "Skip to year end" (E) fast-forwards.
- The economy runs **every day**. The **monthly** settlement covers wages and accounts, labour moves, natural prices
  and household demand. **Each quarter**, workshops check whether their market reach allows another level of
  specialisation. **Each year** closes with taxes, money, society, private investment, institutions, meters,
  discoveries and the next event card. Events, Reckonings and endings pause the game.
- Taxes are collected on actual purchases as they happen, not at a settlement tick. That avoids the
  "lower taxes all year, raise them before collection" exploit that simgrammar's taxation page warns about.

## The daily loop (`src/sim/rt.ts › stepDay`)

1. **Produce.** Each workshop runs the §13 production function, limited by its input store (see "Workshops" below).
2. **Ship.** Finished goods leave the output store one cart at a time. Each cart goes to the town market that pays
   best after carriage, or abroad through a port if the world price is better.
3. **Order.** Workshops keep about 25 days of inputs (and tools) in store. They buy from the market that sells cheapest
   after carriage, and a cart brings the goods.
4. **Merchants.** Merchants carry goods from cheap markets to dear ones when the price difference pays for the
   journey. Wider gaps bring bigger lots. This is Ghazali's account of how merchants arise: "and so markets and
   storehouses appeared" (*Ihya'* 3:227).
5. **Imports.** Dear markets with a port in reach send for imports. Spices only ever arrive by sea.
6. **Move carts.** Carts move along their paths (see "Roads, capacity and jams" below).
7. **Households buy** from their own town's market (see "Markets and prices" below).
8. **Prices.** Each town's prices move toward a target set by its stock (see below).

## Workshops

Each workshop has an input store, goods on the way, an output store (blocked when full) and a status:

| Status | Meaning |
| --- | --- |
| Working | Producing normally |
| Waiting for X | Starved of an input (red "!" on the map) |
| No buyers | Goods pile up at the door (✕) |
| Idle | No workers |

- **Tools link the crafts.** Farms, pastures, lumber camps and mines wear out tools at 0.25 tools per worker-year.
  Without tools they work at 60%. The farmer needs the smith's tools, and the smith needs the farmer's bread. That is
  the interdependence Ghazali describes (*Ihya'* 4:120).
- **The bottleneck explainer.** A stalled workshop's panel traces the cause upstream in one sentence, with a "Show me"
  link (`explainShortage`):

| Cause found | What the panel says |
| --- | --- |
| No maker | "Nobody makes iron ore. Build an iron mine." |
| Makers starved upstream | "No market has tools: 2 of the 3 workshops that make it are themselves waiting for iron ore." |
| Makers cut back | Its makers can't sell, so they reduced output |
| No road | No road links this workshop to any market |
| Too far | The nearest stock is N days away |
| Stuck in a jam | Carts carrying the input are held up in traffic |
| On its way | The input has been ordered and is coming |

  simgrammar's "bottleneck explainer" opportunity motivated this: "starvation far upstream is hard to diagnose without
  flow statistics, so players blame the wrong building."

## Roads, capacity and jams

- **Travel time.** Each tile costs days to cross:

| Tile | Days per tile |
| --- | --- |
| Open land | Terrain cost (plains 1 day) |
| River | 0.55 |
| Road | 0.32 |
| Canal | 0.18 |
| Rail | 0.08 |
| Sea lane, port to port | 0.12 |

- **Capacity.** Each tile also has a daily capacity: the number of carts that can enter it per day.

| Tile | Carts per day |
| --- | --- |
| Open land | 3 |
| River | 8 |
| Road | 14 |
| Canal | 24 |
| Railway | 48 |
| Towns, buildings, sea | Unlimited |

- **Jams.** A cart that finds its next tile full waits. Queues form, waiting carts turn red, and the **Traffic and
  jams** overlay shows flow and jams on every tile. Widening a busy route, or laying a canal or railway, is the fix.
  This is the logistics puzzle.
- **Network changes.** Building or demolishing reroutes the carts already in flight.
- **Carriage.** Carriers are paid 0.012 × the reference wage per unit per day of travel (as laborers' income). Distance
  therefore has a real price, and Smith's extent of the market shows up as delivered cost.

## Markets and prices

- **Every town is a market with its own stock and prices.** The national price shown in the market table is the
  population-weighted average.
- **Price target.** The target price is `natural × (cover)^−0.45`, clamped between 0.4× and 3.5× natural, where
  `cover = stock ÷ (20 days × daily demand)`. That is simgrammar's stock-based rule, `p = base × f(stock / target)`.
  The price moves 3.5% of the way to the target each day.
- **Why the gain is low.** A higher gain made prices oscillate in boom-bust cycles. simgrammar names exactly this
  failure: "High gain causes price oscillation and boom-bust cycles that players read as random."
- **Elasticity sets the level.** Flattening the elasticity changes where prices settle, not just how fast. It was
  tried and pushed real wages to twice history, so the elasticity stays at −0.45.
- **Hard limits.** A legal bread price cap is a hard ceiling. A pin monopoly holds pins at 1.6× natural or above.

## Calibration levers added for real time

| Lever | Value | Grounding |
| --- | --- | --- |
| Per-craft specialisation gain `m(s) = base^(s−1)` | pins 1.6, tools 1.55, cloth 1.5, housing 1.25, bread 1.22, ore 1.2, timber 1.15, grain/wool 1.12 | Smith I.1: agriculture "does not admit of so many subdivisions of labour… as manufactures" |
| Diminishing returns on land | land yields × (pop/pop₁₇₇₆)^−0.3 | Ricardo and Malthus: more people on the same land |
| Ricardian rent share | 0.18 × (pop/pop₁₇₇₆)^0.8, capped at 0.4 | Rent rises as land becomes scarce |
| Starting debt | 11.5 years of revenue | Britain 1775: about £127m of debt against about £11m of revenue |
| Interest premium | 0.2 points per year of revenue beyond 14 | Lenders judged the ability to service debt |

The results are in [BALANCE.md](BALANCE.md).

## Rendering

The map draws the simulation's actual carts, on the tiles where they really are, moving smoothly within the day:
- ox carts on land, or camel caravans in the Caravan-era tutorial;
- barges on canals and rivers;
- dhows at sea.

A coloured bale shows each cart's cargo. Workers animate only while their workshop is working and the clock runs. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the sprite pipeline.

## Performance

A Britain year (360 days with 60–180 buildings and up to a few hundred carts) simulates in about 0.15 s, so 1×–4× play
uses a small fraction of a frame. The real-time loop runs on the main thread in whole-day steps. The Web Worker is
still used for "What if?" replays. Shortest-path trees are cached per network version.

## Interface: factory-game conventions, original content

The chrome borrows the *grammar* of factory games and keeps the game's own ideas, art and texts. The reference was the
look of Factorio's UI (studied from the "Breaking PRNG" save and its repository); no assets, layouts or code were copied.

| Convention | Here |
| --- | --- |
| Dark metal panels, bevelled buttons | Iron panels with brass bevels and a khatam (eight-point star) inlay band; reading surfaces (codex, events, dialogs) stay on parchment |
| Inventory slots with a count in the corner | Every good has an inked icon (`src/art/icons.ts`). The market shows stock as the count and price vs natural as a tag (red dear, blue cheap) |
| Numbered hotbar | Build tools show the illustrated building, its hotkey (1–9) and cost |
| Entity window: inputs → progress → output | A workshop shows input slots (red ring = the missing one), a progress bar, the output slot, the worker roster and level pips, then the bottleneck explainer |
| Alerts column | Top-left of the map: workshops waiting for inputs, workshops with no buyers, jammed roads, towns short of bread. Click to cycle through them on the map |
| Production statistics (P) | Monthly made vs used per good, annualised, for the last ten years (`s.stats`, recorded in `rt.ts › month`) |

The codex has a second tab, **How the model works** (`src/content/model.json`): every formula, where it lives in the
code, where it comes from, and whether it is from the GDD, standard economics, a thinker's idea turned into our rule,
or tuned to history.
