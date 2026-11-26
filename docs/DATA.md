# Real data pipeline

Real public data does three jobs (GDD §10). It sets each scenario's **starting conditions**, it **calibrates** the model
(through the historical autopilot), and it draws the **ghost of history**. No API is called at runtime: the game ships
small JSON bundles, so it works offline and never breaks when a source changes.

## Run it

```sh
npm run data:fetch   # 1. download sources into data/raw/, pinned by SHA-256 in data/raw/manifest.json
npm run data:build   # 2–4. clean, map to the game, bundle → src/data/ghost/<scenario>.json, then 5. check
```

Requirements: Python 3 (standard library only, with a built-in `.xlsx` reader in `scripts/data/xlsx.py`), `curl`, and
Node (for Allen's legacy `.xls` file, which `scripts/data/xls_to_json.mjs` converts using SheetJS).

Raw files are not committed (see `data/.gitignore`). `manifest.json` is committed, so anyone can confirm they fetched
byte-identical files.

## Steps

1. **Fetch** (`scripts/data/fetch.py`). It downloads every entry in `scripts/data/sources.json` and records the size, the
   SHA-256 and the fetch date. Some hosts reject Python's TLS handshake; the script retries with `curl`.
2. **Clean** (`build.py`). It extracts each configured series and keeps the source's units:
   - Maddison: 2011 international $.
   - Allen: welfare ratio, the number of family respectability baskets a building labourer's earnings buy.
   - Clio Infra: their real-wage index.

   Every point is marked `observed` or `interpolated` (linear, inside the observed span only). The pipeline never
   extrapolates.
3. **Map to the game.** `scripts/data/scenarios/<id>.json` says which series feed which game variable.
4. **Bundle.** Compact JSON in `src/data/ghost/`, with each source's title, citation, licence, URL, hash and fetch date.
   The game shows these on hover and in the credits.
5. **Test** (`check.py`). Every observed value in the bundle must equal the raw source within rounding. Vitest also
   checks the bundle's shape and coverage.

## Sources in use

| Key | Source | Series used | Coverage in bundle |
| --- | --- | --- | --- |
| `maddison_2023` | [Maddison Project Database 2023](https://www.rug.nl/ggdc/historicaldevelopment/maddison/releases/maddison-project-database-2023) (Bolt & van Zanden 2024), CC BY 4.0 | GBR GDP per capita; population | GDP 1776–1850 (75 observed points); population 1820–1850 |
| `allen_labourers` | [Robert C. Allen, labourers' wages and prices](https://www.nuffield.ox.ac.uk/people/sites/allen-research-pages/) (Allen 2001, *Explorations in Economic History* 38) | London building labourers' welfare ratio | 1776–1850, 75 observed points (1776 = 1.298, 1850 = 1.562) |
| `clio_real_wage` | [Clio Infra, Labourers' Real Wage](https://clio-infra.eu/Indicators/LabourersRealWage.html) (de Zwart, van Leeuwen & van Leeuwen-Li 2015) | United Kingdom real wage | 1820–1850, cross-check only |

Why Allen rather than Clio Infra for the real-wage ghost: Clio Infra's UK series begins in 1820, so it cannot cover
1776–1819. Allen's London series is continuous over the whole scenario, and it uses the welfare-ratio method the game's
real wage follows (§13).

**Licences.** Maddison is CC BY 4.0. Allen's and Clio Infra's data are published for research and education with
citation; their exact licence terms must be confirmed before a commercial release (§10). The in-game credits list every
source and its citation.

## Honesty rules in the game

- **Label every number's origin.** Ghost values show source, year and observed/interpolated status.
- **Bands, not lines, before 1700.** This applies to future medieval scenarios such as Abbasid Baghdad and Song
  Kaifeng. Britain 1776 uses lines because its series are observed annually.
- **Estimates are labelled as estimates.** Britain's 1776 population (Maddison has no 1776 value) and starting literacy
  are labelled "estimated" in the docs and tooltips.

## Adding a scenario

1. Add any new source to `sources.json`. Add an extractor in `build.py` if the format is new.
2. Write `scripts/data/scenarios/<id>.json` naming the series.
3. Run `npm run data:fetch && npm run data:build`.
4. Import the bundle in `src/game/ghost.ts` and add the scenario in `src/sim/scenarios.ts`, with `start` values taken
   from the bundle.
5. Run the autopilot calibration (see [BALANCE.md](BALANCE.md)).
