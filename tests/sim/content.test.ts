// Content checks: writers edit JSON, so the build must catch broken cards and missing links (§12).
import { describe, expect, it } from "vitest";
import codex from "../../src/content/codex.json" with { type: "json" };
import ghost from "../../src/data/ghost/britain1776.json" with { type: "json" };
import { EVENTS, INSTITUTIONS, POLICIES, newGame } from "../../src/sim/index.ts";
import { stat } from "../../src/sim/events.ts";

const OPS = new Set(["treasury", "trust", "inflation", "stock", "price", "class", "influence", "policy", "pop", "literacy", "capital", "fraud", "bandits", "granary", "institutionTrust", "worship", "technology", "credit", "debt", "advisor", "flag", "progress", "delay", "chronicle", "customs", "foreign", "releaseGranary"]);
const codexIds = new Set(codex.map((c) => c.id));

describe("events (§7)", () => {
  it("has about 30+ cards in all seven categories", () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(EVENTS.map((e) => e.category))).toEqual(new Set(["harvest", "money", "lobbying", "invention", "trade", "society", "history"]));
  });
  it("every card is bilingual, has choices and only valid effects", () => {
    const check = (effects: { op: string; effects?: unknown[] }[]) => {
      for (const e of effects) {
        expect(OPS.has(e.op), e.op).toBe(true);
        if (e.op === "delay") check(e.effects as { op: string }[]);
      }
    };
    for (const e of EVENTS) {
      expect(e.title.en && e.title.ar, e.id).toBeTruthy();
      expect(e.body.en && e.body.ar, e.id).toBeTruthy();
      expect(e.choices.length, e.id).toBeGreaterThan(0);
      for (const c of e.choices) {
        expect(c.label.en && c.label.ar, e.id).toBeTruthy();
        check(c.effects as { op: string }[]);
      }
      check((e.onFire ?? []) as { op: string }[]);
    }
  });
  it("every stat a condition tests exists", () => {
    const s = newGame("britain1776", 1);
    for (const e of EVENTS) for (const c of [...(e.when?.all ?? []), ...(e.when?.any ?? [])]) expect(() => stat(s, c.stat), `${e.id}:${c.stat}`).not.toThrow();
  });
  it("every 'Why?' link points at a codex entry", () => {
    for (const e of EVENTS) if (e.codex) expect(codexIds.has(e.codex), `${e.id} → ${e.codex}`).toBe(true);
    for (const p of Object.values(POLICIES)) expect(codexIds.has(p.codex), p.id).toBe(true);
    for (const i of Object.values(INSTITUTIONS)) if (i.codex) expect(codexIds.has(i.codex), i.id).toBe(true);
  });
});

describe("codex (§3 accuracy rules, §15 A Two Texts)", () => {
  it("has at least the 12 MVP entries plus the four root crafts", () => {
    expect(codex.length).toBeGreaterThanOrEqual(13);
    expect(codexIds.has("root-crafts")).toBe(true);
  });
  it("every Smith quote has been verified verbatim against Project Gutenberg", () => {
    for (const c of codex) if (c.quote.lang === "en") expect(c.quote.status, c.id).toBe("verified-gutenberg");
  });
  it("every Ghazali quotation is the verified Arabic text with a page citation", () => {
    for (const c of codex) if (c.quote.lang === "ar") {
      expect(["verified-dar-al-marifa", "verified-edition"], c.id).toContain(c.quote.status);
      expect(c.quote.text.length, c.id).toBeGreaterThan(20);
      expect(c.read ?? "", c.id).toMatch(/^https:\/\/shamela\.ws\/book\/\d+\/\d+$/);
      expect((c.quote.translation as { en?: string }).en, c.id).toBeTruthy();
    }
  });
});

describe("localisation (§11)", () => {
  it("English and Arabic UI files have exactly the same keys", async () => {
    const en = (await import("../../src/i18n/locales/en.json", { with: { type: "json" } })).default;
    const ar = (await import("../../src/i18n/locales/ar.json", { with: { type: "json" } })).default;
    const keys = (o: unknown, p = ""): string[] =>
      o && typeof o === "object" && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p];
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
});

describe("ghost bundle (§10 step 5)", () => {
  it("Britain series cover 1776–1850 and are labelled with sources", () => {
    const g = ghost.series.gdppc.points;
    expect(g[0][0]).toBe(1776);
    expect(g[g.length - 1][0]).toBe(1850);
    expect(ghost.series.realWage.points.length).toBe(75);
    expect(Object.keys(ghost.sources)).toEqual(expect.arrayContaining(["maddison_2023", "allen_labourers"]));
    for (const p of g) expect(["observed", "interpolated", "estimated"]).toContain(p[2]);
  });
});
