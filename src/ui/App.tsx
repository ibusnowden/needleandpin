// Screen layout (GDD §11): map in the centre, top bar, right panel, bottom bar with policy cards
// and End turn, ghost chart in the corner, pop-ups for events, Reckonings and the codex.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import codex from "../content/codex.json" with { type: "json" };
import { game, type Overlay, type Tool } from "../game/store.ts";
import { GHOSTS, ghostAt } from "../game/ghost.ts";
import { fmt, tx } from "../i18n/index.ts";
import { mountMap } from "../map/MapScene.ts";
import {
  BUILDINGS, GOODS, GOOD_IDS, POLICIES, POLICY_IDS, SCENARIOS, SIM, buildCost, capacity, chapterOf, explainShortage, indicators, infraCost,
  type Building, type BuildingType, type GameState, type Infra,
} from "../sim/index.ts";
import { scholarLine, scotsmanLine } from "./advisors.ts";
import { useGame } from "./hooks.ts";
import { LineChart } from "./LineChart.tsx";
import { iconUrl } from "../art/icons.ts";
import { buildingSprite, svgDataUrl } from "../art/sprites.ts";
import { Icon, type IconName } from "./Icon.tsx";
import { Modals } from "./Modals.tsx";

const bUrlCache = new Map<string, string>();
export const buildingUrl = (type: string) => {
  let u = bUrlCache.get(type);
  if (!u) { u = svgDataUrl(buildingSprite(type).svg); bUrlCache.set(type, u); }
  return u;
};

/** An inventory slot: icon, count bottom-right, incoming bottom-left, hotkey top-left, price tag top-right. */
export function Slot({ icon, count, incoming, keyHint, tag, title, onClick, on, className }: {
  icon: string; count?: string; incoming?: string; keyHint?: string; tag?: { text: string; kind: "up" | "down" | "flat" }; title?: string;
  onClick?: () => void; on?: boolean; className?: string;
}) {
  const inner = (
    <>
      <img src={icon} alt="" />
      {keyHint && <span className="key">{keyHint}</span>}
      {tag && <span className={`tag ${tag.kind}`}>{tag.text}</span>}
      {incoming && <span className="incoming">{incoming}</span>}
      {count !== undefined && <span className="count">{count}</span>}
    </>
  );
  return onClick
    ? <button className={`slot ${on ? "on" : ""} ${className ?? ""}`} title={title} aria-label={title} onClick={onClick}>{inner}</button>
    : <span className={`slot ${className ?? ""}`} title={title}>{inner}</span>;
}

const short = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n >= 10 ? Math.round(n).toString() : n.toFixed(1));
const CODEX = new Map(codex.map((c) => [c.id, c]));
export const codexTitle = (id: string) => tx(CODEX.get(id)?.title) || id;

export function BrandCrest({ size = 24 }: { size?: number }) {
  return (
    <svg className="brand-crest" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#1b1815" stroke="#c89b2c" strokeWidth="1.4" />
      <path d="M16 4l2.5 5.5L24 12l-5.5 2.5L16 20l-2.5-5.5L8 12l5.5-2.5z" fill="none" stroke="#8a6a1e" strokeWidth="0.8" opacity="0.6" />
      <line x1="8" y1="24" x2="23" y2="9" stroke="#efe6cf" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="23.5" cy="8.5" r="2.6" fill="#e8c766" stroke="#2a2018" strokeWidth="0.7" />
      <line x1="9" y1="9" x2="23" y2="23" stroke="#7bc4f0" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="9.2" cy="9.2" rx="1.6" ry="0.9" transform="rotate(-45 9.2 9.2)" fill="none" stroke="#efe6cf" strokeWidth="0.9" />
    </svg>
  );
}

export function App() {
  const { s, ui } = useGame();
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mapRef.current) return;
    const g = mountMap(mapRef.current);
    return () => g.destroy(true);
  }, []);
  useHotkeys();
  return (
    <div className="app" style={{ fontSize: `${ui.textScale * 100}%` }}>
      {s && <TopBar s={s} />}
      <div className="middle">
        <div className="map" ref={mapRef} aria-label={useTranslation().t("a11y.map")} role="application" />
        {s && (
          <div className="hud-left">
            <GoalPanel s={s} />
            <Alerts s={s} />
          </div>
        )}
        {s?.tutorial && <TutorialPanel s={s} />}
        {s && <GhostMini s={s} />}
        {s && <MapControls />}
        {s && ui.tool.kind !== "inspect" && <ToolBanner s={s} tool={ui.tool} />}
        <Toasts />
        {s && <SidePanel s={s} />}
      </div>
      {s && <BottomBar s={s} />}
      <Modals />
    </div>
  );
}

function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      const s = game.state;
      const win = isToolWindow(game.ui.modal?.kind);
      if (e.key === " " && s && (!game.ui.modal || win)) { e.preventDefault(); game.setSpeed(game.ui.speed ? 0 : 1); return; }
      if (e.key === "." && s) { game.setSpeed(Math.min(4, Math.max(1, game.ui.speed * 2))); return; }
      if (e.key === "," && s) { game.setSpeed(game.ui.speed <= 1 ? 0 : game.ui.speed / 2); return; }
      if ((e.key === "+" || e.key === "=") && s && !game.ui.modal) { game.mapZoom(1.16); return; }
      if (e.key === "-" && s && !game.ui.modal) { game.mapZoom(0.86); return; }
      if (e.key === "Escape") { game.setUi(game.ui.modal && !["title", "event", "reckoning", "ending"].includes(game.ui.modal.kind) ? { modal: null } : { tool: { kind: "inspect" }, selected: null }); return; }
      if (!s || (game.ui.modal && !win)) return;
      const k = e.key.toLowerCase();
      const gov = GOV.find((x) => x.key.toLowerCase() === k);
      if (k === "e") void game.endTurn();
      else if (k === "v") game.setUi({ altMode: !game.ui.altMode });
      else if (gov) toggleWindow(gov.kind);
      else if (k === "o") {
        const order: Overlay[] = ["none", "traffic", "reach", "prices", "wages", "mood"];
        game.setUi({ overlay: order[(order.indexOf(game.ui.overlay) + 1) % order.length] });
      } else if (/^[1-9]$/.test(k)) {
        const tools = toolList(s);
        const tl = tools[Number(k) - 1];
        if (tl) game.setUi({ tool: tl.tool });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// ---------------------------------------------------------------- top bar
function Meter({ id, value, target }: { id: "opulence" | "maslaha"; value: number; target: number }) {
  const { t } = useTranslation();
  const ok = value >= target;
  return (
    <button className={`meter meter-${id}`} onClick={() => game.setUi({ modal: { kind: "meter", meter: id } })} aria-label={`${t(`top.${id}`)} ${fmt(value)}`}>
      <span className="meter-label">{t(`top.${id}`)}</span>
      <span className="meter-bar"><span className="meter-fill" style={{ width: `${value}%` }} /><span className="meter-target" style={{ insetInlineStart: `${target}%` }} /></span>
      <span className="meter-value">{fmt(value)} <small>{ok ? "✓" : ""} {t("top.target", { v: fmt(target) })}</small></span>
    </button>
  );
}

function GovNav({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const { ui } = useGame();
  const open = ui.modal?.kind;
  return (
    <nav className="gov" aria-label={t("gov.label")}>
      {GOV.map((g) => {
        const badge = g.kind === "laws" ? `${s.policyChangesThisTurn}/2` : g.kind === "institutions" && s.developing ? "•" : g.kind === "codex" ? String(s.discovered.length) : "";
        return (
          <button key={g.kind} className={open === g.kind ? "on" : ""} aria-pressed={open === g.kind} onClick={() => toggleWindow(g.kind)} title={`${t(g.label)} (${g.key})`}>
            <Icon name={g.icon} /><span className="gov-label">{t(g.short)}</span>{badge && <span className="badge">{badge}</span>}<kbd>{g.key}</kbd>
          </button>
        );
      })}
    </nav>
  );
}

function TopBar({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const spendPerTurn = Math.max(1e-6, s.spending);
  const cover = Math.floor(s.treasury / spendPerTurn);
  return (
    <header className="topbar">
      <div className="brand">
        <BrandCrest size={26} />
        <span>{t("app.title")}</span>
      </div>
      <div className="clock">
        <div className="stat date"><small>{t(`time.month.${Math.floor(s.day / 30)}`)}</small><b>{s.scenario === "needle" ? fmt(s.year) : s.year}</b></div>
        <TimeControls />
      </div>
      <span className="sep" aria-hidden />
      <div className="stat" title={t("top.turnsCover", { n: cover })}><small>{t("top.treasury")}</small><b>{fmt(s.treasury)}</b><small>{t("top.revenue")} {fmt(s.revenue, 1)}</small></div>
      <div className="stat"><small>{t("top.debt")}</small><b>{fmt(s.debt)}</b><small>{fmt(s.interestRate * 100, 1)}%</small></div>
      <div className={`stat ${s.money.trust < 50 ? "warn" : ""}`}><small>{t("top.trust")}</small><b>{fmt(s.money.trust)}</b><small>{s.money.trust < 50 ? "▼" : "✓"}</small></div>
      <span className="spacer" />
      <GovNav s={s} />
      <button className="icon-btn" onClick={() => game.setUi({ modal: { kind: "menu" } })} title={t("menu.menu")} aria-label={t("menu.menu")}><Icon name="menu" /></button>
    </header>
  );
}

function TimeControls() {
  const { t } = useTranslation();
  const { s, ui } = useGame();
  const speeds = [0, 1, 2, 4];
  return (
    <div className="time" role="group" aria-label={t("time.label")}>
      {speeds.map((v) => (
        <button key={v} className={ui.speed === v ? "on" : ""} onClick={() => game.setSpeed(v)} title={`${t(`time.speed${v}`)} (${v === 0 ? t("time.keySpace") : ", ."})`} aria-label={t(`time.speed${v}`)} aria-pressed={ui.speed === v}>
          <Icon name={v === 0 ? "pause" : v === 1 ? "play" : v === 2 ? "play2" : "play4"} size={14} />
        </button>
      ))}
      <span className="yearbar" title={t("time.progress")}><span style={{ width: `${((s?.day ?? 0) / 360) * 100}%` }} /></span>
    </div>
  );
}

function MapControls() {
  const { t } = useTranslation();
  const { ui } = useGame();
  return (
    <div className="map-controls" role="group" aria-label={t("overlay.label")}>
      <button className={ui.altMode ? "on" : ""} aria-pressed={ui.altMode} onClick={() => game.setUi({ altMode: !ui.altMode })} title={t("overlay.alt")} aria-label={t("overlay.alt")}>
        <Icon name="alt" size={16} />
      </button>
      <span className="sep-h" aria-hidden />
      <button onClick={() => game.mapZoom(1.18)} title={t("overlay.zoomIn")} aria-label={t("overlay.zoomIn")}><Icon name="zoomIn" size={16} /></button>
      <button onClick={() => game.mapZoom(0.84)} title={t("overlay.zoomOut")} aria-label={t("overlay.zoomOut")}><Icon name="zoomOut" size={16} /></button>
      <button onClick={() => game.mapCentre()} title={t("overlay.fit")} aria-label={t("overlay.fit")}><Icon name="fit" size={16} /></button>
    </div>
  );
}

function ToolBanner({ s, tool }: { s: GameState; tool: Exclude<Tool, { kind: "inspect" }> }) {
  const { t } = useTranslation();
  let label = "";
  let cost: number | undefined;
  let desc = "";
  if (tool.kind === "build") {
    label = t(`building.${tool.building}.name`);
    cost = buildCost(s, tool.building);
    desc = t(`building.${tool.building}.desc`);
  } else if (tool.kind === "infra") {
    label = t(`tool.${tool.infra}`);
    cost = infraCost(s, tool.infra, "plains");
  } else if (tool.kind === "foundTown") {
    label = t("tool.foundTown");
  } else {
    label = t("tool.demolish");
  }
  return (
    <div className="tool-banner">
      <b>{label}</b>
      {cost !== undefined && <span>· {t("tool.cost", { c: fmt(cost) })}</span>}
      {desc && <small className="muted">· {desc}</small>}
      <kbd>Esc</kbd>
    </div>
  );
}

// ---------------------------------------------------------------- bottom bar
type ToolEntry = { tool: Tool; label: string; group: string; cost?: number; icon?: IconName };
export function toolList(s: GameState): ToolEntry[] {
  const out: ToolEntry[] = [];
  const groups: Record<string, BuildingType[]> = {
    raw: ["farm", "pasture", "lumber", "mine"],
    craft: ["bakery", "weaver", "smithy", "builder", "pinworks"],
    civic: ["courthouse", "school", "granary", "port"],
  };
  for (const [group, types] of Object.entries(groups)) for (const b of types) out.push({ tool: { kind: "build", building: b }, label: `building.${b}.name`, group, cost: buildCost(s, b) });
  const infra: Infra[] = ["road", ...(s.institutions.canals ? (["canal"] as Infra[]) : []), ...(s.institutions.railways ? (["rail"] as Infra[]) : [])];
  for (const i of infra) out.push({ tool: { kind: "infra", infra: i }, label: `tool.${i}`, group: "works", cost: infraCost(s, i, "plains"), icon: i });
  out.push({ tool: { kind: "foundTown" }, label: "tool.foundTown", group: "works", icon: "town" });
  out.push({ tool: { kind: "demolish" }, label: "tool.demolish", group: "works", icon: "demolish" });
  return out;
}

const sameTool = (a: Tool, b: Tool) => JSON.stringify(a) === JSON.stringify(b);

/** Management windows: one button each, with its hotkey (recognition over recall). */
const GOV: { kind: "budget" | "tax" | "laws" | "institutions" | "stats" | "codex"; icon: IconName; label: string; short: string; key: string }[] = [
  { kind: "budget", icon: "budget", label: "budget.title", short: "gov.budget", key: "B" },
  { kind: "tax", icon: "tax", label: "tax.title", short: "gov.tax", key: "T" },
  { kind: "laws", icon: "laws", label: "laws.title", short: "gov.laws", key: "L" },
  { kind: "institutions", icon: "institutions", label: "inst.title", short: "gov.institutions", key: "I" },
  { kind: "stats", icon: "stats", label: "stats.title", short: "gov.stats", key: "P" },
  { kind: "codex", icon: "codex", label: "menu.codex", short: "gov.codex", key: "C" },
];
const TOOL_WINDOWS = new Set(["budget", "tax", "laws", "institutions", "stats", "codex", "meter", "ghost"]);
export const isToolWindow = (k?: string) => !!k && TOOL_WINDOWS.has(k);
function toggleWindow(kind: (typeof GOV)[number]["kind"]) {
  game.setUi({ modal: game.ui.modal?.kind === kind ? null : { kind } });
}

const OVERLAYS: { id: Overlay; icon: IconName }[] = [
  { id: "none", icon: "none" }, { id: "traffic", icon: "traffic" }, { id: "reach", icon: "reach" },
  { id: "prices", icon: "prices" }, { id: "wages", icon: "wages" }, { id: "mood", icon: "mood" },
];

function BottomBar({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const { ui } = useGame();
  const tools = toolList(s);
  const groups = ["raw", "craft", "civic", "works"];
  return (
    <footer className="bottombar">
      <div className="dock" role="radiogroup" aria-label={t("overlay.label")}>
        <small className="dock-label">{t("overlay.label")} <kbd>O</kbd></small>
        <div className="seg">
          {OVERLAYS.map((o) => (
            <button key={o.id} role="radio" aria-checked={ui.overlay === o.id} className={ui.overlay === o.id ? "on" : ""}
              onClick={() => game.setUi({ overlay: o.id })} title={t(`overlay.${o.id}`)} aria-label={t(`overlay.${o.id}`)}>
              <Icon name={o.icon} />
            </button>
          ))}
        </div>
      </div>
      <div className="hotbar" role="toolbar" aria-label={t("tool.label")}>
        <div className="tool-group">
          <small className="dock-label">&nbsp;</small>
          <div>
            <button className={`tool slot ${ui.tool.kind === "inspect" ? "on" : ""}`} onClick={() => game.setUi({ tool: { kind: "inspect" } })} title={`${t("tool.inspect")} (Esc)`} aria-label={t("tool.inspect")}>
              <Icon name="inspect" size={20} />
            </button>
          </div>
        </div>
        {groups.map((g) => (
          <div className="tool-group" key={g}>
            <small className="dock-label">{t(`tool.groups.${g}`)}</small>
            <div>
              {tools.filter((x) => x.group === g).map((x) => {
                const i = tools.indexOf(x);
                const afford = x.cost === undefined || s.treasury >= x.cost;
                return (
                  <button key={i} className={`tool slot ${sameTool(ui.tool, x.tool) ? "on" : ""} ${afford ? "" : "dim"}`}
                    onClick={() => game.setUi({ tool: x.tool })}
                    title={`${t(x.label)}${x.cost !== undefined ? ` · ${t("tool.cost", { c: fmt(x.cost) })}` : ""}${!afford ? ` · ${t("tool.cantAfford")}` : ""}${x.tool.kind === "build" ? `\n${t(`building.${x.tool.building}.desc`)}` : ""}${i < 9 ? ` (${i + 1})` : ""}`}
                    aria-label={t(x.label)}>
                    {x.tool.kind === "build" ? <img src={buildingUrl(x.tool.building)} alt="" /> : <Icon name={x.icon!} size={20} />}
                    {i < 9 && <span className="key">{i + 1}</span>}
                    {x.cost !== undefined && <span className="count">{short(x.cost)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button className="end-turn" disabled={ui.busy || s.status !== "playing"} onClick={() => void game.endTurn()} title={`${t("time.skip")} (E)`}>
        <span>{ui.busy ? t("top.busy") : s.pendingEvent ? t("event.title") : t("time.skip")}</span>
        <Icon name="skip" size={16} />
        <kbd>E</kbd>
      </button>
    </footer>
  );
}

export function PolicyHand({ s }: { s: GameState }) {
  const { t } = useTranslation();
  return (
    <div className="hand">
      <p className="small">{t("policy.limit", { n: s.policyChangesThisTurn })}</p>
      <div className="cards">
        {POLICY_IDS.map((id) => (
          <button key={id} className={`card ${s.policies[id] ? "active" : ""}`} onClick={() => game.setUi({ modal: { kind: "policy", id } })}>
            <span className="card-name">{t(`policy.${id}.name`)}</span>
            <span className="card-desc">{t(`policy.${id}.desc`)}</span>
            <span className="card-state">{s.policies[id] ? t("policy.active") : t("policy.inactive")}</span>
          </button>
        ))}
        {s.institutions.coinage && (
          <button className="card danger" onClick={() => game.setUi({ modal: { kind: "policy", id: "debase" } })}>
            <span className="card-name">{t("policy.debase.name")}</span>
            <span className="card-desc">{t("policy.debase.desc")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- right panel
type Tab = "sel" | "nation" | "council";
function SidePanel({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const { ui } = useGame();
  const sel = ui.selected;
  const tile = sel && s.tiles.find((x) => x.q === sel.q && x.r === sel.r);
  const b = sel && s.buildings.find((x) => x.q === sel.q && x.r === sel.r);
  const town = sel && s.towns.find((x) => x.q === sel.q && x.r === sel.r);
  const [tab, setTab] = useState<Tab>("nation");
  const selKey = sel ? `${sel.q},${sel.r}` : "";
  useEffect(() => { setTab(selKey ? "sel" : "nation"); }, [selKey]);
  const dear = GOOD_IDS.filter((g) => s.markets.some((m) => m.short[g] > 0.05)).length;
  const unhappy = (["laborers", "merchants", "landlords"] as const).filter((c) => s.classes[c].satisfaction < 35).length;
  const tabs: { id: Tab; label: string; badge?: string; disabled?: boolean }[] = [
    { id: "sel", label: b ? t(`building.${b.type}.name`) : town ? t(`town.${town.name}`, { defaultValue: town.name }) : t("tabs.selected"), disabled: !tile },
    { id: "nation", label: t("tabs.nation"), badge: dear + unhappy ? String(dear + unhappy) : undefined },
    { id: "council", label: t("tabs.council") },
  ];
  return (
    <aside className="sidepanel" aria-label={t("tabs.label")}>
      <div className="tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? "on" : ""} disabled={x.disabled} onClick={() => setTab(x.id)}>
            <span className="tab-label">{x.label}</span>{x.badge && <span className="badge">{x.badge}</span>}
          </button>
        ))}
      </div>
      <div className="tab-body" role="tabpanel" aria-live="polite">
        {tab === "sel" && tile && (
          <>
            {b && <BuildingPanel s={s} b={b} />}
            {town && (
              <section>
                <h3>{t(`town.${town.name}`, { defaultValue: town.name })}</h3>
                <dl>
                  <dt>{t("panel.pop")}</dt><dd>{fmt(town.pop * s.calibration.popScale)}</dd>
                  <dt>{t("panel.mood")}</dt><dd>{fmt(town.mood)} {town.mood < 35 ? "▼" : town.mood > 60 ? "▲" : ""}</dd>
                </dl>
                <TownMarket s={s} townId={town.id} />
              </section>
            )}
            <p className="muted small terrain-line">
              {t(`terrain.${tile.terrain}`)}{tile.river ? ` · ${t("terrain.river")}` : ""}{tile.coast ? ` · ${t("terrain.coast")}` : ""}{tile.deposit ? ` · ${t("terrain.deposit")}` : ""}{s.infra[`${tile.q},${tile.r}`] ? ` · ${t(`infra.${s.infra[`${tile.q},${tile.r}`]}`)}` : ""}
            </p>
            {!b && !town && <p className="muted small">{t("panel.emptyTile")}</p>}
          </>
        )}
        {tab === "nation" && (
          <>
            {!tile && <p className="muted small hint">{t("panel.nothing")}</p>}
            <Market s={s} />
            <Classes s={s} />
          </>
        )}
        {tab === "council" && <Council s={s} />}
      </div>
    </aside>
  );
}

function BuildingPanel({ s, b }: { s: GameState; b: Building }) {
  const { t } = useTranslation();
  const def = BUILDINGS[b.type];
  if (!def.good) {
    return <section><h3>{t(`building.${b.type}.name`)}</h3><p className="small">{t(`building.${b.type}.desc`)}</p><p className="muted small">{t("panel.civic")}</p></section>;
  }
  const g = s.goods[def.good];
  const e = b.explain;
  const handsReq = SIM.workersPerLevel * b.level;
  const handsPct = Math.min(100, (b.workers / Math.max(1, handsReq)) * 100);
  // Group live carts in transit for this workshop by destination/origin town.
  const outCarts = s.carts.filter((c) => c.from === b.id);
  const inCarts = s.carts.filter((c) => c.dest === `b:${b.id}`);
  const outByTown = new Map<string, number>();
  for (const c of outCarts) outByTown.set(c.dest, (outByTown.get(c.dest) ?? 0) + c.qty);
  return (
    <section>
      <div className="entity-head">
        <img className="entity-thumb" src={buildingUrl(b.type)} alt="" />
        <div>
          <h3>{t(`building.${b.type}.name`)}</h3>
          <p className={`status status-${b.status}`}>● {t(`status.${b.status}`, { good: b.missing ? t(`good.${b.missing}`) : "" })}</p>
          <div className="levels" aria-label={t("panel.levelOf", { level: b.level })}>
            {[1, 2, 3, 4, 5].map((lv) => <span key={lv} className={`lv ${lv <= b.level ? "on" : lv <= b.maxLevel ? "can" : ""}`}>{lv}</span>)}
          </div>
          {b.private && <p className="small muted">✦ {t("panel.private")}</p>}
        </div>
      </div>
      <Recipe b={b} />
      <WhyShort s={s} b={b} />
      <div className="spec-bars">
        <div className="spec-row">
          <small>{t("panel.specHands")}</small>
          <small className={b.workers >= handsReq ? "good" : ""}>{b.level < 5 ? `${fmt(b.workers, 1)} / ${handsReq}` : "MAX"}</small>
          <span className={`bar ${b.workers >= handsReq ? "good" : ""}`}><span style={{ width: `${b.level >= 5 ? 100 : handsPct}%` }} /></span>
        </div>
        <div className="spec-row">
          <small>{t("panel.specReach")} <WhyLink id="extent-of-market" /></small>
          <small>{t("panel.levelOf", { level: b.maxLevel })} · {fmt(b.reach)}</small>
          <span className={`bar ${b.maxLevel > b.level ? "good" : "warn"}`}><span style={{ width: `${(b.maxLevel / 5) * 100}%` }} /></span>
        </div>
      </div>
      {e && (
        <p className="explain">{t("panel.explain", {
          out: fmt(b.output, 1), workers: fmt(e.workers, 1), base: fmt(e.base, 1), spec: fmt(e.specMult, 2), cap: fmt(e.capitalMult, 2),
          terrain: e.terrainMult !== 1 ? fmt(e.terrainMult, 2) : "none", fill: e.inputFill < 0.999 ? `${fmt(e.inputFill * 100)}%` : "none",
        })} <WhyLink id="division-of-labour" /></p>
      )}
      <dl>
        <dt>{t("panel.workers")}</dt><dd>{fmt(b.workers, 1)} / {capacity(b.level)}</dd>
        <dt>{t("panel.wage")}</dt><dd>{fmt(b.wage, 2)} <small className="muted">(avg {fmt(s.labor.avgWage, 2)})</small></dd>
        <dt>{t("panel.price")}</dt><dd>{fmt(g.price, 3)} <small className="muted">{t("panel.natural", { p: fmt(g.natural, 3) })}</small> <WhyLink id="natural-price" /></dd>
        <dt>{t("panel.sold")}</dt><dd>{fmt(b.sold * 100)}%</dd>
        <dt>{t("panel.capital")}</dt><dd>{fmt(b.capital, 1)}</dd>
      </dl>
      {(outByTown.size > 0 || inCarts.length > 0) ? (
        <div className="carts-box">
          {Array.from(outByTown.entries()).map(([dest, qty]) => {
            const tw = dest.startsWith("m:") ? s.towns.find((x) => x.id === dest.slice(2)) : undefined;
            const label = tw ? t(`town.${tw.name}`, { defaultValue: tw.name }) : dest;
            return tw ? (
              <button key={dest} className="cart-link" onClick={() => game.setUi({ selected: { q: tw.q, r: tw.r } })}>
                <span>{t("panel.cartsOut")} → {label}</span><b>{qty}</b>
              </button>
            ) : <span key={dest} className="small muted">{t("panel.cartsOut")} → {label}: {qty}</span>;
          })}
          {inCarts.length > 0 && <small className="muted">{t("panel.cartsIn")}: {inCarts.length}</small>}
        </div>
      ) : <p className="small muted">{t("panel.noCarts")}</p>}
      <div className="traits">
        <small>{t("panel.traits")}:</small>
        <span className={b.level >= 2 ? "on" : ""}>{t("panel.trait.dexterity")}</span>
        <span className={b.level >= 3 ? "on" : ""}>{t("panel.trait.noSwitching")}</span>
        <span className={b.level >= 4 ? "on" : ""}>{t("panel.trait.machines")}</span>
      </div>
    </section>
  );
}

export /** The bottleneck explainer: the upstream cause of a shortage, in one sentence, with a jump link. */
function WhyShort({ s, b }: { s: GameState; b: Building }) {
  const { t } = useTranslation();
  const e = explainShortage(s, b);
  if (!e) return null;
  const v: Record<string, string | number> = { ...e.vars };
  for (const k of ["good", "upstream"]) if (typeof v[k] === "string") v[k] = t(`good.${v[k]}`);
  if (typeof v.building === "string") v.building = t(`building.${v.building}.name`);
  return (
    <p className="why-short">
      ⚠ {t(e.key, v)}{" "}
      {e.focus && <button className="link" onClick={() => game.setUi({ selected: e.focus! })}>{t("why.show")}</button>}
    </p>
  );
}

/** Inputs → progress → output, as Factorio-style machine slots. */
function Recipe({ b }: { b: Building }) {
  const { t } = useTranslation();
  const def = BUILDINGS[b.type];
  const g = def.good!;
  const inputs = [...Object.keys(GOODS[g].inputs), ...(GOODS[g].land ? ["tools"] : [])];
  const rate = b.output / 360;
  return (
    <div className="recipe-box">
      <div className="recipe">
        {inputs.map((ig) => {
          const have = b.inBuf[ig as keyof typeof b.inBuf] ?? 0, coming = b.incoming[ig as keyof typeof b.incoming] ?? 0;
          return <Slot key={ig} icon={iconUrl(ig)} count={short(have)} incoming={coming > 0 ? `+${short(coming)}` : undefined}
            className={b.missing === ig ? "short" : have < 0.5 ? "empty" : ""}
            title={`${t(`good.${ig}`)}: ${fmt(have, 1)} · +${fmt(coming)} ${t("panel.onTheWay")}`} />;
        })}
        <div className="arrow">
          <div className="recipe-rate"><span>{fmt(rate * 30, 1)} / {t("time.monthShort")}</span><span>{Math.round(b.inputFill * 100)}%</span></div>
          <div className={`progress ${b.status === "starved" ? "starved" : ""}`}><span style={{ width: `${Math.round((b.status === "working" ? b.cycle : b.inputFill) * 100)}%` }} /></div>
        </div>
        <Slot icon={iconUrl(g)} count={short(b.outBuf)} title={`${t("panel.outStore")}: ${fmt(b.outBuf, 1)} ${t(`good.${g}`)}`} />
      </div>
      <div className="workers" title={`${t("panel.workers")}: ${fmt(b.workers, 1)} / ${capacity(b.level)}`}>
        {Array.from({ length: capacity(b.level) }, (_, i) => (
          <i key={i} style={{ background: i < Math.round(b.workers) ? ROLE_CSS[i % b.level] : "transparent", opacity: i < Math.round(b.workers) ? 1 : 0.35 }} />
        ))}
      </div>
    </div>
  );
}

const ROLE_CSS = ["#c8553d", "#2c5d8f", "#c89b2c", "#4fa3a5", "#8a5aa8"];

export function WhyLink({ id }: { id: string }) {
  const { t } = useTranslation();
  return <button className="why" onClick={() => game.setUi({ modal: { kind: "codex", entry: id } })}>{t("panel.why")}</button>;
}

function TownMarket({ s, townId }: { s: GameState; townId: string }) {
  const { t } = useTranslation();
  const m = s.markets.find((x) => x.town === townId);
  if (!m) return null;
  return (
    <>
      <small className="muted">{t("panel.localMarket")}</small>
      <div className="slots">
        {GOOD_IDS.map((g) => {
          const r = m.price[g] / s.goods[g].natural;
          return <Slot key={g} icon={iconUrl(g)} count={short(m.stock[g])} className={m.short[g] > 0.05 ? "short" : m.stock[g] < 0.5 ? "empty" : ""}
            tag={{ text: `${Math.round(r * 100)}%`, kind: r > 1.15 ? "up" : r < 0.87 ? "down" : "flat" }}
            title={`${t(`good.${g}`)} · ${fmt(m.stock[g], 1)} · ${fmt(r * 100)}% ${t("panel.natural", { p: "" })}`} />;
        })}
      </div>
    </>
  );
}

function Council({ s }: { s: GameState }) {
  const { t } = useTranslation();
  return (
    <section className="council">
      <h4>{t("advisor.title")}</h4>
      {(["scotsman", "scholar"] as const).map((a) => {
        const adv = s.advisors[a];
        const line = a === "scotsman" ? scotsmanLine(s) : scholarLine(s);
        return (
          <div key={a} className={`advisor advisor-${a}`}>
            <div className="advisor-head"><b>{t(`advisor.${a}.name`)}</b> <small className="muted">{t(`advisor.${a}.inspired`)} · {t("advisor.trust", { t: fmt(adv.trust) })}</small></div>
            <p>{adv.resigned ? <em>{t("advisor.resigned")}</em> : `“${t(`advisor.say.${a}.${line}`)}”`}</p>
          </div>
        );
      })}
    </section>
  );
}

function Classes({ s }: { s: GameState }) {
  const { t } = useTranslation();
  return (
    <section>
      <h4>{t("class.satisfaction")}</h4>
      {(["laborers", "merchants", "landlords"] as const).map((c) => {
        const cl = s.classes[c];
        const lvl = cl.satisfaction < 25 ? "bad" : cl.satisfaction < 45 ? "warn" : "good";
        return (
          <div key={c} className="classrow" title={t(`class.${c}Want`)}>
            <span>{t(`class.${c}`)}</span>
            <span className={`bar ${lvl}`}><span style={{ width: `${cl.satisfaction}%` }} /></span>
            <span className="num">{fmt(cl.satisfaction)}{lvl === "bad" ? " !" : ""}</span>
          </div>
        );
      })}
    </section>
  );
}

function Market({ s }: { s: GameState }) {
  const { t } = useTranslation();
  return (
    <section>
      <h4>{t("panel.markets")} <WhyLink id="natural-price" /></h4>
      <div className="slots">
        {GOOD_IDS.map((g) => {
          const gs = s.goods[g];
          const r = gs.price / gs.natural;
          return <Slot key={g} icon={iconUrl(g)} count={short(gs.stock)}
            tag={{ text: `${Math.round(r * 100)}%`, kind: r > 1.15 ? "up" : r < 0.87 ? "down" : "flat" }}
            title={`${t(`good.${g}`)} (${t(`tier.${GOODS[g].need ?? GOODS[g].tier}`)}) · ${fmt(gs.price, 3)} · ${fmt(r * 100)}%`} />;
        })}
      </div>
      <p className="small muted">{t("panel.slotLegend")}</p>
    </section>
  );
}

// ---------------------------------------------------------------- goal (what to aim for) and alerts (what is wrong)
function GoalPanel({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const def = SCENARIOS[s.scenario];
  const ch = def.chapters[s.chapter];
  return (
    <section className="hud-card goal" aria-label={t("goal.title")}>
      <header>
        <span className="hud-title">{t("goal.title")}</span>
        <small>{t("top.chapter", { n: s.chapter + 1, total: def.chapters.length })} · {t("goal.until", { y: ch.end })}</small>
      </header>
      <Meter id="opulence" value={s.meters.opulence.value} target={def.targets.opulence} />
      <Meter id="maslaha" value={s.meters.maslaha.value} target={def.targets.maslaha} />
      {s.meters.goodSociety && <span className="badge-good">★ {t("top.goodSociety")}</span>}
    </section>
  );
}

function Alerts({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const starved = s.buildings.filter((b) => b.status === "starved");
  const blocked = s.buildings.filter((b) => b.status === "blocked");
  const jamTiles = s.tiles.map((tile, i) => ({ tile, j: s.jam[i] ?? 0 })).filter((x) => x.j > 1).sort((a, b) => b.j - a.j);
  const shortTowns = s.towns.filter((tw) => { const m = s.markets.find((x) => x.town === tw.id); return m && (m.short.bread > 0.05 || m.stock.bread < 0.5); });
  const rows: { kind: "starved" | "blocked" | "jam" | "short"; n: number; list: { q: number; r: number }[]; overlay?: Overlay }[] = [
    { kind: "short", n: shortTowns.length, list: shortTowns },
    { kind: "starved", n: starved.length, list: starved },
    { kind: "jam", n: jamTiles.length, list: jamTiles.map((x) => x.tile), overlay: "traffic" },
    { kind: "blocked", n: blocked.length, list: blocked },
  ];
  const active = rows.filter((r) => r.n > 0);
  const cycle = (r: (typeof rows)[number]) => {
    const i = (Number(game.flags[r.kind] ?? -1) + 1) % r.list.length;
    game.flags[r.kind] = i;
    game.setUi({ selected: { q: r.list[i].q, r: r.list[i].r }, ...(r.overlay ? { overlay: r.overlay } : {}) });
  };
  return (
    <section className="hud-card alerts" aria-label={t("alerts.label")}>
      <header><span className="hud-title">{t("alerts.label")}</span></header>
      {!active.length && <p className="all-clear"><Icon name="ok" size={14} /> {t("alerts.allClear")}</p>}
      {active.map((r) => (
        <button key={r.kind} className={`alert-row a-${r.kind}`} onClick={() => cycle(r)} title={t(`alerts.${r.kind}`, { n: r.n })}>
          <Icon name={r.kind} size={15} /><span>{t(`alerts.short.${r.kind}`)}</span><b>{r.n}</b>
        </button>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------- ghost mini chart (corner)
export function ghostSeries(s: GameState, which: "gdppc" | "realWage") {
  const g = GHOSTS[s.scenario];
  const you = s.history.map((h) => [h.year, which === "gdppc" ? h.gdppc : h.realWage] as [number, number]);
  const hist = g ? g.series[which].points.filter((p) => p[0] <= Math.max(s.year, g.startYear + 1)).map((p) => [p[0], p[1]] as [number, number]) : [];
  return { you, hist, g };
}

function GhostMini({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const { you, hist, g } = ghostSeries(s, "gdppc");
  if (!g) return null;
  const last = s.history[s.history.length - 1];
  const gp = ghostAt(g.series.gdppc, last.year);
  const ratio = gp ? last.gdppc / gp[1] : undefined;
  return (
    <button className="ghost-mini" onClick={() => game.setUi({ modal: { kind: "ghost" } })} title={t("ghost.expand")}>
      <div className="ghost-head"><b>{t("ghost.title")}</b>{ratio !== undefined && <span className={ratio >= 0.995 ? "good" : "bad"}>{t("ghost.ahead", { p: fmt(ratio * 100) })}</span>}</div>
      <LineChart compact width={226} height={92} series={[
        { id: "h", label: t("ghost.history"), points: hist, color: "#7a7266", dashed: true },
        { id: "y", label: t("ghost.you"), points: you, color: "#d55e00" },
      ]} />
      <small className="muted">{t("ghost.gdppc")} · {t("ghost.units.gdppc")}</small>
    </button>
  );
}

// ---------------------------------------------------------------- tutorial (§15 B)
function TutorialPanel({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const def = SCENARIOS[s.scenario];
  const has = (c: string) => s.buildings.some((b) => BUILDINGS[b.type].rootCraft === c);
  const pin = s.buildings.find((b) => b.type === "pinworks");
  const step = !s.tutorial!.marketFormed ? 0 : !pin ? 1 : pin.maxLevel < 2 ? 2 : !s.institutions.coinage ? 3 : 4;
  return (
    <div className="tutorial">
      <b>{t("tutorial.title")}</b> <small className="muted">{t("tutorial.goal", { o: def.targets.opulence, m: def.targets.maslaha })}</small>
      <div className="crafts">
        <small>{t("tutorial.crafts")}:</small>
        {(["farming", "weaving", "building", "governance"] as const).map((c) => <span key={c} className={has(c) ? "on" : ""}>{has(c) ? "✓" : "○"} {t(`tutorial.craft.${c}`)}</span>)}
        <WhyLink id="root-crafts" />
      </div>
      <p>{t(`tutorial.step${step}`)}</p>
    </div>
  );
}

// ---------------------------------------------------------------- toasts
function Toasts() {
  const { t } = useTranslation();
  const { ui } = useGame();
  return (
    <div className="toasts" aria-live="assertive">
      {ui.toasts.map((x) => (
        <div key={x.id} className={`toast toast-${x.kind}`} onClick={() => x.kind === "discovery" && game.setUi({ modal: { kind: "codex", entry: String(x.vars?.id) } })}>
          {x.kind === "discovery" ? <>✦ {t("toast.discovered", { title: codexTitle(String(x.vars?.id)) })} <small>{tx(CODEX.get(String(x.vars?.id))?.ref)}</small></> : t(x.key, x.vars ?? {})}
        </div>
      ))}
    </div>
  );
}

export { indicators, chapterOf, POLICIES };
