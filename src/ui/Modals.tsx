import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import codex from "../content/codex.json" with { type: "json" };
import { game } from "../game/store.ts";
import { GHOSTS, ghostAt } from "../game/ghost.ts";
import { LANGUAGES, fmt, setLanguage, tx, type Lang } from "../i18n/index.ts";
import {
  BUDGET_LINES, EVENT_BY_ID, INSTITUTIONS, POLICIES, SCENARIOS, TRACKS, adequacy, choiceAvailable, describe, gradeLetter,
  institutionAvailable, reversibleDecisions, taxGrades, type GameState, type InstitutionId, type PolicyId, type ScenarioId,
} from "../sim/index.ts";
import { ghostSeries, WhyLink } from "./App.tsx";
import { useGame } from "./hooks.ts";
import { Legend, LineChart, type Series } from "./LineChart.tsx";

type CodexEntry = (typeof codex)[number];
const CODEX = new Map(codex.map((c) => [c.id, c]));

function Dialog({ title, children, onClose, wide, className }: { title: ReactNode; children: ReactNode; onClose?: () => void; wide?: boolean; className?: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>("button, [href], input, select")?.focus(); }, []);
  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`dialog ${wide ? "wide" : ""} ${className ?? ""}`} role="dialog" aria-modal="true" ref={ref}>
        <header><h2>{title}</h2>{onClose && <button className="close" onClick={onClose} aria-label={t("common.close")}>×</button>}</header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}

const close = () => game.setUi({ modal: null });

export function Modals() {
  const { s, ui } = useGame();
  const m = ui.modal;
  if (!m) return null;
  switch (m.kind) {
    case "title": return <Title />;
    case "menu": return <Menu />;
    case "help": return <Help />;
    case "codex": return <Codex entry={m.entry} />;
  }
  if (!s) return null;
  switch (m.kind) {
    case "event": return <EventCard s={s} />;
    case "reckoning": return <Reckoning s={s} />;
    case "ending": return <Ending s={s} />;
    case "tax": return <TaxScreen s={s} />;
    case "budget": return <BudgetScreen s={s} />;
    case "institutions": return <Institutions s={s} />;
    case "meter": return <MeterBreakdown s={s} meter={m.meter} />;
    case "policy": return <PolicyCard s={s} id={m.id} />;
    case "ghost": return <GhostScreen s={s} />;
  }
  return null;
}

// ---------------------------------------------------------------- title, menu, help
function LanguagePicker() {
  const { t, i18n } = useTranslation();
  return (
    <label className="row">{t("menu.language")}
      <select value={i18n.language} onChange={(e) => setLanguage(e.target.value as Lang)}>
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  );
}

function Title() {
  const { t } = useTranslation();
  const [hasSave, setHasSave] = useState(false);
  useEffect(() => { void game.hasSave().then(setHasSave); }, []);
  return (
    <div className="title-screen">
      <div className="title-card">
        <div className="ornament" aria-hidden>✦ ❦ ✦</div>
        <h1>{t("app.title")}</h1>
        <p className="tagline">{t("app.tagline")}</p>
        <div className="scenarios">
          {(["needle", "britain1776"] as ScenarioId[]).map((id) => (
            <button key={id} className="scenario" onClick={() => game.newGame(id)}>
              <b>{t(`scenario.${id}.name`)}</b>
              <span>{t(`scenario.${id}.desc`)}</span>
            </button>
          ))}
        </div>
        <div className="row gap">
          {hasSave && <button onClick={() => void game.load()}>{t("menu.continue")}</button>}
          <label className="button-like">{t("menu.import")}<input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void game.importFile(e.target.files[0])} /></label>
          <button onClick={() => game.setUi({ modal: { kind: "help" } })}>{t("menu.help")}</button>
          <button onClick={() => game.setUi({ modal: { kind: "codex" } })}>{t("menu.codex")}</button>
        </div>
        <LanguagePicker />
        <p className="credit">{t("app.credit")}</p>
      </div>
    </div>
  );
}

function Menu() {
  const { t } = useTranslation();
  const { s, ui } = useGame();
  return (
    <Dialog title={t("menu.menu")} onClose={close}>
      <div className="menu-list">
        <button onClick={close}>{t("menu.resume")}</button>
        <button onClick={() => void game.save()}>{t("menu.save")}</button>
        <button onClick={() => void game.load("slot1")}>{t("menu.load")}</button>
        <button onClick={() => game.exportFile()}>{t("menu.export")}</button>
        <label className="button-like">{t("menu.import")}<input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void game.importFile(e.target.files[0])} /></label>
        <button onClick={() => game.setUi({ modal: { kind: "help" } })}>{t("menu.help")}</button>
        <button onClick={() => game.setUi({ modal: { kind: "title" } })}>{t("menu.quit")}</button>
      </div>
      <LanguagePicker />
      <label className="row">{t("menu.textSize")}
        <input type="range" min={0.85} max={1.4} step={0.05} value={ui.textScale} onChange={(e) => game.setUi({ textScale: Number(e.target.value) })} />
      </label>
      {s && <p className="small muted">{t("menu.seed")}: {s.seed} · {t(`scenario.${s.scenario}.name`)} · {fmt(ui.lastTurnMs)} ms</p>}
      <Credits />
    </Dialog>
  );
}

function Credits() {
  const { t } = useTranslation();
  const g = GHOSTS.britain1776!;
  return (
    <details className="credits">
      <summary>{t("credits.title")}</summary>
      <h4>{t("credits.texts")}</h4>
      <p className="small">{t("credits.smith")}</p>
      <p className="small">{t("credits.ghazali")}</p>
      <h4>{t("credits.data")}</h4>
      {Object.values(g.sources).map((src) => (
        <p key={src.title} className="small"><a href={src.url} target="_blank" rel="noreferrer">{src.title}</a> — {src.citation} <em>{src.license}</em> (fetched {src.fetched})</p>
      ))}
      <p className="small">{t("credits.engine")}</p>
    </details>
  );
}

function Help() {
  const { t } = useTranslation();
  const body = t("help.body", { returnObjects: true }) as unknown as string[];
  return (
    <Dialog title={t("help.title")} onClose={() => game.setUi({ modal: game.state ? null : { kind: "title" } })}>
      {body.map((p, i) => <p key={i}>{p}</p>)}
    </Dialog>
  );
}

// ---------------------------------------------------------------- events (§7)
function Stance({ v }: { v: number | undefined }) {
  const { t } = useTranslation();
  if (!v) return <span className="stance neutral">· {t("advisor.neutral")}</span>;
  return <span className={`stance ${v > 0 ? "pro" : "con"}`}>{v > 0 ? "✓" : "✕"} {t(v > 0 ? "advisor.favours" : "advisor.opposes")}</span>;
}

function EventCard({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const pe = s.pendingEvent;
  const e = pe && EVENT_BY_ID.get(pe.id);
  if (!e) return null;
  const vars = { year: s.year };
  const fill = (x: string) => x.replace(/\{(\w+)\}/g, (_, k) => String((vars as Record<string, unknown>)[k] ?? ""));
  return (
    <Dialog title={<><span className={`ev-icon ev-${e.category}`} aria-hidden>{ICONS[e.icon] ?? "✦"}</span> {tx(e.title)}</>} wide className="event">
      <p className="lead">{fill(tx(e.body))}</p>
      {e.history && <p className="history"><b>{t("event.history")}:</b> {tx(e.history)}</p>}
      {e.advice && (
        <div className="debate">
          {(["scotsman", "scholar"] as const).map((a) => e.advice?.[a] && !s.advisors[a].resigned && (
            <blockquote key={a} className={`advisor-${a}`}><b>{t(`advisor.${a}.name`)}</b> “{tx(e.advice[a])}”</blockquote>
          ))}
        </div>
      )}
      <div className="choices">
        {e.choices.map((c, i) => {
          const ok = choiceAvailable(s, c);
          return (
            <button key={i} className="choice" disabled={!ok} onClick={() => game.command({ type: "eventChoice", eventId: e.id, choice: i })}>
              <b>{tx(c.label)}</b>
              {c.hint && <small>{tx(c.hint)}</small>}
              {!ok && <small className="bad">{t("event.requires")}</small>}
              <span className="stances">
                {(["scotsman", "scholar"] as const).map((a) => <span key={a}><small>{t(`advisor.${a}.name`)}</small> <Stance v={c.advisors?.[a]} /></span>)}
              </span>
            </button>
          );
        })}
      </div>
      {e.codex && <p className="small"><WhyLink id={e.codex} /> {tx(CODEX.get(e.codex)?.title)}</p>}
    </Dialog>
  );
}

const ICONS: Record<string, string> = {
  drought: "☀", hoard: "🏚", harvest: "🌾", sheep: "🐑", coin: "🪙", counterfeit: "🪙", paper: "📜", bank: "🏦", charter: "📜",
  grain: "🌾", guild: "⚒", toll: "🚧", ship: "⛵", jenny: "🧶", steam: "♨", press: "📰", hammer: "🔨", canal: "≋", treaty: "🤝",
  pirate: "☠", compass: "🧭", war: "⚔", smuggle: "🌒", strike: "✊", school: "📚", scales: "⚖", scroll: "📜", ledger: "📒",
  crowd: "👥", child: "🧒", rail: "🚂", bandit: "🗡",
};

// ---------------------------------------------------------------- Reckoning (§2 era loop, §9 What if?)
type Tf = (k: string, v?: Record<string, unknown>) => string;

function chronicleText(s: GameState, c: GameState["chronicle"][number], t: Tf): string {
  if (c.key.startsWith("event:")) {
    const [, id, ch] = c.key.split(":");
    const e = EVENT_BY_ID.get(id);
    const txt = e && tx(e.choices[Number(ch)]?.chronicle);
    return txt ? txt.replace("{year}", String(c.year)) : "";
  }
  if (c.key.startsWith("inst.")) return t("chronicle.inst", { year: c.year, name: t(`inst.${c.key.slice(5)}.name`) });
  if (c.key.startsWith("resign.")) return t(`chronicle.resign.${c.key.slice(7)}`, { year: c.year });
  return t(`chronicle.${c.key}`, { year: s.scenario === "needle" ? c.year : c.year });
}

function Chronicle({ s, from = -1 }: { s: GameState; from?: number }) {
  const { t } = useTranslation();
  const tf: Tf = (k, v) => String(t(k, (v ?? {}) as never));
  const items = s.chronicle.filter((c) => c.turn > from).map((c) => chronicleText(s, c, tf)).filter(Boolean);
  if (!items.length) return null;
  return <ol className="chronicle">{items.map((x, i) => <li key={i}>{x}</li>)}</ol>;
}

function Reckoning({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const { ui } = useGame();
  const r = s.reckonings[s.reckonings.length - 1];
  const prev = s.reckonings.length > 1 ? s.reckonings[s.reckonings.length - 2].turn : -1;
  const decisions = reversibleDecisions(s, Math.max(0, s.turn - 10));
  const [pick, setPick] = useState(0);
  const def = SCENARIOS[s.scenario];
  return (
    <Dialog title={t("reckoning.title", { year: r.year })} wide className="reckoning">
      <p className="lead">{t("reckoning.intro")}</p>
      <div className="cols">
        <div>
          <h4>{t("reckoning.meters")}</h4>
          <p>{t("top.opulence")}: <b>{fmt(s.meters.opulence.value)}</b> / {def.targets.opulence} · {t("top.maslaha")}: <b>{fmt(s.meters.maslaha.value)}</b> / {def.targets.maslaha}</p>
          <h4>{t("reckoning.chronicle")}</h4>
          <Chronicle s={s} from={prev} />
        </div>
        <div>
          {GHOSTS[s.scenario] && (<><h4>{t("reckoning.ghost")}</h4><GhostCharts s={s} /></>)}
        </div>
      </div>
      <h4>{t("reckoning.whatIf")}</h4>
      <p className="small">{t("reckoning.whatIfIntro")}</p>
      {decisions.length ? (
        <div className="row gap">
          <select value={pick} onChange={(e) => setPick(Number(e.target.value))}>
            {decisions.map((d, i) => <option key={i} value={i}>{decisionLabel(s, describe(d), d.turn, (k, v) => String(t(k, (v ?? {}) as never)))}</option>)}
          </select>
          <button disabled={ui.busy} onClick={() => void game.whatIf(decisions[pick])}>{t("reckoning.whatIfRun")}</button>
        </div>
      ) : <p className="muted small">{t("reckoning.noDecisions")}</p>}
      {ui.whatIf && <WhatIfChart />}
      <h4>{t("reckoning.reform")}</h4>
      <div className="reforms">
        {r.reforms.map((id) => (
          <button key={id} className="choice" onClick={() => game.command({ type: "reform", id })}>
            <b>{t(`reform.${id}.name`)}</b><small>{t(`reform.${id}.desc`)}</small>
          </button>
        ))}
        <button className="choice subtle" onClick={() => game.command({ type: "reform", id: "none" })}><b>{t("reckoning.none")}</b></button>
      </div>
    </Dialog>
  );
}

function decisionLabel(s: GameState, d: string, turn: number, t: Tf): string {
  const year = s.history.find((h) => h.turn === turn)?.year ?? turn;
  const [kind, a, b] = d.split(":");
  if (kind === "enact" || kind === "repeal") return `${year}: ${t(`policy.${kind}`)} — ${t(`policy.${a}.name`)}`;
  if (kind === "event") { const e = EVENT_BY_ID.get(a); return `${year}: ${tx(e?.title)} — ${tx(e?.choices[Number(b)]?.label)}`; }
  if (kind === "debase") return `${year}: ${t("policy.debase.name")}`;
  if (kind === "budget") return `${year}: ${t("budget.title")} — ${t(`budget.${a}`)}`;
  return `${year}: ${t("tax.title")}`;
}

function WhatIfChart() {
  const { t } = useTranslation();
  const { ui } = useGame();
  const r = ui.whatIf!;
  const series = (k: "gdppc" | "opulence" | "maslaha"): Series[] => [
    { id: "a", label: t("reckoning.actual"), points: r.actual.map((h) => [h.year, h[k]]), color: "#a8503a" },
    { id: "b", label: t("reckoning.alternative"), points: r.alternative.map((h) => [h.year, h[k]]), color: "#0072b2", dashed: true },
  ];
  return (
    <div className="whatif">
      <div className="cols3">
        <div><small>{t("ghost.gdppc")}</small><LineChart series={series("gdppc")} height={120} /></div>
        <div><small>{t("top.opulence")}</small><LineChart series={series("opulence")} height={120} /></div>
        <div><small>{t("top.maslaha")}</small><LineChart series={series("maslaha")} height={120} /></div>
      </div>
      <Legend series={series("gdppc")} />
    </div>
  );
}

function GhostCharts({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const out = (["gdppc", "realWage"] as const).map((k) => {
    const { you, hist, g } = ghostSeries(s, k);
    const series: Series[] = [
      { id: "h", label: t("ghost.history"), points: hist, color: "#7a7266", dashed: true },
      { id: "y", label: t("ghost.you"), points: you, color: "#a8503a" },
    ];
    const last = s.history[s.history.length - 1];
    const gp = g && ghostAt(g.series[k], last.year);
    const val = k === "gdppc" ? last.gdppc : last.realWage;
    return (
      <div key={k}>
        <small>{t(`ghost.${k}`)} ({t(`ghost.units.${k}`)}) {gp && <b className={val >= gp[1] ? "good" : "bad"}>{t("ghost.ahead", { p: fmt((val / gp[1]) * 100) })}</b>}</small>
        <LineChart series={series} height={130} />
        {gp && g && <small className="muted">{t("ghost.source", { s: GHOSTS[s.scenario]!.sources[g.series[k].source]?.title, y: gp[0], kind: t(`ghost.${gp[2]}`) })}</small>}
      </div>
    );
  });
  return <div className="ghost-charts">{out}</div>;
}

function GhostScreen({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const g = GHOSTS[s.scenario];
  return (
    <Dialog title={t("ghost.title")} onClose={close} wide>
      {g ? <GhostCharts s={s} /> : <p>{t("ghost.noData")}</p>}
      {g && (
        <>
          <h4>{t("ghost.sources")}</h4>
          {Object.values(g.sources).map((src) => <p key={src.title} className="small"><a href={src.url} target="_blank" rel="noreferrer">{src.title}</a> — {src.citation}</p>)}
        </>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- endings (§8)
function Ending({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const e = s.ending ?? "decline";
  const last = s.history[s.history.length - 1];
  const g = GHOSTS[s.scenario];
  const gp = g && ghostAt(g.series.gdppc, last.year);
  return (
    <Dialog title={t("ending.title", { year: last.year })} wide className={`ending ending-${e}`}>
      <h3 className="ending-name">{t(`ending.${e}.name`)}</h3>
      <p className="lead">{t(`ending.${e}.desc`)}</p>
      {s.collapseReason && <p className="bad">{t(`ending.reason.${s.collapseReason}`)}</p>}
      {gp && <p>{t("ending.ghostRatio", { p: fmt((last.gdppc / gp[1]) * 100) })}</p>}
      {s.medal && <p className="medal">🏅 {t("ending.medal")}</p>}
      <p>{t("top.opulence")} <b>{fmt(s.meters.opulence.value)}</b> · {t("top.maslaha")} <b>{fmt(s.meters.maslaha.value)}</b></p>
      {g && <GhostCharts s={s} />}
      <h4>{t("ending.chronicle")}</h4>
      <Chronicle s={s} />
      <div className="row gap">
        <button onClick={() => game.setUi({ modal: { kind: "title" } })}>{t("ending.playAgain")}</button>
        <button onClick={() => game.exportFile()}>{t("menu.export")}</button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- codex (§9, §15 A Two Texts)
function Codex({ entry }: { entry?: string }) {
  const { t, i18n } = useTranslation();
  const s = game.state;
  const discovered = new Set(s?.discovered ?? codex.map((c) => c.id)); // title screen: browse all
  const [sel, setSel] = useState<string>(entry ?? (s?.discovered[s.discovered.length - 1] ?? codex[0].id));
  const [showOriginal, setShowOriginal] = useState(true);
  const c = CODEX.get(sel) as CodexEntry | undefined;
  return (
    <Dialog title={t("codex.title")} onClose={() => game.setUi({ modal: game.state ? null : { kind: "title" } })} wide className="codex">
      <p className="small muted">{t("codex.intro", { n: discovered.size, total: codex.length })}</p>
      <div className="codex-grid">
        <ul className="codex-list">
          {codex.map((x) => (
            <li key={x.id}>
              <button className={x.id === sel ? "on" : ""} disabled={!discovered.has(x.id) && x.id !== entry} onClick={() => setSel(x.id)}>
                {discovered.has(x.id) || x.id === entry ? tx(x.title) : `🔒 ${t("codex.locked")}`}
                <small>{t(`codex.${x.author}`)}</small>
              </button>
            </li>
          ))}
        </ul>
        {c && (
          <article className={`codex-entry author-${c.author}`}>
            <h3>{tx(c.title)}</h3>
            <p className="ref">{t(`codex.${c.author}`)} · {tx(c.ref)}</p>
            <p>{tx(c.summary)}</p>
            <figure className="quote">
              {c.quote.lang === "en" ? (
                <>
                  {(showOriginal || i18n.language === "en") ? <blockquote lang="en" dir="ltr">“{c.quote.text}”</blockquote> : <blockquote lang="ar" dir="rtl">«{(c.quote.translation as { ar?: string }).ar}»</blockquote>}
                  <figcaption className="small muted">✓ {t("codex.verified")}
                    {i18n.language === "ar" && <button className="link" onClick={() => setShowOriginal(!showOriginal)}>{t("codex.toggle", { lang: showOriginal ? "العربية" : "English" })}</button>}
                  </figcaption>
                </>
              ) : (
                <>
                  {c.quote.text ? <blockquote lang="ar" dir="rtl">«{c.quote.text}»</blockquote> : null}
                  <blockquote lang="en" dir="ltr" className="paraphrase"><small>{t(c.quote.text ? "codex.translation" : "codex.paraphrase")}:</small> {(c.quote.translation as { en?: string }).en}</blockquote>
                  <figcaption className="small muted">{c.quote.status === "verified-edition" ? t("codex.verifiedEdition") : c.quote.status === "verified-dar-al-marifa" ? t("codex.verifiedMarifa") : c.quote.text ? t("codex.pendingEdition") : t("codex.pendingArabic")}</figcaption>
                </>
              )}
            </figure>
            <p><b>{t("codex.inGame")}:</b> {tx(c.mechanic)}</p>
            <p><b>{t("codex.example")}:</b> {tx(c.example)}</p>
            {c.read && <p><a href={c.read} target="_blank" rel="noreferrer">{t("codex.read")} ↗</a></p>}
          </article>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- tax design (§4.8, Smith V.2)
function Slider({ label, value, onChange, max = 0.6, desc }: { label: string; value: number; onChange: (v: number) => void; max?: number; desc?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="slider">
      <span>{label}{desc && <small className="muted"> — {desc}</small>}</span>
      <input type="range" min={0} max={max} step={0.01} value={v} onChange={(e) => setV(Number(e.target.value))} onPointerUp={() => onChange(v)} onKeyUp={() => onChange(v)} onBlur={() => v !== value && onChange(v)} />
      <b>{fmt(v * 100)}%</b>
    </label>
  );
}

const REVENUE_LABEL: Record<string, string> = {
  landTax: "tax.land", exciseNec: "tax.exciseNecessities", exciseLux: "tax.exciseLuxuries", customs: "tax.customs",
  collection: "tax.collectionCost", incomeTax: "tax.incomeTax",
};

function TaxScreen({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const g = taxGrades(s);
  const rb = s.revenueBreakdown;
  return (
    <Dialog title={t("tax.title")} onClose={close} wide>
      <p className="small">{t("tax.intro")} <WhyLink id="four-maxims" /></p>
      <div className="cols">
        <div>
          {(["land", "exciseNecessities", "exciseLuxuries", "customs"] as const).map((k) => (
            <Slider key={k} label={t(`tax.${k}`)} value={s.taxes[k]} onChange={(v) => game.command({ type: "tax", taxes: { [k]: v } })} />
          ))}
          <label className="row">{t("tax.collection")}
            <select value={s.taxes.collection} onChange={(e) => game.command({ type: "tax", taxes: { collection: e.target.value as "salaried" | "farmers" } })}>
              <option value="salaried">{t("tax.salaried")}</option>
              <option value="farmers">{t("tax.farmers")}</option>
            </select>
          </label>
          <p className="small">{t("tax.smuggling", { p: fmt(s.society.smuggling * 100) })}</p>
        </div>
        <div className="grades">
          {(["equality", "certainty", "convenience", "economy"] as const).map((k) => {
            const L = gradeLetter(g[k]);
            return (
              <div key={k} className={`grade grade-${L}`}>
                <span className="letter">{L}</span>
                <div><b>{t(`tax.${k}`)}</b><small>{t(`tax.${k}Desc`)}</small></div>
              </div>
            );
          })}
          <h4>{t("tax.breakdown")}</h4>
          <dl>
            {Object.entries(rb).flatMap(([k, v]) => [
              <dt key={`k${k}`}>{t(REVENUE_LABEL[k] ?? k)}</dt>,
              <dd key={`v${k}`}>{fmt(v, 1)}</dd>,
            ])}
          </dl>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- budget (§4.8, Smith V.1)
function BudgetScreen({ s }: { s: GameState }) {
  const { t } = useTranslation();
  const amt = Math.max(1, Math.round(s.revenue));
  return (
    <Dialog title={t("budget.title")} onClose={close} wide>
      <p className="small">{t("budget.intro")} <WhyLink id="duties-of-sovereign" /></p>
      {BUDGET_LINES.map((l) => (
        <div key={l}>
          <Slider label={t(`budget.${l}`)} desc={t(`budget.${l}Desc`)} value={s.budget[l]} onChange={(v) => game.command({ type: "budget", line: l, value: v })} />
          <small className="muted">{t("budget.adequacy", { p: fmt(Math.min(150, adequacy(s, l) * 100)) })}</small>
        </div>
      ))}
      <p>{t("budget.total", { s: fmt(s.spending, 1), r: fmt(s.revenue, 1), i: fmt(s.debt * s.interestRate, 1) })} · {t("budget.interest", { r: fmt(s.interestRate * 100, 1) })} <WhyLink id="public-debt" /></p>
      <div className="row gap">
        <button onClick={() => game.command({ type: "borrow", amount: amt })}>{t("budget.borrow", { a: fmt(amt) })}</button>
        <button disabled={s.treasury < 1 || s.debt < 1} onClick={() => game.command({ type: "repay", amount: amt })}>{t("budget.repay", { a: fmt(Math.min(amt, s.treasury, s.debt)) })}</button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- institutions (§6)
function Institutions({ s }: { s: GameState }) {
  const { t } = useTranslation();
  return (
    <Dialog title={t("inst.title")} onClose={close} wide className="institutions">
      <p className="small">{t("inst.intro")}</p>
      {s.developing && <p className="good">{t("inst.developing", { name: t(`inst.${s.developing}.name`), p: fmt(Math.min(100, (s.progress / INSTITUTIONS[s.developing].cost) * 100)) })}</p>}
      <div className="tree">
        {TRACKS.map((track) => (
          <div key={track} className="track">
            <h4>{t(`inst.track.${track}`)}</h4>
            {(Object.values(INSTITUTIONS)).filter((d) => d.track === track).sort((a, b) => a.era - b.era).map((d) => {
              const why = institutionAvailable(s, d.id as InstitutionId);
              const done = !!s.institutions[d.id];
              const dev = s.developing === d.id;
              return (
                <div key={d.id} className={`inst ${done ? "done" : why ? "locked" : "open"} ${dev ? "dev" : ""}`}>
                  <div><b>{t(`inst.${d.id}.name`)}</b> <small className="muted">· {d.era}</small></div>
                  <small>{t(`inst.${d.id}.desc`)}</small>
                  {done ? <small className="good">✓ {t("inst.done")}</small> : why ? (
                    <small className="muted">{t(`inst.why.${why}`, { list: d.requires.filter((r) => !s.institutions[r]).map((r) => t(`inst.${r}.name`)).join(", ") })}</small>
                  ) : (
                    <button disabled={dev} onClick={() => game.command({ type: "institution", id: d.id as InstitutionId })}>{dev ? "…" : `${t("inst.develop")} (${d.cost})`}</button>
                  )}
                  {d.codex && <WhyLink id={d.codex} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- meters (§8)
function MeterBreakdown({ s, meter }: { s: GameState; meter: "opulence" | "maslaha" }) {
  const { t } = useTranslation();
  const m = s.meters[meter];
  const target = SCENARIOS[s.scenario].targets[meter];
  const hist: Series[] = [{ id: "m", label: t(`top.${meter}`), points: s.history.map((h) => [h.year, h[meter]]), color: meter === "opulence" ? "#c89b2c" : "#0072b2" }];
  return (
    <Dialog title={t(`meter.${meter}Title`)} onClose={close} wide className={`meter-dialog meter-${meter}`}>
      <p className="small">{t(`meter.${meter}Intro`)}</p>
      <p><b className="big">{fmt(m.value)}</b> / {t("top.target", { v: target })}</p>
      {m.parts.map((p) => (
        <div key={p.id} className="part">
          <div className="part-head"><b>{t(`meter.part.${p.id}`)}</b> <small className="muted">{t("meter.weight", { w: fmt(p.weight * 100) })}</small> <span className="num">{fmt(p.score)}</span></div>
          <span className="bar"><span style={{ width: `${p.score}%` }} /></span>
          <small className="muted">{t(`meter.partDesc.${p.id}`)}</small>
        </div>
      ))}
      <LineChart series={hist} height={120} />
      <p className="small">{t("meter.interaction")} <WhyLink id={meter === "opulence" ? "real-wages" : "five-protections"} /></p>
    </Dialog>
  );
}

// ---------------------------------------------------------------- policy cards (§2 govern)
function PolicyCard({ s, id }: { s: GameState; id: string }) {
  const { t } = useTranslation();
  const isDebase = id === "debase";
  const p = isDebase ? undefined : POLICIES[id as PolicyId];
  const on = p ? s.policies[p.id] : false;
  const stance = isDebase ? { scotsman: -1, scholar: -1 } : p!.stance;
  const enacting = !on;
  const st = (a: "scotsman" | "scholar") => (enacting ? stance[a] : -stance[a]);
  return (
    <Dialog title={t(`policy.${id}.name`)} onClose={close}>
      <p>{t(`policy.${id}.desc`)}</p>
      <div className="debate">
        {(["scotsman", "scholar"] as const).map((a) => !s.advisors[a].resigned && (
          <p key={a}><b>{t(`advisor.${a}.name`)}</b> <Stance v={st(a)} /></p>
        ))}
      </div>
      <p className="small muted">{t("policy.limit", { n: s.policyChangesThisTurn })}</p>
      <div className="row gap">
        {isDebase ? (
          <button className="danger" onClick={() => { if (!game.command({ type: "debase" })) close(); }}>{t("policy.debase.name")}</button>
        ) : (
          <button onClick={() => { if (!game.command({ type: "policy", id: p!.id, on: !on })) close(); }}>{on ? t("policy.repeal") : t("policy.enact")}</button>
        )}
        <WhyLink id={isDebase ? "money-mirror" : p!.codex} />
      </div>
    </Dialog>
  );
}
