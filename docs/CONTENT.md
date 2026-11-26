# Writing content: events, codex, translations

Content lives in JSON so writers and translators can work without touching code (GDD §12). `npm test` validates all of
it (`tests/sim/content.test.ts`).

## Accuracy rules (GDD §3, §16)

1. **Advisors paraphrase, never invent quotations.** Council lines (`advisor.say.*` in the locale files, `advice` on
   events) are original game writing in each thinker's spirit.
2. **Smith is quoted from his own English.** Every Smith quote in `codex.json` must match the Project Gutenberg text
   verbatim. Run `npm run quotes:verify`: it downloads ebook #3300 (with a fallback to the official PGLAF mirror) and
   sets `status: "verified-gutenberg"` or `"not-found"`. The tests fail if any Smith quote is unverified.
3. **Ghazali is quoted from the Arabic, with volume and page.** `quote.text` holds the exact source wording, copied
   from al-Maktaba al-Shamila, never retyped. `read` is the cited Shamela page, and `translation.en` is our own.
   `npm run quotes:verify` checks every quote against the cited page and sets `status: "verified-dar-al-marifa"`.
   Use `"verified-edition"` only after a scholar has checked the passage in the Dar al-Minhaj critical edition. See
   [REVIEW.md](REVIEW.md).
4. **Historical event cards** (`category: "history"`) carry a `history` note. Every claim in it must be checked against
   a source. Fictional cards use generic actors ("a merchant", "a drought"), never real people.
5. **The faith component** measures freedom of worship and trust in honest institutions. The game takes no theological
   side.

Before launch, one economic historian reviews the codex and calibration (§3), and a scholar reviews the Ghazali entries
(§14 risks).

## Event cards (`src/content/events.json`)

```jsonc
{
  "id": "grainHoarders",                 // unique
  "category": "harvest",                 // harvest | money | lobbying | invention | trade | society | history
  "icon": "hoard",                       // see ICONS in src/ui/Modals.tsx
  "weight": 3,                           // relative draw weight (history cards ×3)
  "cooldown": 6,                         // turns before it can fire again (default 8)
  "once": false,                         // fire at most once per game
  "when": {                              // all present conditions must hold
    "minTurn": 2, "maxTurn": 40, "minYear": 1780, "maxYear": 1835,
    "scenario": ["britain1776"], "era": [3, 4],
    "all": [{ "stat": "grainPriceRatio", "gt": 1.2 }],     // every condition
    "any": [{ "stat": "laborers", "lt": 30 }],              // at least one
    "policy": { "cornLaw": false }, "institution": { "hisba": true }, "flag": { "openPorts": true }
  },
  "codex": "ihtikar",                    // the "Why?" link (must exist in codex.json)
  "title": { "en": "…", "ar": "…" },
  "body":  { "en": "… {year} …", "ar": "…" },
  "history": { "en": "…", "ar": "…" },   // optional: what really happened
  "onFire": [ /* effects applied when the card is drawn */ ],
  "advice": { "scotsman": { "en": "…", "ar": "…" }, "scholar": { "en": "…", "ar": "…" } },
  "choices": [
    {
      "label": { "en": "…", "ar": "…" },
      "hint":  { "en": "…", "ar": "…" },
      "requires": { "institution": "hisba", "treasuryRevenue": 0.3, "policy": "guildRules", "notPolicy": "cornLaw" },
      "effects": [ /* see below */ ],
      "advisors": { "scotsman": -1, "scholar": 1 },   // stance: +1 favours, −1 opposes (moves advisor trust)
      "chronicle": { "en": "In {year} …", "ar": "في سنة {year} …" }  // goes into the Reckoning/ending chronicle
    }
  ]
}
```

### Stats usable in conditions

`grainPriceRatio`, `breadPriceRatio`, `clothPriceRatio`, `pinPriceRatio`, `toolPriceRatio` (price ÷ natural),
`trust`, `treasuryRevenue` (treasury ÷ revenue), `debtRatio`, `literacy`, `fraud`, `banditry`, `laborers`,
`merchants`, `landlords` (satisfaction), `unemployment`, `ports`, `maxLevel`, `pinworks`, `producers`, `opulence`,
`maslaha`, `gap` (Opulence − Maslaha), `customs`, `exciseNecessities`, `hoarding`, `credit`, `smuggling`,
`necessity`, `granary`, `year`, `turn`, `educationShare`, `reliefShare`, `defenseShare`, `technology`, `debasements`,
and `flag:<name>`. They are defined in `src/sim/events.ts › stat`.

### Effect operations

| op | Fields | Meaning |
| --- | --- | --- |
| `treasury` | `v`, `scale?: "revenue"` | Add to the treasury. A negative balance becomes debt. |
| `debt` | `v`, `scale?` | Add to debt. |
| `trust` | `v` | Money Trust ± v. |
| `inflation` | `v` | Pending inflation (released at 40% per turn). |
| `stock` | `good`, `v`, `mult?` | Add to stock, or multiply it. |
| `price` | `good`, `mult` | Multiply the market price. |
| `class` / `influence` | `cls`, `v` | Class satisfaction or influence ± v. |
| `policy` | `id`, `on` | Enact or repeal a policy. |
| `customs` | `v` | Customs rate ± v. |
| `foreign` | `mult` | Foreign-market size × mult (permanent). |
| `pop` | `mult` | Every town's population × mult. |
| `literacy`, `fraud`, `bandits`, `institutionTrust`, `worship`, `technology`, `credit` | `v` | Society values ± v. |
| `capital` | `mult` | Every building's capital × mult. |
| `granary` | `v` | Granary stock ± v (scaled by population). |
| `releaseGranary` | — | Move all stored grain to market. |
| `advisor` | `who`, `v` | Advisor trust ± v. |
| `flag` | `name`, `v?` | Set a flag (read by conditions and some systems, e.g. `incomeTax`, `openPorts`). |
| `progress` | `v` | Institution development points. |
| `delay` | `turns`, `effects` | Apply `effects` later: the delayed bill. |
| `chronicle` | `key` | Add a line to the chronicle (key under `chronicle.*` in the locale files). |

Unknown ops fail the content test.

## Codex entries (`src/content/codex.json`)

```jsonc
{
  "id": "extent-of-market",
  "author": "smith",                     // smith | ghazali | both
  "ref": { "en": "Wealth of Nations, Book I, ch. 3", "ar": "…" },
  "title": { "en": "…", "ar": "…" },
  "summary": { "en": "≈100 words", "ar": "…" },
  "quote": { "lang": "en", "text": "verbatim", "translation": { "ar": "…" }, "status": "verified-gutenberg" },
  "example": { "en": "a real-world case", "ar": "…" },
  "mechanic": { "en": "what it does in the game", "ar": "…" },
  "read": "https://www.gutenberg.org/ebooks/3300"   // or null; never guess a URL
}
```

Entries are unlocked by discovery rules in `src/sim/discovery.ts`, by an event's `codex` field, or by an
institution's `codex` field.

## UI strings (`src/i18n/locales/*.json`)

- Both files must have the same keys. ICU syntax is supported, e.g.
  `{n, plural, one {# turn} other {# turns}}` and `{x, select, none {} other {…}}`.
- Arabic plural rules have six forms (`zero one two few many other`). Use them where counts appear.
- Keep sentences short and plain. Names of thinkers' works follow the forms used in `docs/GDD.md` §16.
- Adding a language: add a locale file, add it to `LANGUAGES` in `src/i18n/index.ts`, and add `{xx: "…"}` fields to the
  content JSON. `tx()` falls back to English for missing fields.
