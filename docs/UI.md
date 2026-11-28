# Interface design

The interface follows the fixed GUI roles of factory games, as Factorio's GUI API names them (`LuaGui` layers `top`,
`left`, `screen`, `center`, `relative`; elements `frame`, `sprite-button` with a number in the corner, `tabbed-pane`
with `badge_text`, `progressbar`). The content, art and ideas are this game's own. No assets, layouts or code were
copied.

## Regions: one job each

| Region | Job | Contents |
| --- | --- | --- |
| Top bar | **Time and money** (always visible, read at a glance) | Date, speed controls, year progress, Treasury, Debt, Money Trust; government buttons and menu on the right |
| Left column, over the map | **What to aim for, and what is wrong** | Goal card (chapter, Opulence and Maslaha against target), then Alerts (towns short of bread, workshops waiting, jammed roads, workshops with no buyers). Clicking an alert visits each case on the map in turn |
| Right panel, tabs | **Details of what you are looking at** | *Selected* (the workshop, town or tile you clicked), *Nation* (market slots, class satisfaction), *Council* (the two advisors). Selecting on the map switches to *Selected*. Badges count things needing attention |
| Bottom bar | **Act on the map** | Map views (overlays), the build hotbar (keys 1–9, cost in the corner, illustrated buildings), and *Skip to year end* |
| Tool windows | **Manage the state** | Budget (B), Taxes (T), Laws & charters (L), Institutions (I), Production statistics (P), Codex (C). They float, drag by the title bar, keep the map clickable and the clock running, and close with Esc or their key |
| Modal dialogs | **Decide** | Events, Reckonings, endings, policy debates, menus. These pause play and take focus |
| Corner widgets | **Context without asking** | Ghost of history (bottom-left), toasts (bottom-centre, never over a panel), tutorial card (top-centre) |

## Principles applied

- **One place for each kind of information.** Before, the right panel mixed the selection, the council, class
  satisfaction and prices in one long scroll, and the bottom bar mixed tools, policy cards, overlays and four
  buttons. Each now has its own region (Nielsen: consistency; aesthetic and minimalist design).
- **Goal next to problems.** The win condition and the alerts sit together, so the player always sees the gap and
  the cause (Factorio keeps goals in their own `goal` layer).
- **Recognition over recall.** Every button shows its hotkey in a `kbd` cap and its tooltip. Alerts are labelled rows,
  not bare icons. Laws show what they do, not just their name.
- **Visibility of system status.** Speed, year progress, workshop progress bars, input slots with the missing one
  ringed in red, badges on tabs and on *Laws* (cards played this year).
- **Non-modal by default.** Management screens no longer block the map or stop the clock. Only real decisions are
  modal.
- **Fitts's law.** Frequent targets are large and at the edges: the hotbar (42 px), *Skip to year end* (bottom
  corner), speed controls (top-left).
- **Two materials, two meanings.** Iron and brass mean *a tool you operate*. Parchment means *something to read*
  (events, codex, quotes, windows' bodies).
- **One icon language.** Emoji were replaced by a single line-icon set (`src/ui/Icon.tsx`, stroke = currentColor) and
  inked goods icons (`src/art/icons.ts`) that match the map art.
- **RTL and accessibility.** Logical CSS properties mirror the whole layout in Arabic. Tabs use `tablist`/`tab`,
  overlays a `radiogroup`, tool windows `role=dialog` with `aria-modal=false`; focus rings are visible on dark chrome.

## Files

- `src/ui/App.tsx`: layout, top bar, goal and alerts, tabbed panel, hotbar, government buttons.
- `src/ui/Modals.tsx`: `Dialog` (modal or floating tool window), every window and decision.
- `src/ui/hud.css`: the design system (tokens, spacing scale 4/8/12/16, chrome, slots, windows, breakpoints).
- `src/ui/styles.css`: base typography and the parchment reading surfaces.
