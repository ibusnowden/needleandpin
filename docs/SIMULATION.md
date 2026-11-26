# The simulation model

The model is deliberately small ([GDD §13](GDD.md#13-simulation-math-and-balancing)). Each mechanism below names the
idea it comes from, the code that implements it, and the constants it uses. All values are tuning defaults
calibrated against history (see [BALANCE.md](BALANCE.md)).

## Units

The simulation runs in abstract units: one "worker" is a work team, and prices are measured against a reference wage.
At turn 0, `newGame` sets three conversion factors so the start matches history exactly (§10):

- `gdpScale`: simulated real output per head → 2011 international $ (Maddison GBR 1776 = $2,962).
- `wageScale`: simulated welfare ratio → Allen's London labourers' welfare ratio (1776 = 1.298).
- `popScale`: simulated population → displayed population (1776 ≈ 12 million, marked *estimated*: Maddison has no
  1776 value).

From then on, every change comes from the model, so beating the ghost line is the player's doing.

## Production with division of labour (§4.2)

```
Y_w = L_w · b_g · m(s_w) · (1 + θ·K_w/L_w)^α · land · technology · util
m(s) = 1.6^(s−1)        θ = 0.5 (×1.3 at level ≥ 4)   α = 0.3
```

`economy.ts › produce`. A level-5 workshop is 6.55× as productive per worker as level 1. Smith's own numbers are far
larger; the game compresses them for balance. Smith's three advantages are traits: **dexterity** (from level 2,
included in m(s)), **no time lost switching** (from level 3, 10% less material per unit), and **invention of machines**
(from level 4: a stronger capital effect, and level-4+ shops drive technical progress).

A level-s workshop needs `3·s` hands to move up a level. Its capacity is `round(3.6·s) + 2` workers.

## Extent of the market (§4.3)

```
R_w = (Σ_j P_j · e^(−c_wj / c0) + foreign) · (Trust/100) · barter · (1 − hoarding/2)
s_max = min(5, 1 + ⌊log₂(R_w / R0)⌋)         c0 = 4
```

`transport.ts › reachFrom, maxLevelFor`. Transport cost `c` is a Dijkstra distance over hexes:

| Hex | Cost to enter |
| --- | --- |
| Plains / fertile | 1 |
| Forest | 1.6 |
| Hills | 2.2 |
| Mountains | 4 |
| River | 0.55 |
| Road | 0.32 (×1.25 with tolls) |
| Canal | 0.18 |
| Rail | 0.08 |
| Sea lane (port to port only) | 0.12 (×0.7 with Merchant shipping) |

All land costs are multiplied by `(1 + 0.8·banditry)`, and by 1.3 with road tolls. Foreign markets are reached through
the cheapest port: `pop_foreign · e^(−(c_port + seaCost)/c0)`. Customs and the Navigation Acts shrink that term,
because rivals retaliate. `barter = 0.5` until Coinage. Market squares count town populations at ×1.2.
`R0` is set per scenario: 30 for the tutorial, 70 for Britain.

## Prices (§4.4)

```
p(t+1) = p(t) · (1 + λ·(D − S)/S) + μ·(p* − p(t))        λ = 0.3, μ = 0.15
```

`economy.ts › runMarket`. `S` is the quantity *brought to market*: this turn's output and imports, plus 30% of any
stock above a working inventory of a quarter of a turn's offtake. A depleted store pushes the price up.

The **natural price** `p*` is the input cost plus labour at the prevailing wage divided by the labour share (0.7), using
*potential* output per worker (`realNaturalPrices`). The prevailing wage is smoothed and half anchored to the coin
(`updateNaturalPrices`). So a sudden inflation first appears as prices above natural, and wages catch up over several
turns.

A **price cap** on bread pins it at its natural price. Unmet demand becomes a shortage, which feeds fraud (the black
market). A **monopoly** on pins forces `p ≥ 1.6·p*` and cuts output to 70%. A price with nothing on the market is capped
at 4× natural.

**Producer response.** Each good has a capacity utilisation `util` that moves 35% per turn toward a target. The target
is 1 when the price is at or above natural, and falls when the price is cheap (below 95% of natural) or unsold stock
piles up. Slack trades lay off half their slack each turn.

## Labour: the invisible hand (§13)

`economy.ts › moveLabor`. Workforce is 45% of population. Each turn workers quit when:
- the shop is over capacity;
- its wage is below the average: `η·L·gap`, with `η = 0.25 · (0.6 + literacy)`, ×0.4 under guild rules;
- the wage is below subsistence;
- the trade has slack.

The pool of idle workers is hired in proportion to `capacity gap × (wage − subsistence)`. Idle workers earn a
subsistence income of 0.45.

## Demand by class and need tier (§4.6, Ghazali's three levels)

`economy.ts › runMarket`. Each class spends last turn's income, so demand lags income by one turn.

1. **Necessities** (bread, then fuel, cloth, housing, in order of urgency) are bought per head from what is actually on
   offer: `BASKET = {bread 0.9, timber 0.3, cloth 0.12, housing 0.12}`.
2. **Comforts and luxuries** take what is left, in class-specific shares:

| Class | Pins | Cloth | Housing | Tools | Bread | Spices | Savings rate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Laborers | 28% | 26% | 20% | 8% | 12% | 6% | 4% |
| Merchants | 12% | 20% | 25% | 8% | — | 35% | 38% |
| Landlords | 8% | 17% | 30% | — | — | 45% | 10% |

Hoarded coin buys nothing: every class's spending is scaled by `1 − 0.6·hoarding`.

## Incomes and national accounts

Wages are paid on value added from *production*: unsold output is inventory investment and still part of GDP. Profits
are paid on what actually *sold*, so a glut hits the masters. Value added splits into wages (`laborShare = 0.7`), rent
(18% of value added for land goods, 25% for builders) and profit (the rest).

Public spending is paid out the following turn: 70% to laborers and 30% to merchants. Relief goes to the poor. Interest
on the debt goes 60% to merchants and 40% to landlords. Collection costs are paid as officers' wages. Founding
workshops and companies pays builders' wages and buys timber and tools. With every flow recycled, income equals final
sales. `tests/sim` and the audit used in development check this circular flow.

Real GDP is the sum of each good's output minus its inputs, valued at base-period prices.

## Capital accumulation (§13)

```
K(t+1) = (1 − δ)·K(t) + investment          δ = 0.05
```

Savings × finance efficiency becomes investment:

| Condition | Efficiency |
| --- | --- |
| Default | 0.85 |
| Interest banks | 1.05 + credit cycle |
| Partnership houses | 0.90 |
| Money Trust < 50 | lower |
| Merchant satisfaction < 25 (capital flight) | ×0.6 |

A share of investment, `widen = 0.3 + 6 × idle share` (capped at 0.7), founds new workshops and companies. That is
capital *widening*. The rest buys tools, which become capital in the shops with the best profit rates. That is
capital *deepening*.

**Private investment** (`turn.ts › privateInvestment`) is the invisible hand building. Merchants found up to three
workshops a turn, next to the largest towns, in trades that are dear and running near capacity, or that are not
glutted while hands stand idle. Companies (turnpike trusts, canal and railway companies) then upgrade the busiest
town-to-town routes with the best works they can afford.

**Invention of machines** (`turn.ts › inventMachines`): each year, technology grows by
`0.0014·(0.4 + 3·share of workers in level-4+ shops + share in level-3 shops)·(0.4 + literacy)`, ×1.5 with learned
societies. Invention events (the spinning jenny, steam) add one-off jumps. Railways require technology ≥ 1.12.

## Real wage (§8, §13)

```
W_real = (laborer income per worker) / (basket cost per family)
```

This follows the welfare-ratio method of the wage data, so the player's number can be compared directly with the
ghost line.

## Money Trust (§4.5)

`society.ts › runMoney`.
- **Recovery.** Trust moves toward home (80; 85 with a central bank) by at most 3 points a turn, but not in a turn with
  a debasement. Home drops 6 points for each debasement in the last 20 turns: the market remembers.
- **Debasement.** −26 trust, +25% pending inflation released at 40% per turn, and +60% of revenue to the treasury now.
- **Drift.** Trust below 60 adds price-level drift. Fraud above 0.4 erodes trust.
- **Hoarding.** `hoarding → (45 − trust)/90`, capped at 0.5.
- **Credit cycle** (interest banks only). Credit rises each turn while trust is high; above 0.35 it busts to −0.3 and
  a bank-run event becomes likely.

## The sovereign (§4.8)

The budget is five shares of last turn's revenue. Each line's *adequacy* is its spending divided by what the duty needs,
as a share of output: defence 3%, justice 1.2%, works 1.5%, education 1.2%, relief 1%.

| Line | Effect |
| --- | --- |
| Defence | Banditry → 0.03 + 0.32·(1 − adequacy) |
| Justice | Justice coverage = 0.45·adequacy + 0.55·(share of people within 4 hexes of a courthouse) |
| Works | Cheaper infrastructure |
| Education | Literacy target 0.12 + 0.42·adequacy + 0.22·school coverage (+ institutions) |
| Relief | Fills the granary while grain is cheap and releases it when bread exceeds 1.3× natural |

**Taxes.** There are four rates (land, excise on necessities, excise on comforts and luxuries, customs) and a choice of
collection by salaried officers (6% cost) or tax farmers (18%, less certainty, more fraud). Each active tax adds 1% to
collection cost. Excise passes through to buyers: 85% of necessity excise falls on laborers. Customs above 25% breed
smuggling at `2·(customs − 0.25)`.

**Four-maxims grades** (`society.ts › taxGrades`):

| Maxim | Graded on |
| --- | --- |
| Equality | Laborers' share of the tax burden against their share of income |
| Certainty | Tax farming, and tax changes in the last 5 turns |
| Convenience | Smuggling, heavy excise on necessities, and land tax above 30% |
| Economy | Collection cost |

**Debt.** Deficits are borrowed automatically. The interest rate is the scenario base, plus a premium for debt above
120% of GDP, plus a premium for low trust. Interest above 75% of revenue for 3 turns means state bankruptcy.

## Classes (§4.6)

`society.ts › runSociety`. Satisfaction moves 35% per turn toward a target built from what each class wants:

- **Laborers:** necessities secured, real wage, employment, schooling, honest markets, tax equality.
- **Merchants:** profit rate, tax burden, monopoly, protection, trust, tax certainty.
- **Landlords:** rent per head, land tax, Corn Law, security.

What happens when a class is ignored:
- Laborers below 25 riot (capital destroyed, institution trust falls). Three turns below 12 is revolution.
- Merchants below 25 means capital flight.
- Landlords below 25 halve institution progress, and they block Corn Law repeal while they are influential.

## Population (§8)

Growth per year is `0.006·min(1, housing + 0.3) + 0.009·clamp(real wage relative to start − 1)`, which is Malthus: wage
gains are partly absorbed by population.
- **Famine:** deaths are `0.25 × (0.86 − share of bread demand met)`. They are softened by a stocked granary, and above
  6% the nation collapses.
- **Emigration** follows despair: laborers below 30, or Opulence running 25+ points above Maslaha.
- Growth goes mainly to towns with better mood.

## Scoring (§8)

`meters.ts`. Each component maps to 0–100 on a log scale between scenario bounds.

**Opulence**

| Component | Weight |
| --- | --- |
| Real wage | 35% |
| GDP per head | 25% |
| Capital per worker vs start | 15% |
| Share of people in well-connected markets | 15% |
| Trade per head vs start | 10% |

A small "impartial spectator" bonus of +2 applies when fraud is below 0.15 and trust above 70 (§15 G).

**Maslaha**, 20% each:

| Component | Measures |
| --- | --- |
| Life (nafs) | Necessities secured × how comfortably the poorest can afford a decent basket, minus famine |
| Intellect ('aql) | Literacy |
| Lineage (nasl) | Wages, employment, housing, relief, child welfare (Factory Acts) |
| Property (mal) | Trust, honest markets, justice coverage, minus 12 points per recent debasement |
| Faith & ethics (din) | Institution trust, honest markets, freedom of worship. It never measures which religion a nation follows. |

**Good Society:** both meters at or above max(60, target) gives +25% institution progress and 30% fewer crises.

## Endings (§8)

| Ending | Condition |
| --- | --- |
| Golden Age | Both meters above target, and the ghost beaten (mean of GDP and real-wage ratios to history ≥ 1) |
| Gilded Age | Opulence above target, Maslaha below (also: both above target but history not beaten) |
| Pious Stagnation | Maslaha above target, Opulence below |
| Decline | Both below target |
| Collapse | Revolution, bankruptcy or famine |

Beating the ghost by 25% or more earns a medal.

## Known simplifications

These are deliberate, and documented so that experts can judge the model (GDD §14 risks):

- One national pool for goods and labour. Distance acts through market reach, which caps specialisation, and through
  transport of foreign trade, not through local prices.
- No rival AI, and foreign markets are a single off-map partner. Rivals are out of MVP scope (§14).
- Ten goods. Coal and iron are folded into "ore", and cotton into "wool/cloth".
- Starting literacy (Britain 1776: 45%) and population are estimates. The ghost uses only observed or interpolated
  series.
