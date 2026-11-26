# The Needle & The Pin — Game Design Document

Nov 26, 2026 · @Ibrahim

## 1. Vision

**The Needle & The Pin** is a browser strategy game where you grow a trading city into a wealthy nation, and win only if that wealth also feeds, educates and protects your people. It runs on Adam Smith's *Wealth of Nations* (1776) and al-Ghazali's economic thought from the *Ihya' 'Ulum al-Din* (c. 1100), and it measures you against real historical data.

**One-line pitch:** *Factorio's satisfying production chains, Civilization's "one more turn", and a ghost of real history racing you on the chart.*

The title comes from the game's founding coincidence. Smith opens with a pin factory split into about 18 operations. Ghazali, roughly seven centuries earlier, describes a needle that passes through the needle-maker's hands twenty-five times, a separate task at each pass. Same insight, two civilizations, two questions: *how does a nation grow rich?* and *rich for what?*

### Design pillars

1. **Fun first, lesson second.** Every idea from the books must be a mechanic the player *feels* (a bottleneck, a price spike, a riot), never a text box to read. If a concept can't be made playable, it goes in the codex, not the game.
2. **Visible cause and effect.** Goods physically move on the map. When you build a road, you *see* the market grow and the workshops split into specialists. The economy is legible at a glance.
3. **Two lenses, one tension.** Smith's Opulence and Ghazali's Maslaha (common good) are scored separately. Maxing one while ignoring the other always backfires, but in interesting ways.
4. **History is your rival, not your script.** Real data sets the starting conditions and draws a "ghost line" of what actually happened. You can beat history, but you can't fake it.
5. **Short sessions, deep replay.** A scenario fits in 30 to 60 minutes. Random events, rival nations and different paths make each run feel different.

### Audience

- **Primary:** curious players aged 14+ who like strategy and city-builders (Civilization, Anno, Mini Metro, Frostpunk).
- **Secondary:** economics and history teachers and students, who get a classroom mode and a codex that links mechanics to chapters.
- **Platform:** desktop browser first, playable on tablet. No install, no account needed to start.

### What makes it fun

- **The specialization "click".** Watching one slow generalist workshop split into five fast specialists when your market grows is the game's signature moment.
- **Tempting bad ideas.** Debasing the coin, granting a monopoly, or slapping on a tariff gives an instant reward. The bill arrives ten turns later, and the player learns why the books warned against it.
- **Crises with real choices.** A famine pits market freedom against Ghazali's warning about grain hoarders. There's no single right answer, only trade-offs.
- **Beating the ghost.** "Britain's real wages in 1820 were X. You're at 1.3X." Real history becomes a high score.

## 2. Player fantasy and core loop

**Fantasy:** you are the steward of a small trading city that becomes a nation. You don't command individual citizens. You set the conditions (roads, money, laws, institutions) and watch millions of small choices add up to wealth or ruin. That's the "invisible hand" made playable.

The game runs on three nested loops.

### Micro loop (seconds): build and connect

Place workshops, farms, mines and markets on a hex map. Draw roads, canals and sea lanes. Goods flow along them as visible caravans and ships. Instant feedback: a bottleneck glows red, and an idle workshop shows a "no buyers" icon.

### Turn loop (one turn = 1 year early, 5 years later): decide

1. **Read the market.** Prices for each good rise or fall with supply and demand. Spikes are signals.
2. **Allocate.** Workers move toward high-paying sectors on their own. You nudge with policy: wages, guild rules, apprenticeships.
3. **Specialize.** Each workshop's division of labor level rises if its market reach allows. This is the multiplier engine.
4. **Invest or consume.** The surplus splits into savings (capital, future growth), public works, and consumption across Ghazali's three tiers: necessities, comforts, luxuries.
5. **Govern.** Pick one or two policy cards and one institution to develop. The four council advisors argue about it first.
6. **Resolve.** Events fire, rivals act, the two meters update, and the ghost line moves.

### Era loop (10 to 20 turns): transform

Each era ends with a **Reckoning**: your Opulence and Maslaha are compared with the ghost of history, a short animated "chronicle" recaps what happened, and you choose one era-defining reform (for example "open the ports" or "found a central bank") that reshapes the next era.

### Session structure

| Mode | Length | Goal |
| --- | --- | --- |
| Tutorial: *The Needle* | 15 min | A single workshop town. Learn division of labor and markets. |
| Scenario | 30 to 60 min | One historical start (for example Britain 1776) with a target year. |
| Campaign | 4 to 6 hours | Linked scenarios from Abbasid Baghdad to the modern world. |
| Sandbox | Endless | Random map, all systems, custom data. |
| Classroom | 45 min | A scenario plus a debrief screen with discussion prompts. |

## 3. Source map: from the books to the mechanics

Every core mechanic traces back to a specific idea in one of the two thinkers. The codex shows this link in-game, so a player who wonders "why does this work like that?" lands on a short plain-language summary of the source.

### Adam Smith, *An Inquiry into the Nature and Causes of the Wealth of Nations* (1776)

| Idea | Where in the book | Mechanic |
| --- | --- | --- |
| Division of labor multiplies output (the pin factory) | Book I, ch. 1 | Specialization level per workshop (section 4.2) |
| Division of labor is limited by the extent of the market | Book I, ch. 3 | Market reach caps specialization (section 4.3) |
| Money arises to solve barter's problems | Book I, ch. 4 | Coinage institution unlocks trade efficiency |
| Market price gravitates to natural price | Book I, ch. 7 | Price dynamics (section 4.4) |
| Wages, profit and rent as three incomes and three orders of society | Book I, ch. 8 to 11 | Three classes with their own demands (section 4.6) |
| Real wages of the laboring poor as the test of wealth | Book I, ch. 8 | Headline Opulence measure (section 8) |
| Capital accumulation; productive vs unproductive labor | Book II | Savings rate drives capital stock |
| Banking and paper money | Book II, ch. 2 | Bank institution, credit, bank-run events |
| The "natural progress of opulence": country, then towns, then foreign trade | Book III | Era bonuses and fragility for skipping stages |
| Critique of the mercantile system: tariffs, bounties, monopolies, colonies | Book IV | Mercantilist policy cards and the merchant lobby |
| The "invisible hand" | Book IV, ch. 2 | Workers and capital move to the best returns on their own |
| Duties of the sovereign: defense, justice, public works, education | Book V, ch. 1 | Four government budget lines |
| Four maxims of taxation: equality, certainty, convenience, economy | Book V, ch. 2 | Tax design screen with four sliders |
| Public debt | Book V, ch. 3 | Borrowing now, interest drag later |

### Al-Ghazali, mainly *Ihya' 'Ulum al-Din* (Revival of the Religious Sciences, c. 1100)

| Idea | Mechanic |
| --- | --- |
| Division of labor and cooperation (the needle's twenty-five passes through the needle-maker's hands, *Ihya'* 4:119) | Shares the specialization engine; the tutorial starts here |
| Markets arise naturally because people need each other's products | Towns and markets grow from need; trade emerges, not decreed |
| Three levels of need: necessities (*daruriyyat*), comforts (*hajiyyat*), luxuries (*tahsiniyyat*) | Consumption tiers; the necessity tier feeds Maslaha |
| *Maslaha*: protecting faith, life, intellect, lineage (family) and property | The five components of the Maslaha meter |
| Money as a measure and "mirror" of value; hoarding and debasing it is injustice | Money Trust stat; debasement and hoarding mechanics (section 4.5) |
| Ethics of the trader: honesty, no fraud, fair weights | Merchant reputation; fraud lowers it and raises trade costs |
| Hoarding staple foods (*ihtikar*) to raise prices is condemned | Famine events with grain speculators |
| The market inspector (*muhtasib*, the *hisba* office) | An institution that fights fraud and hoarding, with an overreach risk |
| Prohibition of usury (*riba*); partnership and profit-sharing contracts | Two finance paths (section 4.7) |
| The ruler's duty of justice and fair, moderate taxation | Justice budget line; overtaxation drains Maslaha |

**Accuracy rules for the content team:** advisors are *inspired by* the two thinkers and speak in paraphrase, never invented quotes. Codex quotes are cited by book and chapter. Smith is quoted from the original 1776 English. Ghazali is quoted from the original Arabic (public domain, written c. 1100), using the Dar al-Minhaj critical edition as the reference text, with the team's own English translation checked against the published scholarly translations. Modern translations are never copied. Full list in section 16. Have one economic historian review the codex before launch.

## 4. Economy systems

The economy is a small, readable simulation, not a full macro model. Each system below has one job, one visible effect on the map, and one lesson.

### 4.1 Goods and production chains

About 16 goods in three tiers, each mapped to Ghazali's need levels:

| Tier | Goods | Need level |
| --- | --- | --- |
| Raw | Grain, wool, timber, iron ore, coal, cotton, salt | — |
| Staples | Bread, cloth, tools, housing | Necessities |
| Refined | Pins and needles, furniture, books, glass | Comforts |
| Luxury | Silk, spices, porcelain, clocks | Luxuries |

Chains are short (two or three steps) so they stay readable. Example: iron ore → iron → pins.

### 4.2 Division of labor (the signature mechanic)

Every workshop has a **specialization level** from 1 to 5. Level 1 is a lone generalist. Level 5 is a pin factory with every step done by a specialist. Each level visibly adds workers with distinct roles and multiplies output per worker. Smith's three reasons for the gain become three small upgrade traits: dexterity (output), no time lost switching tasks (speed), and invention of machines (unlocks the next tech).

### 4.3 Extent of the market

Specialization level can't rise above what the workshop's **market reach** supports. Reach is how many buyers it can get goods to at a sensible cost. Roads, rivers, canals, ports, safe routes, honest money and low tariffs all extend it. Bandits, tolls and debased coin shrink it. On the map, reach shows as a glowing catchment area. This one rule teaches Smith's most underrated idea: transport and trade are what make specialization pay.

### 4.4 Prices: market price vs natural price

Each good has a **natural price** (its cost of labor, capital and land at normal rates) and a **market price** that moves with supply and demand. A shortage spikes the market price, which lures workers and capital in, which raises supply, which pulls the price back down. Players learn to read spikes as opportunities. Price caps are available as a policy, and they visibly cause shortages and black markets.

### 4.5 Money and trust

- **Coinage** is an early institution. Before it, trade suffers a barter penalty.
- **Money Trust** (0 to 100) falls when you debase the coin, print too much paper, or default. Low trust raises prices, shrinks market reach and makes merchants hoard coin.
- **Debasement** is a tempting card: an instant treasury boost, then inflation and a Money Trust collapse over the next turns. Both Smith and Ghazali warn against it, so the advisors agree for once.
- **Hoarding:** when trust is low or interest is banned with no alternative, coin leaves circulation and trade slows. This is Ghazali's point that money hoarded is money failing at its job.

### 4.6 Three classes and their politics

| Class | Income | Wants | Danger when ignored |
| --- | --- | --- | --- |
| Laborers | Wages | Cheap bread, jobs, schooling | Riots, emigration |
| Merchants and masters | Profit | Low taxes, monopolies, tariffs that protect them | Capital flight, lobby capture |
| Landlords | Rent | Grain tariffs, low land tax | Blocking reforms |

Each class has a satisfaction meter and an influence meter. Smith warned that merchants often lobby against the public interest. In the game, the merchant lobby regularly proposes "helpful" monopolies and tariffs that pay off for them and hurt everyone else.

### 4.7 Finance: two paths

At the banking era, choose a dominant finance system (you can mix later):

- **Interest banking** (Smith's era of Scottish banks): fast credit growth, higher returns, boom and bust cycles, bank runs.
- **Partnership finance** (*mudaraba*, *musharaka*: profit and loss sharing, as in Islamic commercial law): slower growth, risk shared between investor and merchant, fewer crashes, stronger Maslaha.

Neither is strictly better. That's deliberate: the game presents both fairly and lets outcomes speak.

### 4.8 The sovereign: budget and taxes

The state budget has Smith's four duties as lines: **defense, justice, public works, education**. Ghazali adds a fifth, optional line: **public granaries and relief**. Taxes are set on a design screen with Smith's four maxims shown as grades (A to F). Bad tax design causes smuggling, evasion and unrest. Borrowing is allowed and charges interest every turn after.

## 5. Map, eras and scenarios

### Map

The map is a stylized hex map of **one region** (about 300 to 600 hexes), not the whole globe. Your nation starts as a city plus hinterland and grows by settling, building and trading, not by conquest. Terrain matters economically: rivers and coasts are cheap transport, mountains are expensive, fertile plains feed towns. Two to four **rival nations** share the map or sit off-map as trade partners reached by sea.

War exists but is costly and mostly defensive. Smith treated defense as the sovereign's first duty, and pirates, bandits and invasions threaten trade routes. Conquest is never the path to winning.

### Eras

| Era | Approx. dates | Key unlocks | Turn length |
| --- | --- | --- | --- |
| 1. Caravan | 750 to 1250 | Coinage, markets, *hisba*, partnership contracts | 1 year |
| 2. Guild and Port | 1250 to 1650 | Guilds, letters of credit, shipping, printing | 1 year |
| 3. Commerce | 1650 to 1800 | Banks, joint-stock companies, canals, free trade | 1 year |
| 4. Industry | 1800 to 1914 | Steam, railways, factories, public schooling, central banks | 2 years |
| 5. Modern | 1914 to today | Electricity, mass education, trade blocs, welfare | 5 years |

### Launch scenarios

Each scenario starts from real data for that place and time and has its own ghost line (section 10).

| Scenario | Start | Twist | Teaches |
| --- | --- | --- | --- |
| **The Needle** (tutorial) | A market town, abstract | One workshop, one road | Division of labor, extent of the market |
| **Abbasid Baghdad** | c. 800 | Huge trade network, coinage reforms, risk of debasement | Money, markets, *hisba* |
| **Song Dynasty Kaifeng** | c. 1050 | First paper money | Paper money and inflation |
| **Ottoman Istanbul** | c. 1550 | Guilds and price controls (*narh*) | Price caps vs market prices |
| **Britain, 1776** (flagship) | 1776 | Mercantilist laws, American colonies, early industry | Free trade vs mercantilism |
| **Modern Nation** | 1960 | Pick a real country; World Bank data drives the start | Growth, education, institutions |

The flagship scenario is **Britain, 1776**, because Smith's book was written about it and its data is the best. The Abbasid scenario is the Ghazali showcase, set in the world whose commercial life his thought drew on. (Ghazali lived c. 1058 to 1111, in the Seljuk period, so the in-game Scholar of Tus appears from that era on.)

### Campaign: *The Long Road to Opulence*

Five linked scenarios: Baghdad, Kaifeng, Istanbul, Britain, Modern. Each one's result carries a bonus or burden into the next, for example "trusted coinage tradition" or "debt-ridden treasury". It's an argument about how wealth passed between civilizations.

## 6. Institutions tree

Instead of a technology tree, players develop **institutions**, because both thinkers argue that rules, money and trust are what make wealth possible. There are 20 institutions in four tracks, one per era. A few cross-links add depth: for example, Contract courts are required for Joint-stock firms, and the Printing press makes Public schooling cheaper.

&#91;embedded content: institutions tree · 4 tracks × 5 eras\]

The Commerce-era finance fork is the one big either-or choice: interest banking or partnership houses (section 4.7). Every institution unlocks a mechanic, not just a bonus. The Hisba office lets you inspect markets, Coinage removes the barter penalty, and Canals cut the transport cost in the market-reach formula (section 13).

## 7. Advisors, events and rivals

### The council

Four advisors comment on every major decision in one or two lines. They give the game its voice, and their disagreements make the trade-offs readable. Each has a trust level. Ignore one too often and they may resign or join an opposing faction.

| Advisor | Inspired by | Voice | Typical advice |
| --- | --- | --- | --- |
| **The Scotsman** | Adam Smith | Dry, wry, patient | "Widen the market and the rest follows." |
| **The Scholar of Tus** | al-Ghazali | Calm, probing, ethical | "Wealth is a means. Is the bread honest and the coin true?" |
| **The Mercantilist** | Colbert-style economic nationalism | Charming, persuasive, short-term | "Gold in the vault is power. Tax their goods!" |
| **The Steward** | The player's own civil service | Practical, numbers-driven | "Treasury covers 4 turns at this rate." |

The advice lines above are original game writing, not quotes. The Mercantilist is the lovable rival: often right in the short term, wrong in the long term. That gap is where the lessons live.

### Event system

Events are short cards with a picture, two or three choices, and visible consequences. About 120 at launch, drawn by era, conditions and randomness.

| Category | Examples | Key choice |
| --- | --- | --- |
| Harvest and famine | Drought, grain hoarders, a bumper crop | Free market, *hisba* crackdown, or public granary |
| Money | Silver shortage, counterfeit wave, bank run | Debase, borrow, or tighten |
| Lobbying | Merchants want a monopoly charter or a grain tariff | Grant it for a quick gain or refuse and anger them |
| Invention | Spinning jenny, steam engine, printing press | Fund it, ignore it, or let guilds block it |
| Trade | A rival offers a treaty, a pirate threat, a new sea route | Open up or protect |
| Society | A strike, a school petition, a fraud scandal | Wages, justice, education |
| History | Real historical moments, for example the 1772 Ayr Bank crash in Scotland or the 1720 South Sea Bubble | The historical choice vs alternatives |

Every event card has a **"Why?" button** that opens the codex entry for the idea behind it.

### Rivals

AI nations follow simple personalities: **Mercantilist Empire** (tariffs, colonies, gold), **Free Port** (open trade, small state), **Guild City** (stability, slow change), **Pious Commonwealth** (strong Maslaha, cautious finance). They trade with you, compete for markets, copy successful policies, and react to your tariffs with their own. A trade war with a rival is a common mid-game crisis.

## 8. Scoring: two meters and the ghost of history

You win by raising **both** meters above the scenario's targets by the end year. Each meter is 0 to 100, rebuilt every turn from simulation values, so the player can always open a meter and see exactly why it moved.

### Opulence (Smith)

| Component | Weight | Measures |
| --- | --- | --- |
| Real wage of the lowest laborer | 35% | Wage divided by the cost of a basic basket of goods. Smith's own test of a nation's wealth. |
| Output per person | 25% | GDP per capita in the scenario's units |
| Capital stock per worker | 15% | Workshops, tools, infrastructure |
| Market reach | 15% | Share of the population inside well-connected markets |
| Trade volume | 10% | Imports and exports per person |

### Maslaha (Ghazali's five protections)

| Component | Protects | Measures |
| --- | --- | --- |
| Life (*nafs*) | Life | Share of people with necessities secured; famine deaths |
| Intellect (*'aql*) | Mind | Literacy and schooling |
| Lineage (*nasl*) | Family | Household stability, child welfare |
| Property (*mal*) | Wealth | Money Trust, fraud level, fair courts, secure property |
| Faith and ethics (*din*) | Moral order | Freedom of worship, trust in institutions, honest markets |

The **faith and ethics** component is handled carefully: it measures freedom of worship and trust in institutions, never which religion a nation practices. The game takes no side on theology.

### How the two meters interact

- **High Opulence, low Maslaha:** bubbles, unrest, merchant capture of the state, emigration of the poor. The nation is rich and brittle.
- **High Maslaha, low Opulence:** stability, but rivals outgrow you and your treasury can't fund the protections. The nation is fair and stagnant.
- **Both high:** the "Good Society" bonus (faster institution research, fewer crises).

### Ghost of history

A chart in the corner shows your nation's GDP per capita and real wage against the **actual** historical series for that place (from the data in section 10). At each era's Reckoning, you see how far ahead or behind history you are. Beating the ghost by 25% or more earns a medal. Early-era ghosts are drawn as shaded **bands** (a range of estimates), not lines, because the data is uncertain.

### Endings

| Ending | Condition |
| --- | --- |
| **Golden Age** | Both meters above target, ghost beaten |
| **Gilded Age** | Opulence above target, Maslaha below |
| **Pious Stagnation** | Maslaha above target, Opulence below |
| **Decline** | Both below target |
| **Collapse** (early loss) | Revolution, state bankruptcy, or famine above a threshold |

Each ending plays a short chronicle written from what actually happened in your run ("In 1803, your grain tariff...").

## 9. Learning design

The game teaches by letting players discover the ideas through consequences, then naming them afterward. Rule of thumb: **play first, name second, read third (optional).**

### The discovery loop

1. **Encounter:** the player hits a problem in play ("Why won't my pin workshop grow?").
2. **Experiment:** they try something (build a road to the port).
3. **See:** the market catchment grows, the workshop splits into specialists, output jumps.
4. **Name:** a small toast appears: *"Discovered: The Extent of the Market (Smith, Book I, ch. 3)."* It's added to the player's codex.
5. **Reflect (optional):** the codex entry has a 100-word plain summary, one short quote, and a real-world example.

### Learning features

- **Codex of Ideas:** about 40 entries, unlocked by discovery. Each links the idea, the mechanic, the source and a real-world case. Collecting them all is a completion goal.
- **"Why?" buttons:** on every event card, price spike and meter, explaining the cause in one sentence.
- **Counterfactual replay:** at each Reckoning, "What if?" reruns the last 10 turns with one decision reversed and shows both lines on a chart. This is the most powerful teaching tool in the design.
- **Ghost comparisons:** real data against the player's results makes history concrete.
- **Advisor debates:** two opposing views on each big decision model real economic argument without telling the player which is right.

### Learning goals (what a player should be able to explain after a scenario)

- [ ] Why specialization raises output, and why it needs big markets
- [ ] How prices signal scarcity and pull resources where they're needed
- [ ] Why debasing money or price caps backfire
- [ ] Why tariffs and monopolies help a few and cost many
- [ ] Why saving and capital drive long-run growth
- [ ] What a state must provide (defense, justice, infrastructure, education)
- [ ] Why wealth alone doesn't make a good society (Ghazali's question)

### Classroom mode

A teacher dashboard (no student accounts needed, just a join code) with: a pre-set scenario, a 45-minute timer, an end-of-game debrief with three discussion questions generated from the class's actual results ("Half of you debased the coin in turn 12. What happened next?"), and a printable one-page summary per idea. Aligns with high-school and intro-university economics and world-history topics.

## 10. Real data

Real public data does three jobs: it sets each scenario's **starting conditions**, **calibrates** the simulation so growth behaves within realistic ranges, and draws the **ghost of history** the player races. The game never claims more precision than the data has.

### Sources

| Source | What we use | Coverage | Used for |
| --- | --- | --- | --- |
| [Maddison Project Database 2023](https://www.rug.nl/ggdc/historicaldevelopment/maddison/releases/) | GDP per capita, population | Year 1 to about 2022, sparse before 1500 | Ghost line for output; scenario starts |
| [Clio Infra: labourers' real wage](https://clio-infra.eu/Indicators/LabourersRealWage.html) | Welfare ratios: how many subsistence baskets a day's wage buys | Mainly 1500 onward | Ghost line for real wages (the Opulence headline) |
| [Robert Allen's wage and price data](https://www.nuffield.ox.ac.uk/people/sites/allen-research-pages/) | City wages and prices: London, Amsterdam, Istanbul-adjacent series, China, India | About 1300 to 1925 | Price calibration, basket costs |
| [Penn World Table 11.0](https://www.rug.nl/ggdc/productivity/pwt/pwt-releases/pwt110) | Capital stock, productivity (TFP), human capital, employment | 185 countries, 1950 to 2023 | Modern mode; savings-to-growth calibration |
| World Bank World Development Indicators (public API) | Trade share, inflation, school enrollment, poverty | About 1960 to today | Modern mode starts and ghosts |
| Our World in Data | Literacy, urbanization, life expectancy, cleaned long-run series | Varies | Maslaha components, codex charts |
| Bank of England, *A millennium of macroeconomic data* | UK prices, interest rates, public debt, money | About 1086 to 2016 | Britain 1776 scenario: debt, interest, prices |
| Şevket Pamuk's Ottoman price and wage studies | Istanbul prices and wages | About 1469 to 1914 | Ottoman scenario |

The current versions are Maddison Project 2023 (the fourth release after 2013, 2018 and 2020) and Penn World Table 11.0, published 7 October 2025. Each source's license and citation is checked before launch and listed in the in-game credits. Penn World Table, for example, is under CC BY 4.0.

### Pipeline

1. **Fetch:** Python scripts download each source into a raw folder, pinned by version and date.
2. **Clean:** convert units (Maddison uses 2011 international dollars; welfare ratios are unitless), harmonize country codes, and mark every value as *observed*, *interpolated* or *estimated*.
3. **Map to the game:** a small config file per scenario says which series feed which variable, for example "Britain 1776: starting GDP per capita = Maddison GBR 1776; real wage = Allen London laborers."
4. **Bundle:** export compact JSON (a few hundred KB per scenario), shipped with the game. No live API calls at runtime, so the game works offline and never breaks when a source changes.
5. **Test:** automated checks that every scenario's ghost line and starting values match the source within rounding.

### Calibration

The simulation's free parameters (specialization multipliers, savings-to-capital rates, price adjustment speed) are tuned so that a **"historical autopilot"**, an AI playing the real historical policies, produces paths within the ghost band. For Britain 1776, autopilot should land within about ±15% of actual GDP per capita and real wages by 1850. This keeps the game honest: if the player beats history, it's because their choices were better, not because the model is generous.

### Honesty rules

- **Bands, not lines, before 1700.** Medieval values (Abbasid, Song) are reconstructions with wide error. The ghost is a shaded range, and the codex says so.
- **Label every number's origin.** Hovering a ghost value shows its source, year and whether it's observed or estimated.
- **Scenario units, not fake precision.** Early eras show values as index points or "baskets per day", not dollars to the cent.
- **No invented historical figures.** Real events in event cards are checked against sources; fictional events are clearly flavored as "a merchant", "a drought", not attributed to real people.

## 11. UI/UX and art direction

### Art direction: "living ledger"

The look blends an **illuminated manuscript and an 18th-century merchant's ledger**: ink linework, parchment tones, gold leaf for wealth, and Islamic geometric patterns for the Ghazali-side UI (Maslaha meter, *hisba* office, codex borders). Each era shifts the palette: lapis and gold for Baghdad, ink-wash greens for Kaifeng, Iznik tile blues for Istanbul, sepia and copperplate for Britain, clean modern infographics for the 1960s onward.

The map is 2D isometric hexes with small animated details: caravans, ships, smoke from workshops, crowds at markets. It should be cheap to render and charming at a glance.

### Screen layout

| Area | Contents |
| --- | --- |
| Center | The map, with goods flowing on routes |
| Top bar | Year, treasury, Money Trust, the two meters |
| Right panel | Selected building or region: output, specialization level, prices |
| Bottom | Policy cards and the "End turn" button |
| Corner | Ghost-of-history mini chart (expandable) |
| Pop-ups | Advisor debates, event cards, Reckoning screens |

### UX principles

- **Overlays over spreadsheets.** Toggle map overlays for prices, market reach, wages, class mood. Numbers live in tooltips.
- **Everything explains itself.** Hover any number to see a short formula breakdown in words ("Output 120 = 8 workers × level 3 specialization × tools bonus").
- **One decision at a time.** Turns ask for a few meaningful choices, never 30 sliders.
- **Accessibility:** colorblind-safe palette with icons on every color-coded state, scalable text, full keyboard play, no time pressure in turn mode.
- **Localization from day one:** English, Arabic (right-to-left), Turkish, French, Spanish and Indonesian/Malay in the first wave, given the audience for a Smith-and-Ghazali game.

### Audio

An adaptive score per era (oud and ney for Baghdad, guzheng for Kaifeng, harpsichord and fiddle for Britain), with market ambience that gets busier as your economy grows. Audio is a cheap, strong signal of prosperity.

## 12. Tech stack and engine decision

**Decision: yes, use an engine, and make it Phaser 4 for the map, with the simulation as a separate pure TypeScript library and the menus in normal web UI.** A game this UI-heavy and simulation-heavy needs an engine only for the map. Everything else is better as plain web code.

### Why not build without an engine?

The hex map needs a camera, zoom and pan, sprite batching for hundreds of animated caravans, tweens, input handling and audio. Writing that from scratch costs months. An engine gives it to you on day one.

### Options compared

| Option | Strengths | Weaknesses | Verdict |
| --- | --- | --- | --- |
| **Phaser 4** (TypeScript, WebGL) | Built for 2D browser games; small download (about 345 KB gzipped); free and open source; huge example library; v4.0 shipped 10 April 2026 with a new faster renderer | Its built-in UI is weak (we don't use it) | **Chosen** |
| PixiJS 8 | Very fast 2D renderer, flexible | Only a renderer: no scenes, input, audio or game loop | Good fallback |
| Godot 4 (web export) | Full editor, great for 2D, open source | Web export is tens of MB; HTML-quality text, Arabic right-to-left layout and accessibility are harder | No for browser-first |
| Unity (WebGL) | Powerful tools | Heavy downloads, slow start on browsers, weak on mobile browsers, licensing overhead | No |
| React + plain Canvas or SVG | Simplest | Struggles with many animated units on a big map | Prototype only |

### Architecture

| Layer | Technology | Job |
| --- | --- | --- |
| **Simulation core** | Pure TypeScript, no engine imports, runs in a Web Worker | Economy, prices, classes, events, scoring. Deterministic: the same seed always gives the same result. |
| **Map renderer** | Phaser 4 | Hex map, caravans, buildings, overlays, animations |
| **UI layer** | React (or Svelte) on top of the canvas, with HTML and CSS | Panels, cards, codex, advisor debates, charts. HTML gives us accessibility, right-to-left Arabic, and easy localization. |
| **Charts** | D3 or a small charting library | Ghost line, meters, counterfactual replays |
| **Data** | Python pipeline → versioned JSON bundles | Section 10 |
| **Content** | Events, advisors and codex entries as YAML or JSON files | Writers and translators edit content without touching code |
| **Saves** | IndexedDB in the browser, export and import as a file | No account needed |
| **Build and hosting** | Vite, static hosting (Cloudflare Pages, Netlify or itch.io) | Cheap, fast, global |
| **Localization** | i18next with ICU message format | Six languages in the first wave, including right-to-left |
| **Testing** | Vitest for the simulation; Playwright for the UI | Simulation tests run thousands of seeded games to catch balance breaks |

The key choice is **keeping the simulation separate from the engine.** It means the economy can be unit-tested and balanced with scripts that play 10,000 games overnight. It's also reusable: the same core could power a mobile version, a classroom dashboard, or a different renderer if Phaser ever stops fitting.

### Performance targets

- First load under 5 MB, playable within 3 seconds on a mid-range laptop.
- 60 frames per second on the map with 500 moving units.
- End-of-turn simulation under 200 ms, run in a Web Worker so the screen never freezes.
- Works in current Chrome, Edge, Firefox and Safari, on desktop and on tablet.

## 13. Simulation math and balancing

The model is deliberately small: about ten equations, each tied to one idea from the books. Starting values below are tuning defaults, to be calibrated against the data (section 10).

### Production with division of labor

Output of workshop *w* making good *g* each turn:

```latex
Y_w = L_w \cdot b_g \cdot m(s_w) \cdot \left(1 + \theta K_w / L_w\right)^{\alpha}
```

Here L is workers, b is the good's base output per worker, K is capital (tools, machines), and m(s) is the specialization multiplier, for example m(s) = 1.6^(s − 1). That makes a level 5 workshop about 6.5 times as productive per worker as a level 1. Smith's pin numbers are far larger; the game compresses them for balance and the codex says so.

### Extent of the market caps specialization

```latex
R_w = \sum_{j} P_j \, e^{-c_{wj} / c_0} \qquad s_w^{\max} = \min\!\left(5,\; 1 + \left\lfloor \log_2 (R_w / R_0) \right\rfloor\right)
```

Market reach R sums the population P of every town j, discounted by the transport cost c to get there (distance, terrain, tolls, bandits, tariffs, debased-money penalty). Each doubling of reach unlocks one more specialization level. Roads and ports lower c, which visibly expands the catchment.

### Market price and natural price

```latex
p_{t+1} = p_t \left(1 + \lambda \frac{D_t - S_t}{S_t}\right) + \mu \left(p^{*} - p_t\right)
```

The first term moves the price with excess demand. The second pulls it toward the natural price p\*, the cost of the labor, capital and land needed to make it. Suggested starting values: λ = 0.3, μ = 0.15.

### Labor and capital move to the best returns (the invisible hand)

Each turn, a share η of workers in each sector moves toward sectors paying higher real wages, in proportion to the gap. Capital moves the same way toward higher profit rates. Guild rules, poor roads and low literacy slow both moves.

### Capital accumulation

```latex
K_{t+1} = (1 - \delta) K_t + \sigma Y_t
```

σ is the savings rate (driven by class mix, interest or partnership returns, and Money Trust) and δ is depreciation (about 5% a turn).

### Real wage and the headline score

```latex
W^{\text{real}} = \frac{w}{P_{\text{basket}}}
```

The basket is a fixed subsistence bundle (bread, cloth, fuel, rent), following the welfare-ratio method in the wage data. This makes the player's number directly comparable to the ghost line.

### Money Trust

Trust T (0 to 100) recovers slowly toward 80 when the coin is sound, and drops sharply with debasement, over-printing or default. The price level rises as trust falls, and market reach is multiplied by T / 100. One bad decision costs about 10 turns to repair. The asymmetry is the lesson.

### Balancing method

1. **Bot players:** five scripted strategies (Mercantilist, Free Trader, Pious Steward, Debaser, Balanced) each play 2,000 seeded games per scenario overnight.
2. **Targets:** Balanced should win about 60% of runs, pure Mercantilist under 15%, Debaser under 5%. No single strategy should win more than 75%.
3. **Historical autopilot** must stay inside the ghost band (section 10).
4. **Playtest metrics:** median session length, turn of first "Discovered" toast (target under 5 minutes), and share of players who open at least one "Why?" button (target over 50%).

## 14. MVP scope, roadmap, risks and open questions

### MVP: *The Needle* plus *Britain, 1776*

The first playable build proves the fun of one loop: **specialize, extend the market, grow, and face the two meters.** It includes:

- [ ] Hex map of one region, 8 to 10 goods, roads and ports
- [ ] Specialization levels and market reach, with the visible catchment
- [ ] Market and natural prices; workers moving by wage
- [ ] Money Trust with the debasement card
- [ ] Three classes, four budget lines, a simple tax screen
- [ ] Two advisors (the Scotsman and the Scholar of Tus) and about 30 events
- [ ] Both meters, the ghost line from Maddison and Clio Infra data, and three endings
- [ ] Two Texts codex with about 12 entries, plus the four root crafts in the tutorial (section 15)
- [ ] English and Arabic (right-to-left) from day one; saves in the browser

Left out of the MVP: rivals' AI, finance paths, other scenarios, campaign, classroom mode, languages beyond English and Arabic.

### Team for the MVP

| Role | Count | Notes |
| --- | --- | --- |
| Game designer and producer | 1 | Owns systems and balance |
| Gameplay and simulation engineer | 1 to 2 | TypeScript core plus Phaser map |
| UI engineer | 1 | React panels, charts, accessibility |
| Artist | 1 | Can be part-time; map tiles, icons, card art |
| Writer and researcher | 1, part-time | Events, codex, data pipeline checks |
| Economic historian advisor | 1, a few days | Reviews codex and calibration |

### Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Feels like a spreadsheet, not a game | High | Overlays over tables; the specialization animation; a 15-minute fun test every two weeks |
| Model too simple for experts, too complex for players | Medium | Hide math behind "Why?" buttons; an optional "Economist view" with all numbers |
| Religious sensitivity around Ghazali and the *din* component | Medium | Scholar reviewer; measure freedom and trust, never doctrine; respectful art |
| Seen as taking political sides (free market vs. state) | Medium | Both advisors are sometimes right; outcomes from the model, not from preaching; publish the model |
| Data gaps for early eras | High | Bands, not lines; clear labels; scenario units |
| Scope creep (it's a Civilization-like) | High | MVP is two scenarios; every new system must pass the "one idea, one mechanic, one visible effect" test |

### Open questions

- **Business model:** free and ad-free with paid classroom licenses, a one-time purchase on itch.io and Steam (via a desktop wrapper), or grant-funded open access?
- **Real-time or turn-based on the map?** The design assumes turn-based with animated resolution. A pausable real-time mode could be tested later.
- **How far into the modern era?** Modern policy debates (central banks, welfare states) are more politically charged. Possibly stop at 1914 for version 1.
- **Name:** "The Needle & The Pin" is the working title. Alternatives: *Opulence*, *The Invisible Hand*, *Wealth & Measure*.
- **Translations of Ghazali:** resolved. Quote the original Arabic with our own translations (section 16).

> **Source check, 26 Nov 2026.** Every Ghazali passage the game quotes was checked against the Arabic of the *Ihya'*
> (Dar al-Ma'rifa, Beirut, 4 vols, via al-Maktaba al-Shamila) and of *al-Mustasfa* (ed. 'Abd al-Shafi). Corrections
> to this document:
>
> 1. **The needle.** Not "about 25 hands": the needle "passes through the hand of the needle-maker twenty-five times,
>    doing a task each time" (4:119). That is twenty-five operations, which is even closer to Smith's eighteen.
> 2. **The four root crafts** are confirmed in *Kitab al-'Ilm* (1:12–13): agriculture, weaving, building, governance.
> 3. **Markets from need** is in *Kitab Dhamm al-Dunya* (Book 26, 3:227–228), not Book 32. The passage covers barter's
>    double coincidence of wants, shops and storehouses, merchants, and then the mint.
> 4. **Money as judge and mirror** is in *Kitab al-Shukr* (4:91). **Counterfeit coin** is in *Adab al-Kasb* (2:73–74).
> 5. **Five protections and three ranks** are in *al-Mustasfa* (p. 174), in Ghazali's own terms: *ḍarūrāt*, *ḥājāt*,
>    *taḥsīnāt*.
> 6. **Usury and partnership (*qirād*)** are discussed in Book 13, ch. 2 (2:64–71), not Book 14.
>
> Still to do: cross-check the same passages against the Dar al-Minhaj critical edition (§16). Run
> `npm run quotes:verify` to recheck everything automatically.

## 15. Additions after reading the sources

Going back to the primary texts suggests eight additions. Three belong in the MVP because they make the game feel rooted in the real books from the first minute; the rest deepen later versions.

| # | Addition | Source | Plugs into | When |
| --- | --- | --- | --- | --- |
| A | Two Texts codex | Both authors, in their own languages | Codex, learning design (section 9) | MVP |
| B | The four root crafts | Ghazali, *Ihya* | Tutorial, production chains (4.1) | MVP |
| C | Arabic as a launch language | The Arabic sources themselves | UI and localization (section 11) | MVP |
| D | Justice and benevolence in trade | Ghazali, Book 13 | Merchant reputation, debt events | Version 1 |
| E | Waqf endowments, with Smith's warning | Ghazali's world; Smith, Book V | Institutions, Maslaha, capital | Version 1 |
| F | Caravanserai network | Abbasid and Seljuk trade | Market reach (4.3) | Version 1 |
| G | Smith's other book: the impartial spectator | Smith, *Theory of Moral Sentiments* (1759) | The Scotsman advisor, Maslaha | Version 1 |
| H | Guest scholars | Ibn Khaldun, al-Maqrizi, Ibn Taymiyya | New advisors and scenarios | Expansion |

### A. Two Texts codex

Every codex entry shows the idea in the author's own words: Smith in his 1776 English, Ghazali in the original Arabic, with our English translation beside it and a toggle to switch. Players see that these are real books, not game lore. Both originals are in the public domain, so there are no licensing costs. A "read the full chapter" link points to a free online text.

### B. The four root crafts

Ghazali names the crafts no society can live without: "roots without which the world cannot stand, and they are four: agriculture for food, weaving for clothing, building for shelter, and governance" (*Ihya'*, Kitab al-'Ilm, 1:12–13). The tutorial turns this into the opening goal: a settlement needs all four before a market can form. It's a gentle first lesson that a market rests on production and on someone keeping order. (Passage confirmed in the Arabic text; see the note below.)

### C. Arabic as a launch language

A game that quotes Ghazali in Arabic should be playable in Arabic from day one. Building right-to-left support at the start is far cheaper than adding it later, and it opens the game to Arabic-speaking schools and players.

### D. Justice and benevolence in trade

In Book 13, Ghazali separates two levels of good trading: **justice** (never wronging the other side: honest weights, no hidden defects, no hoarding) and **benevolence** (*ihsan*, going beyond what's owed, such as giving a struggling debtor more time). This becomes a stance each merchant guild can take:

- **Justice:** the baseline. It removes fraud penalties and protects Money Trust.
- **Benevolence:** lower short-term profit, but higher Maslaha and fewer debt crises and bankruptcies in bad years.
- **Neither:** the highest profit until a fraud scandal or a debt crisis hits.

A new event family, "The Debtor's Plea", asks whether to enforce a debt in full, reschedule it, or forgive part of it.

### E. Waqf endowments, with Smith's warning

Players can found **waqfs**, permanent charitable endowments that fund a school, hospital, fountain or caravanserai forever, independent of the treasury. They give lasting Maslaha. The catch makes it interesting: the land and buildings are frozen. After about two eras, an old waqf can turn rigid and inefficient unless the player spends political capital to reform it.

Smith makes the same argument in Book V: endowed teachers paid regardless of effort tend to stop teaching well. Here the two lenses meet. Both thinkers would recognize the problem, and the advisors debate the fix.

### F. Caravanserai network

In the Caravan era, roads alone aren't enough. Players build caravanserais (fortified inns) a day's travel apart on trade routes. Each one lowers transport cost and bandit risk on its stretch of road, extending market reach. It's the medieval Islamic world's answer to Smith's canals, and it gives the Abbasid scenario its own infrastructure identity.

### G. Smith's other book: the impartial spectator

Smith wrote *The Theory of Moral Sentiments* (1759) before *Wealth of Nations*. It argues that people judge their own conduct by imagining an "impartial spectator". Adding it to the Scotsman's voice shows players that Smith was a moral philosopher too, and that he and Ghazali agree markets need moral foundations. In-game, high trust and honest markets give a small Opulence bonus, which links the two meters.

### H. Guest scholars (expansion)

Three more thinkers from the Islamic world fit the game naturally and could each arrive as an advisor with a new scenario:

| Scholar | Idea | Mechanic | Scenario |
| --- | --- | --- | --- |
| **Ibn Khaldun** (*Muqaddimah*, 1377) | Low tax rates early in a dynasty bring high revenue; rising rates later choke enterprise | "Dynasty cycle": tax rates and court spending creep up each era unless reformed | Hafsid Tunis or Mamluk Cairo |
| **Al-Maqrizi** (early 1400s, Egypt) | Blamed much of a famine-era crisis on the debasement of the coinage | Ties famine and debasement into one crisis chain | Mamluk Cairo, c. 1403 |
| **Ibn Taymiyya** (d. 1328) | When the market inspector may justly set prices, and when not | Price caps allowed without penalty only against proven hoarding or collusion | Mamluk Damascus |

The writers should check each claim against the sources before these advisors speak.

## 16. Sources and reading list

The team's working library. Original texts are the reference; translations are for checking our own translations, never for copying.

### Adam Smith

| Text | Use | Notes |
| --- | --- | --- |
| *The Wealth of Nations* (1776) | Primary source for every Smith mechanic | Public domain; free on Project Gutenberg |
| *The Theory of Moral Sentiments* (1759) | The impartial spectator (section 15 G) | Public domain |

### Al-Ghazali: the Arabic original

| Edition | Details | Use |
| --- | --- | --- |
| [Dar al-Minhaj, Jeddah](https://abjjad.com/book/1998618624/%D8%A7%D8%AD%D9%8A%D8%A7%D8%A1-%D8%B9%D9%84%D9%88%D9%85-%D8%A7%D9%84%D8%AF%D9%8A%D9%86) | Critical edition by a scholarly committee. 1st ed. 2011, 10 volumes, 6,688 pages, ISBN 978-9953-541-50-1. A [2nd edition (2023)](https://attahawi.com/2026/05/09/a-brief-comparison-of-two-editions-of-i%e1%b8%a5ya-%ca%bfulum-al-din-and-a-brief-look-at-the-new-edition-of-it%e1%b8%a5af-al-sadat-al-muttaqin/) comes in 4 or 10 volumes | Reference text for all codex quotes |
| [Shamela: Dar al-Ma'rifa, Beirut](https://shamela.ws/book/9472) | Free online, 4 volumes, page numbers match the print edition | Searching for passages |

The books that matter most for the game:

| Book | Arabic title | Game use |
| --- | --- | --- |
| 13 | كتاب آداب الكسب والمعاش | Trade ethics, markets, hoarding, justice and benevolence |
| 14 | كتاب الحلال والحرام | Money, contracts, finance paths |
| 32 | كتاب الصبر والشكر | Money as a measure of value, the blessings of production |

### Al-Ghazali: English translations (for checking)

| Book | Translation | Publisher |
| --- | --- | --- |
| 13 | *The Book of the Proprieties of Earning and Living*, Adi Setia | IBFIM, Kuala Lumpur, 2013; also Fons Vitae, 2019 |
| 14 | *Al-Ghazali on the Lawful and the Unlawful*, Yusuf Talal DeLorenzo | Islamic Texts Society, 2014 |
| 32 | *Al-Ghazali on Patience and Thankfulness*, Henry T. Littlejohn | Islamic Texts Society, 2016 |
| Overview | [ghazali.org list of all 40 books and their translations](https://www.ghazali.org/?p=1322) | Free |

Avoid the older complete English sets (Fazlul Karim; al-Sharif) for quotes: they're useful for skimming but loose in places.

### Data sources

See section 10 for the full list. Key links: [Maddison Project releases](https://www.rug.nl/ggdc/historicaldevelopment/maddison/releases/), [Penn World Table 11.0](https://www.rug.nl/ggdc/productivity/pwt/pwt-releases/pwt110), [Clio Infra labourers' real wages](https://clio-infra.eu/Indicators/LabourersRealWage.html), [Robert Allen's data pages](https://www.nuffield.ox.ac.uk/people/sites/allen-research-pages/).

### Engine

[Phaser 4.0.0 changelog](https://raw.githubusercontent.com/phaserjs/phaser/HEAD/changelog/v4/4.0/CHANGELOG-v4.0.0.md), released 10 April 2026.
