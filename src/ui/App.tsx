// Screen layout (GDD §11): map in the centre, top bar, right panel, bottom bar with policy cards
// and End turn, ghost chart in the corner, pop-ups for events, Reckonings and the codex.
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import codex from "../content/codex.json" with { type: "json" };
import { game, type Overlay, type Tool } from "../game/store.ts";
import { GHOSTS, ghostAt } from "../game/ghost.ts";
import { fmt, tx } from "../i18n/index.ts";
import { mountMap } from "../map/MapScene.ts";
import {
  BUILDINGS, GOODS, GOOD_IDS, POLICIES, POLICY_IDS, SCENARIOS, buildCost, capacity, chapterOf, explainShortage, indicators, infraCost,
  type Building, type BuildingType, type GameState, type Infra,
} from "../sim/index.ts";
import { scholarLine, scotsmanLine } from "./advisors.ts";
import { useGame } from "./hooks.ts";
import { LineChart } from "./LineChart.tsx";
import { Modals } from "./Modals.tsx";

const CODEX = new Map(codex.map((c) => [c.id, c]));
export const codexTitle = (id: string) => tx(CODEX.get(id)?.title) || id;

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
        {s && <SidePanel s={s} />}
        {s && <GhostMini s={s} />}
        {s?.tutorial && <TutorialPanel s={s} />}
      </div>
      {s && <BottomBar s={s} />}
      <Toasts />
      <Modals />
    </div>
  );
}

function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      const s = game.state;
      if (e.key === " " && s && !game.ui.modal) { e.preventDefault(); game.setSpeed(game.ui.speed ? 0 : 1); return; }
      if (e.key === "." && s) { game.setSpeed(Math.min(4, Math.max(1, game.ui.speed * 2))); return; }
      if (e.key === "," && s) { game.setSpeed(game.ui.speed <= 1 ? 0 : game.ui.speed / 2); return; }
      if (e.key === "Escape") { game.setUi(game.ui.modal && !["title", "event", "reckoning", "ending"].includes(game.ui.modal.kind) ? { modal: null } : { tool: { kind: "inspect" }, selected: null }); return; }
      if (!s || (game.ui.modal && game.ui.modal.kind !== "codex")) return;
      const k = e.key.toLowerCase();
      if (k === "e") void game.endTurn();
      else if (k === "b") game.setUi({ modal: { kind: "budget" } });
      else if (k === "t") game.setUi({ modal: { kind: "tax" } });
      else if (k === "i") game.setUi({ modal: { kind: "institutions" } });
      else if (k === "c") game.setUi({ modal: game.ui.modal?.kind === "codex" ? null : { kind: "codex" } });
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

function TopBar({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const def = SCENARIOS[s.scenario];
  const spendPerTurn = Math.max(1e-6, s.spending);
  const cover = Math.floor(s.treasury / spendPerTurn);
  return (
    <header className="topbar">
      <div className="brand" onClick={() => game.setUi({ modal: { kind: "menu" } })} role="button" tabIndex={0}>
        <span className="brand-mark">✒</span>
        <span>{t("app.title")}</span>
      </div>
      <div className="stat"><small>{t(`time.month.${Math.floor(s.day / 30)}`)}</small><b>{s.scenario === "needle" ? fmt(s.year) : s.year}</b><small>{t("top.chapter", { n: s.chapter + 1, total: def.chapters.length })}</small></div>
      <TimeControls />
      <div className="stat" title={t("top.turnsCover", { n: cover })}><small>{t("top.treasury")}</small><b>{fmt(s.treasury)}</b><small>{t("top.revenue")} {fmt(s.revenue, 1)}</small></div>
      <div className="stat"><small>{t("top.debt")}</small><b>{fmt(s.debt)}</b><small>{fmt(s.interestRate * 100, 1)}%</small></div>
      <div className={`stat ${s.money.trust < 50 ? "warn" : ""}`}><small>{t("top.trust")}</small><b>{fmt(s.money.trust)}</b><small>{s.money.trust < 50 ? "▼" : ""}</small></div>
      <Meter id="opulence" value={s.meters.opulence.value} target={def.targets.opulence} />
      <Meter id="maslaha" value={s.meters.maslaha.value} target={def.targets.maslaha} />
      {s.meters.goodSociety && <span className="badge-good">★ {t("top.goodSociety")}</span>}
      <button className="icon-btn" onClick={() => game.setUi({ modal: { kind: "codex" } })} title={t("menu.codex")}>📖 <span className="count">{s.discovered.length}</span></button>
      <button className="icon-btn" onClick={() => game.setUi({ modal: { kind: "menu" } })} title={t("menu.menu")}>☰</button>
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
        <button key={v} className={ui.speed === v ? "on" : ""} onClick={() => game.setSpeed(v)} title={t(`time.speed${v}`)} aria-pressed={ui.speed === v}>
          {v === 0 ? "❚❚" : "▶".repeat(Math.min(3, v === 4 ? 3 : v))}
        </button>
      ))}
      <span className="yearbar" title={t("time.progress")}><span style={{ width: `${((s?.day ?? 0) / 360) * 100}%` }} /></span>
    </div>
  );
}

// ---------------------------------------------------------------- bottom bar
export function toolList(s: GameState): { tool: Tool; label: string; group: string; cost?: number; icon: string }[] {
  const out: { tool: Tool; label: string; group: string; cost?: number; icon: string }[] = [];
  const icons: Record<string, string> = { farm: "🌾", pasture: "🐑", lumber: "🪵", mine: "⛏", bakery: "🍞", weaver: "🧵", smithy: "🔨", builder: "🏠", pinworks: "📌", port: "⚓", courthouse: "⚖", school: "📚", granary: "🏺" };
  const groups: Record<string, BuildingType[]> = {
    raw: ["farm", "pasture", "lumber", "mine"],
    craft: ["bakery", "weaver", "smithy", "builder", "pinworks"],
    civic: ["courthouse", "school", "granary", "port"],
  };
  for (const [group, types] of Object.entries(groups)) for (const b of types) out.push({ tool: { kind: "build", building: b }, label: `building.${b}.name`, group, cost: buildCost(s, b), icon: icons[b] });
  const infra: Infra[] = ["road", ...(s.institutions.canals ? (["canal"] as Infra[]) : []), ...(s.institutions.railways ? (["rail"] as Infra[]) : [])];
  for (const i of infra) out.push({ tool: { kind: "infra", infra: i }, label: `tool.${i}`, group: "works", cost: infraCost(s, i, "plains"), icon: i === "road" ? "〰" : i === "canal" ? "≋" : "▦" });
  out.push({ tool: { kind: "foundTown" }, label: "tool.foundTown", group: "works", icon: "🏘" });
  out.push({ tool: { kind: "demolish" }, label: "tool.demolish", group: "works", icon: "✕" });
  return out;
}

const sameTool = (a: Tool, b: Tool) => JSON.stringify(a) === JSON.stringify(b);

function BottomBar({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const { ui } = useGame();
  const tools = toolList(s);
  const groups = ["raw", "craft", "civic", "works"];
  return (
    <footer className="bottombar">
      <div className="tools" role="toolbar">
        <button className={`tool ${ui.tool.kind === "inspect" ? "on" : ""}`} onClick={() => game.setUi({ tool: { kind: "inspect" } })} title={t("tool.inspect")}>🔍</button>
        {groups.map((g) => (
          <div className="tool-group" key={g}>
            <small>{t(`tool.groups.${g}`)}</small>
            <div>
              {tools.filter((x) => x.group === g).map((x) => {
                const i = tools.indexOf(x);
                const afford = x.cost === undefined || s.treasury >= x.cost;
                return (
                  <button key={i} className={`tool ${sameTool(ui.tool, x.tool) ? "on" : ""} ${afford ? "" : "dim"}`}
                    onClick={() => game.setUi({ tool: x.tool })}
                    title={`${t(x.label)}${x.cost !== undefined ? ` — ${t("tool.cost", { c: fmt(x.cost) })}` : ""}${x.tool.kind === "build" ? `\n${t(`building.${x.tool.building}.desc`)}` : ""}${i < 9 ? ` [${i + 1}]` : ""}`}
                    aria-label={t(x.label)}>
                    <span aria-hidden>{x.icon}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="overlays">
        <small>{t("overlay.label")}</small>
        <select value={ui.overlay} onChange={(e) => game.setUi({ overlay: e.target.value as Overlay })}>
          {(["none", "traffic", "reach", "prices", "wages", "mood"] as Overlay[]).map((o) => <option key={o} value={o}>{t(`overlay.${o}`)}</option>)}
        </select>
      </div>
      <PolicyHand s={s} />
      <div className="gov-buttons">
        <button onClick={() => game.setUi({ modal: { kind: "budget" } })}>⚖ {t("budget.title")}</button>
        <button onClick={() => game.setUi({ modal: { kind: "tax" } })}>✎ {t("tax.title")}</button>
        <button onClick={() => game.setUi({ modal: { kind: "institutions" } })}>🏛 {t("inst.title")}{s.developing ? " •" : ""}</button>
      </div>
      <button className="end-turn" disabled={ui.busy || s.status !== "playing"} onClick={() => void game.endTurn()}>
        {ui.busy ? t("top.busy") : s.pendingEvent ? t("event.title") : `${t("time.skip")} ⏭`}
        <small>E · {t("time.space")}</small>
      </button>
    </footer>
  );
}

function PolicyHand({ s }: { s: GameState }) {
  const { t } = useTranslation();
  return (
    <div className="hand">
      <small>{t("policy.title")} · {t("policy.limit", { n: s.policyChangesThisTurn })}</small>
      <div className="cards">
        {POLICY_IDS.map((id) => (
          <button key={id} className={`card ${s.policies[id] ? "active" : ""}`} onClick={() => game.setUi({ modal: { kind: "policy", id } })} title={t(`policy.${id}.desc`)}>
            <span className="card-name">{t(`policy.${id}.name`)}</span>
            {s.policies[id] && <span className="card-state">{t("policy.active")}</span>}
          </button>
        ))}
        {s.institutions.coinage && (
          <button className="card danger" onClick={() => game.setUi({ modal: { kind: "policy", id: "debase" } })} title={t("policy.debase.desc")}>
            <span className="card-name">{t("policy.debase.name")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- right panel
function SidePanel({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const { ui } = useGame();
  const sel = ui.selected;
  const tile = sel && s.tiles.find((x) => x.q === sel.q && x.r === sel.r);
  const b = sel && s.buildings.find((x) => x.q === sel.q && x.r === sel.r);
  const town = sel && s.towns.find((x) => x.q === sel.q && x.r === sel.r);
  return (
    <aside className="sidepanel" aria-live="polite">
      {!tile && <p className="muted">{t("panel.nothing")}</p>}
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
      {tile && (
        <p className="muted small">
          {t(`terrain.${tile.terrain}`)}{tile.river ? ` · ${t("terrain.river")}` : ""}{tile.coast ? ` · ${t("terrain.coast")}` : ""}{tile.deposit ? ` · ${t("terrain.deposit")}` : ""}{s.infra[`${tile.q},${tile.r}`] ? ` · ${t(`infra.${s.infra[`${tile.q},${tile.r}`]}`)}` : ""}
        </p>
      )}
      <Council s={s} />
      <Classes s={s} />
      <Market s={s} />
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
  const nextHands = 3 * (b.level + 1);
  return (
    <section>
      <h3>{t(`building.${b.type}.name`)} <small className="muted">· {t(`good.${def.good}`)}</small></h3>
      {b.private && <p className="small muted">✦ {t("panel.private")}</p>}
      <p className={`status status-${b.status}`}>{t(`status.${b.status}`, { good: b.missing ? t(`good.${b.missing}`) : "" })}</p>
      <WhyShort s={s} b={b} />
      <Stores b={b} />
      <div className="levels" aria-label={t("panel.levelOf", { level: b.level })}>
        {[1, 2, 3, 4, 5].map((lv) => <span key={lv} className={`lv ${lv <= b.level ? "on" : lv <= b.maxLevel ? "can" : ""}`}>{lv}</span>)}
        <small>{t("panel.levelOf", { level: b.level })} · {t("panel.cap", { max: b.maxLevel })}</small>
      </div>
      <p className="small">{t("panel.reachExplain", { r: fmt(b.reach) })} <WhyLink id="extent-of-market" /></p>
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
      {b.inputFill < 0.7 && <p className="alert">! {t("panel.bottleneck")}</p>}
      {b.sold < 0.6 && b.output > 0 && <p className="alert muted">✕ {t("panel.noBuyers")}</p>}
      {b.level < b.maxLevel && (b.workers >= 3 * b.level ? <p className="good small">↑ {t("panel.canGrow")}</p> : <p className="small">{t("panel.needHands", { n: 3 * b.level })}</p>)}
      {b.level >= b.maxLevel && b.level < 5 && <p className="small muted">{t("panel.needHands", { n: nextHands })}</p>}
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

function Stores({ b }: { b: Building }) {
  const { t } = useTranslation();
  const def = BUILDINGS[b.type];
  const inputs = [...Object.keys(GOODS[def.good!].inputs), ...(GOODS[def.good!].land ? ["tools"] : [])];
  return (
    <div className="stores">
      {inputs.map((g) => (
        <div key={g} className="store"><span>{t(`good.${g}`)}</span><b>{fmt(b.inBuf[g as keyof typeof b.inBuf] ?? 0, 1)}</b><small className="muted">+{fmt(b.incoming[g as keyof typeof b.incoming] ?? 0)} {t("panel.onTheWay")}</small></div>
      ))}
      <div className="store out"><span>{t("panel.outStore")}</span><b>{fmt(b.outBuf, 1)}</b><small className="muted">{t(`good.${def.good}`)}</small></div>
    </div>
  );
}

export function WhyLink({ id }: { id: string }) {
  const { t } = useTranslation();
  return <button className="why" onClick={() => game.setUi({ modal: { kind: "codex", entry: id } })}>{t("panel.why")}</button>;
}

function TownMarket({ s, townId }: { s: GameState; townId: string }) {
  const { t } = useTranslation();
  const m = s.markets.find((x) => x.town === townId);
  if (!m) return null;
  return (
    <table className="market">
      <caption className="small muted">{t("panel.localMarket")}</caption>
      <tbody>
        {GOOD_IDS.map((g) => {
          const r = m.price[g] / s.goods[g].natural;
          const short = m.short[g] > 0.05;
          return (
            <tr key={g} className={short ? "spike" : ""}>
              <td>{t(`good.${g}`)}</td>
              <td className="num">{fmt(m.stock[g])}</td>
              <td className={`num ${r > 1.15 ? "bad" : r < 0.87 ? "cool" : ""}`}>{r > 1.15 ? "▲" : r < 0.87 ? "▼" : "·"} {fmt(r * 100)}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
      <h4>{t("panel.markets")}</h4>
      <table className="market">
        <tbody>
          {GOOD_IDS.map((g) => {
            const gs = s.goods[g];
            const r = gs.price / gs.natural;
            const arrow = r > 1.15 ? "▲" : r < 0.87 ? "▼" : "·";
            return (
              <tr key={g} className={r > 1.4 ? "spike" : ""}>
                <td>{t(`good.${g}`)} <small className="muted">{t(`tier.${GOODS[g].need ?? GOODS[g].tier}`)}</small></td>
                <td className="num">{fmt(gs.price, 3)}</td>
                <td className={`num ${r > 1.15 ? "bad" : r < 0.87 ? "cool" : ""}`}>{arrow} {fmt(r * 100)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small muted">{t("panel.natural", { p: "= 100%" })} <WhyLink id="natural-price" /></p>
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
      <LineChart compact width={220} height={90} series={[
        { id: "h", label: t("ghost.history"), points: hist, color: "#7a7266", dashed: true },
        { id: "y", label: t("ghost.you"), points: you, color: "#a8503a" },
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
