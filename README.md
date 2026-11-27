# The Needle & The Pin

A browser strategy game in which you grow a trading city into a wealthy nation, and win only if that wealth also
feeds, educates and protects your people. It runs on Adam Smith's *Wealth of Nations* (1776) and al-Ghazali's economic
thought from the *Ihya' 'Ulum al-Din* (c. 1100), and it races you against real historical data.

**Play:** https://ibra-niang.com/needleandpin/ · **Design document:** [docs/GDD.md](docs/GDD.md)

> Smith opens with a pin factory split into about 18 operations. Ghazali, roughly seven centuries earlier, describes a
> needle that passes through the needle-maker's hands twenty-five times. Same insight, two civilisations, two questions: *how does a nation grow
> rich?* and *rich for what?*

## What's in the game

- **Pausable real time (Factorio-style logistics).** Every unit of grain, cloth or tools travels as a cart, barge
  or dhow along your roads, rivers, canals, railways and sea lanes. Roads jam, and workshops starve or pile up
  goods. A bottleneck explainer tells you the real cause upstream. Speeds are pause, 1×, 2× and 4× (one year per
  minute at 1×). See [docs/REALTIME.md](docs/REALTIME.md).
- **Illustrated art inspired by Arabic and Islamic art.** Watercolour terrain, a Persian-miniature landscape, and
  buildings and towns in the manner of al-Wasiti's Maqamat: domes, arches, mashrabiya screens and Iznik tile bands.
  Animated workers, camel caravans and dhows.

- **Two scenarios.** *The Needle* is a 15-minute tutorial: Ghazali's four root crafts, the division of labour, the
  extent of the market. *Britain, 1776* is the flagship, 1776–1850 in four chapters, raced against Maddison GDP and
  Robert Allen's London real wages.
- **The signature mechanic.** Every workshop has a specialisation level from 1 to 5, capped by its market reach.
  Select a workshop and its market catchment glows gold. Build a road and watch it widen and the workshop split into
  specialists.
- **A living economy.** Ten goods in Ghazali's three need tiers. Market and natural prices (Smith I.7). Workers move
  to better wages by themselves, and merchants found workshops and lay turnpikes, canals and railways (the invisible
  hand). Three classes have their own politics.
- **The sovereign.** Smith's four duties plus Ghazali's granaries; a tax screen graded on Smith's four maxims; public
  debt.
- **Money and trust.** Coinage, Money Trust, the tempting debasement card, hoarding, and two finance paths: interest
  banks or partnership houses.
- **Two meters.** Opulence (Smith) and Maslaha (Ghazali's five protections), each with a breakdown you can open.
- **Five endings:** Golden, Gilded, Pious Stagnation, Decline, Collapse.
- **Institutions.** 20 in four tracks across five eras.
- **The council.** The Scotsman and the Scholar of Tus debate every big decision. Ignore one too often and he
  resigns.
- **43 event cards** in seven categories, including real history: the American war, Pitt's sinking fund, the 1797
  Restriction, the income tax, the Continental System, the Corn Law of 1815, Peterloo, the Factory Act and railway
  mania. Each has a "Why?" link into the codex.
- **Reckonings.** At the end of each chapter: a chronicle written from your run, a comparison with the ghost of
  history, a **What if?** replay that reruns the chapter with one decision reversed (same seed, same luck), and an
  era-defining reform.
- **The Two Texts codex.** 22 entries. Smith is quoted verbatim, checked automatically against Project Gutenberg.
  Ghazali is quoted in the original Arabic with volume and page, checked automatically against the source text, with
  our own English translation (see [Accuracy](#accuracy)).
- **English and Arabic** (full right-to-left) from day one. Saves go in the browser, with export and import as a file.
  Keyboard shortcuts cover every screen and tool; placing a building on the map still needs a pointer.

## Quick start (development)

```sh
npm install
npm run dev            # http://localhost:5173/needleandpin/
npm test               # simulation and content tests (Vitest)
npm run test:ui        # end-to-end tests in a real browser (Playwright)
npm run typecheck
npm run build          # production build to dist/ (base /needleandpin/)
```

| Command | What it does |
| --- | --- |
| `npm run data:fetch` / `data:build` | Real-data pipeline: download, clean, bundle, verify ([docs/DATA.md](docs/DATA.md)) |
| `npm run quotes:verify` | Check every Smith quote verbatim against Project Gutenberg |
| `npm run balance -- autopilot 20` | Historical autopilot vs the ghost band ([docs/BALANCE.md](docs/BALANCE.md)) |
| `npm run balance -- bots 30` | Five bot strategies, win rates vs the §13 targets |
| `npm run deploy [-- --push]` | Publish to ibra-niang.com/needleandpin/ ([docs/DEPLOY.md](docs/DEPLOY.md)) |

Requirements: Node 23.6+ (the balance script runs TypeScript directly), Python 3 for the data pipeline, and Chromium for
the UI tests (set `CHROMIUM_PATH`, or run `npx playwright install chromium`).

## How it's built

A pure, deterministic TypeScript simulation (`src/sim`) runs in a Web Worker. **Phaser 4** draws the isometric hex
map; **React** draws everything else; **i18next + ICU** handles English and Arabic. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
src/sim/        economy, prices, classes, events, scoring, bots (no engine imports)
src/content/    events.json, codex.json (bilingual, edited by writers)
src/data/ghost/ historical series bundled by the data pipeline
src/game/       controller, worker bridge, saves, ghost loader
src/map/        Phaser scene
src/ui/         React components and styles
src/i18n/       en.json, ar.json
scripts/        data pipeline, quote verification, balance harness, deploy
tests/sim/      Vitest     tests/ui/  Playwright
docs/           GDD, architecture, simulation model, content guide, data, balance, deploy
```

## Documentation

- [docs/GDD.md](docs/GDD.md): the game design document (source of truth).
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, turn pipeline, rendering, saves, localisation, performance.
- [docs/REALTIME.md](docs/REALTIME.md): the real-time logistics model (daily loop, carts, capacity, local markets, bottleneck explainer).
- [docs/SIMULATION.md](docs/SIMULATION.md): every equation and constant, and where it lives in the code.
- [docs/CONTENT.md](docs/CONTENT.md): writing event cards and codex entries; accuracy rules; translation.
- [docs/DATA.md](docs/DATA.md): the real-data pipeline and sources.
- [docs/BALANCE.md](docs/BALANCE.md): calibration and bot results.
- [docs/DEPLOY.md](docs/DEPLOY.md): publishing.

## Status against the MVP (GDD §14)

| MVP item | Status |
| --- | --- |
| Hex map of one region, 8–10 goods, roads and ports | ✅ ≈400-hex region; 10 goods (spices import-only); roads, canals, railways, ports and sea lanes |
| Specialisation levels and market reach, with the visible catchment | ✅ |
| Market and natural prices; workers moving by wage | ✅ plus private investment and companies |
| Money Trust with the debasement card | ✅ plus hoarding and the bank credit cycle |
| Three classes, four budget lines, a simple tax screen | ✅ plus Ghazali's fifth line and the four-maxims grades |
| Two advisors and about 30 events | ✅ 43 events |
| Both meters, the ghost line (Maddison + wage data), three endings | ✅ five endings; Allen's London wages used for 1776–1850 (Clio Infra only starts in 1820) |
| Two Texts codex (~12 entries) plus the four root crafts | ✅ 22 entries. Every Smith and Ghazali quote verified against its source ([docs/REVIEW.md](docs/REVIEW.md)). |
| English and Arabic (RTL); saves in the browser | ✅ The Arabic was reviewed line by line and corrected ([docs/REVIEW.md](docs/REVIEW.md)). |
| Tests and balancing | ✅ 24 simulation and content tests, 6 browser tests; the autopilot sits inside the ±15% ghost band; bots meet every §13 target |

Beyond the MVP list, already in: the 20-institution tree with the finance-path fork, Reckonings with reforms,
counterfactual "What if?" replay, the bot harness, and the historical autopilot.

**Not yet built** (GDD versions 1 and later, or needing other skills): rival nations' AI, the other scenarios and the
campaign, classroom mode, languages beyond English and Arabic, the adaptive audio score (§11), and commissioned art.
The map and cards currently use vector line art and icons. Also from §15: waqf endowments, the caravanserai network,
the justice and benevolence stances, and guest scholars.

## Accuracy

The full review (method, findings, corrections) is in [docs/REVIEW.md](docs/REVIEW.md).

- Advisors speak in paraphrase; they never quote invented lines.
- All 13 Smith quotations are checked verbatim against Project Gutenberg ebook #3300.
- All 9 Ghazali quotations are the Arabic text of the *Ihya'* (Dar al-Ma'rifa edition) or *al-Mustasfa*, with volume
  and page, checked automatically against al-Maktaba al-Shamila. Translations are our own. The check corrected the
  GDD: Ghazali's needle passes through the needle-maker's hands twenty-five times, not "25 hands" (4:119); and the
  markets passage is in Book 26, not Book 32.
- `npm run quotes:verify` reruns both checks, and the tests enforce them.
- History notes were checked claim by claim; four were corrected.
- The faith component of Maslaha measures freedom of worship and trust in institutions, never doctrine.
- **Still worth a human expert's sign-off before a public launch:** a cross-check of the Ghazali pages against the
  Dar al-Minhaj critical edition (not available online), a native editor's final stylistic read of the Arabic, and an
  economic historian's review of the calibration estimates.

## Credits

- Adam Smith, *An Inquiry into the Nature and Causes of the Wealth of Nations* (1776). Public domain.
- Abu Hamid al-Ghazali, *Ihya' 'Ulum al-Din* (c. 1100) and *al-Mustasfa*. Reference edition: Dar al-Minhaj, Jeddah,
  2011.
- Data:
  - Maddison Project Database 2023 (Bolt & van Zanden, 2024), CC BY 4.0.
  - Robert C. Allen, "The Great Divergence in European Wages and Prices" (2001), data via the Nuffield College pages.
  - Clio Infra, Labourers' Real Wage (de Zwart, van Leeuwen & van Leeuwen-Li, 2015).
- Built with Phaser 4, React, i18next and d3. Fonts: EB Garamond and Amiri (Google Fonts, OFL).
