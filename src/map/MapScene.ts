// The map (GDD §11 "living ledger"): 2D isometric hexes, goods visibly moving on routes, the
// glowing market catchment, and overlays. Phaser draws; all game state comes from the controller.
import * as Phaser from "phaser";
import {
  BUILDINGS, SIM, buildGraph, canPlace, costsFrom, key, pathBetween,
  type Building, type GameState, type Tile,
} from "../sim/index.ts";
import { game } from "../game/store.ts";
import { i18n } from "../i18n/index.ts";
import { PALETTE, ROLE_COLORS } from "./palette.ts";

const SIZE = 30;
const SQUASH = 0.62; // isometric squash of the hex grid
const LIFT: Record<string, number> = { sea: 0, plains: 3, fertile: 3, forest: 4, hills: 9, mountains: 15 };

export function hexCenter(q: number, r: number): { x: number; y: number } {
  return { x: SIZE * Math.sqrt(3) * (q + r / 2), y: SIZE * 1.5 * r * SQUASH };
}

function pixelToHex(x: number, y: number): { q: number; r: number } {
  const py = y / SQUASH;
  const qf = ((Math.sqrt(3) / 3) * x - py / 3) / SIZE;
  const rf = ((2 / 3) * py) / SIZE;
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

function hexPoints(cx: number, cy: number, size = SIZE, lift = 0): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(new Phaser.Math.Vector2(cx + size * Math.cos(a), cy - lift + size * Math.sin(a) * SQUASH));
  }
  return pts;
}

interface Mover { path: { x: number; y: number }[]; t: number; speed: number; color: number; size: number; ship?: boolean }

export class MapScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private things!: Phaser.GameObjects.Graphics;
  private live!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private drawnKey = "";
  private drawnState: GameState | null = null;
  private stateSerial = 0;
  private movers: Mover[] = [];
  private smoke: { x: number; y: number; age: number }[] = [];
  private dragging = false;
  private userMoved = false;
  private dragStart = { x: 0, y: 0, sx: 0, sy: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private catchment: Float64Array | null = null;
  private catchmentFor = "";

  constructor() { super("map"); }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.paperDark);
    this.ground = this.add.graphics();
    this.overlay = this.add.graphics();
    this.things = this.add.graphics();
    this.live = this.add.graphics();
    this.cursor = this.add.graphics();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragging = false;
      this.dragStart = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const cam = this.cameras.main;
      if (p.isDown) {
        const dx = p.x - this.dragStart.x, dy = p.y - this.dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) this.dragging = true;
        if (this.dragging) { this.userMoved = true; cam.setScroll(this.dragStart.sx - dx / cam.zoom, this.dragStart.sy - dy / cam.zoom); }
      }
      const w = cam.getWorldPoint(p.x, p.y);
      const h = pixelToHex(w.x, w.y);
      const cur = game.ui.hover;
      if (!cur || cur.q !== h.q || cur.r !== h.r) game.setUi({ hover: h });
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.dragging) { this.dragging = false; return; }
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.click(pixelToHex(w.x, w.y), p.rightButtonDown());
    });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.zoom(dy > 0 ? 0.9 : 1.1));
    this.input.mouse?.disableContextMenu();
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    game.subscribe(() => this.syncFromStore());
    this.scale.on("resize", () => { this.drawnKey = ""; if (!this.userMoved) this.centre(); });
    this.syncFromStore();
    this.centre();
  }

  zoom(f: number) {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * f, 0.45, 2.6));
  }

  /** Fit the whole region in view: zoom first, then centre (centerOn depends on zoom). */
  centre() {
    const s = game.state;
    if (!s) return;
    const pts = s.tiles.filter((t) => t.terrain !== "sea").map((t) => hexCenter(t.q, t.r));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs) + SIZE * 3, h = Math.max(...ys) - Math.min(...ys) + SIZE * 3;
    const cam = this.cameras.main;
    const vw = this.scale.width || 800, vh = this.scale.height || 600;
    cam.setZoom(Phaser.Math.Clamp(Math.min(vw / w, vh / h) * 0.95, 0.45, 2.2));
    cam.centerOn((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2);
  }

  private click(h: { q: number; r: number }, right: boolean) {
    const s = game.state;
    if (!s || game.ui.modal) return;
    if (!s.tiles.some((t) => t.q === h.q && t.r === h.r)) return;
    const tool = right ? { kind: "inspect" as const } : game.ui.tool;
    switch (tool.kind) {
      case "inspect": game.setUi({ selected: h }); break;
      case "build": if (!game.command({ type: "build", building: tool.building, q: h.q, r: h.r })) game.setUi({ selected: h }); break;
      case "infra": game.command({ type: "infra", infra: tool.infra, q: h.q, r: h.r }); break;
      case "demolish": game.command({ type: "demolish", q: h.q, r: h.r }); break;
      case "foundTown": {
        const name = i18n.t("town.newName", { n: s.towns.length + 1 });
        if (!game.command({ type: "foundTown", q: h.q, r: h.r, name })) game.setUi({ tool: { kind: "inspect" } });
        break;
      }
    }
  }

  private syncFromStore() {
    if (!this.ground) return;
    const s = game.state;
    if (s !== this.drawnState) {
      const scenarioChanged = !this.drawnState || !s || this.drawnState.seed !== s.seed || this.drawnState.scenario !== s.scenario;
      this.drawnState = s;
      this.stateSerial++;
      if (s) this.buildMovers(s);
      if (scenarioChanged) { this.userMoved = false; this.centre(); }
    }
  }

  update(_time: number, delta: number) {
    const s = game.state;
    const cam = this.cameras.main;
    const speed = (0.6 * delta) / cam.zoom;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) cam.scrollX -= speed;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) cam.scrollX += speed;
    if (this.keys.W.isDown || this.keys.UP.isDown) cam.scrollY -= speed;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) cam.scrollY += speed;
    if (!s) { this.ground.clear(); this.things.clear(); this.live.clear(); return; }
    // Static layers redraw only when the game state, overlay or selection changes (not on hover).
    const sel = game.ui.selected;
    const k = `${this.stateSerial}|${game.ui.overlay}|${sel ? `${sel.q},${sel.r}` : ""}`;
    if (k !== this.drawnKey) {
      this.drawnKey = k;
      this.drawStatic(s);
    }
    this.drawLive(s, delta);
  }

  // ---------------------------------------------------------------- static layers
  private drawStatic(s: GameState) {
    const g = this.ground;
    g.clear();
    // Draw back-to-front so raised hexes overlap correctly.
    const tiles = [...s.tiles].sort((a, b) => a.r - b.r || a.q - b.q);
    for (const t of tiles) {
      const c = hexCenter(t.q, t.r);
      const lift = LIFT[t.terrain];
      const top = PALETTE.terrain[t.terrain];
      if (lift > 0) {
        g.fillStyle(PALETTE.shade(top, 0.62), 1);
        const base = hexPoints(c.x, c.y, SIZE, 0);
        const raised = hexPoints(c.x, c.y, SIZE, lift);
        // Side walls (the three lower edges).
        for (const [i, j] of [[0, 1], [1, 2], [2, 3]]) g.fillPoints([raised[i], raised[j], base[j], base[i]], true);
      }
      g.fillStyle(top, 1);
      g.fillPoints(hexPoints(c.x, c.y, SIZE - 0.5, lift), true);
      g.lineStyle(1, PALETTE.ink, t.terrain === "sea" ? 0.08 : 0.22);
      g.strokePoints(hexPoints(c.x, c.y, SIZE - 0.5, lift), true);
      this.terrainMarks(g, t, c.x, c.y - lift);
    }
    this.drawRivers(s);
    this.drawInfra(s);
    this.drawOverlay(s);
    this.drawThings(s);
  }

  private terrainMarks(g: Phaser.GameObjects.Graphics, t: Tile, x: number, y: number) {
    g.lineStyle(1.2, PALETTE.ink, 0.35);
    if (t.terrain === "forest") {
      for (const [dx, dy] of [[-8, 2], [0, -3], [8, 2]]) {
        g.fillStyle(PALETTE.forestDark, 0.9);
        g.fillTriangle(x + dx, y + dy - 9, x + dx - 5, y + dy + 2, x + dx + 5, y + dy + 2);
      }
    } else if (t.terrain === "hills") {
      g.beginPath(); g.arc(x - 5, y + 4, 7, Math.PI, 0); g.strokePath();
      g.beginPath(); g.arc(x + 7, y + 6, 5, Math.PI, 0); g.strokePath();
    } else if (t.terrain === "mountains") {
      g.fillStyle(PALETTE.snow, 0.9);
      g.fillTriangle(x, y - 12, x - 10, y + 6, x + 10, y + 6);
      g.lineStyle(1.2, PALETTE.ink, 0.5);
      g.strokeTriangle(x, y - 12, x - 10, y + 6, x + 10, y + 6);
    } else if (t.terrain === "fertile") {
      g.lineStyle(1, PALETTE.ink, 0.18);
      for (let i = -1; i <= 1; i++) g.lineBetween(x - 10, y + i * 5, x + 10, y + i * 5 - 2);
    } else if (t.terrain === "sea") {
      g.lineStyle(1, PALETTE.paper, 0.18);
      g.beginPath(); g.arc(x - 4, y, 4, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
      g.beginPath(); g.arc(x + 5, y + 3, 4, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
    }
    if (t.deposit) {
      g.fillStyle(PALETTE.ore, 1);
      g.fillCircle(x + 10, y + 5, 3);
      g.lineStyle(1, PALETTE.ink, 0.6);
      g.strokeCircle(x + 10, y + 5, 3);
    }
  }

  private surface(s: GameState, q: number, r: number) {
    const c = hexCenter(q, r);
    const t = s.tiles.find((x) => x.q === q && x.r === r);
    return { x: c.x, y: c.y - (t ? LIFT[t.terrain] : 0) };
  }

  private drawRivers(s: GameState) {
    const g = this.ground;
    for (const t of s.tiles) {
      if (!t.river || !t.riverNext) continue;
      const [q, r] = t.riverNext.split(",").map(Number);
      const a = this.surface(s, t.q, t.r), b = this.surface(s, q, r);
      g.lineStyle(5, PALETTE.paper, 0.5);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(3, PALETTE.river, 0.95);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  private drawInfra(s: GameState) {
    const g = this.ground;
    const style: Record<string, [number, number, number]> = { road: [3, PALETTE.road, 0.9], canal: [5, PALETTE.canal, 0.95], rail: [3, PALETTE.rail, 1] };
    const linked = (k: string) => s.infra[k] || s.towns.some((t) => key(t) === k) || s.buildings.some((b) => b.type === "port" && key(b) === k);
    for (const [k, kind] of Object.entries(s.infra)) {
      const [q, r] = k.split(",").map(Number);
      const a = this.surface(s, q, r);
      for (const [dq, dr] of [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]) {
        const nk = `${q + dq},${r + dr}`;
        if (!linked(nk)) continue;
        // Draw each segment once (from the lower key), unless the neighbour is a town or port.
        if (s.infra[nk] && nk < k) continue;
        const b = this.surface(s, q + dq, r + dr);
        const [w, col, al] = style[kind];
        g.lineStyle(w, col, al);
        g.lineBetween(a.x, a.y, b.x, b.y);
        if (kind === "rail") {
          g.lineStyle(1, PALETTE.ink, 0.8);
          for (let f = 0.2; f < 1; f += 0.25) {
            const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
            g.lineBetween(x - 3, y - 2, x + 3, y + 2);
          }
        }
      }
      if (!Object.keys(s.infra).some((o) => o !== k)) {
        g.fillStyle(style[kind][1], 1);
        g.fillCircle(a.x, a.y, 3);
      }
    }
  }

  private catchmentField(s: GameState, b: Building): Float64Array {
    const id = `${b.id}|${this.stateSerial}`;
    if (this.catchment && this.catchmentFor === id) return this.catchment;
    const gr = buildGraph(s);
    const dist = costsFrom(gr, gr.index.get(key(b))!);
    const field = new Float64Array(dist.length);
    for (let i = 0; i < dist.length; i++) field[i] = Number.isFinite(dist[i]) ? Math.exp(-dist[i] / SIM.c0) : 0;
    this.catchment = field;
    this.catchmentFor = id;
    return field;
  }

  private drawOverlay(s: GameState) {
    const g = this.overlay;
    g.clear();
    const ov = game.ui.overlay;
    const sel = game.ui.selected;
    const selB = sel ? s.buildings.find((b) => b.q === sel.q && b.r === sel.r) : undefined;
    // The glowing catchment of the selected workshop (§4.3) shows whenever one is selected.
    if ((ov === "reach" || (selB && BUILDINGS[selB.type].good)) && selB) {
      const field = this.catchmentField(s, selB);
      s.tiles.forEach((t, i) => {
        const v = field[i];
        if (v < 0.05) return;
        const c = this.surface(s, t.q, t.r);
        g.fillStyle(PALETTE.gold, 0.12 + 0.45 * v);
        g.fillPoints(hexPoints(c.x, c.y, SIZE - 3), true);
      });
    }
    if (ov === "mood") {
      for (const t of s.towns) {
        const c = this.surface(s, t.q, t.r);
        const col = t.mood >= 55 ? PALETTE.good : t.mood >= 35 ? PALETTE.warn : PALETTE.bad;
        g.lineStyle(4, col, 0.9);
        g.strokeCircle(c.x, c.y, 16 + Math.sqrt(t.pop));
      }
    }
  }

  private drawThings(s: GameState) {
    const g = this.things;
    g.clear();
    for (const l of this.labels) l.destroy();
    this.labels = [];
    const ov = game.ui.overlay;
    const avgWage = s.labor.avgWage || 1;
    const items = [
      ...s.towns.map((t) => ({ kind: "town" as const, t, r: t.r, q: t.q })),
      ...s.buildings.map((b) => ({ kind: "building" as const, b, r: b.r, q: b.q })),
    ].sort((a, b) => a.r - b.r || a.q - b.q);
    for (const it of items) {
      const c = this.surface(s, it.q, it.r);
      if (it.kind === "town") {
        const t = it.t;
        const rad = 8 + Math.sqrt(t.pop) * 0.9;
        // Houses clustered around a market cross.
        const n = Math.min(9, 3 + Math.floor(t.pop / 20));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, d = rad * 0.55;
          const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * SQUASH;
          g.fillStyle(PALETTE.roof, 1);
          g.fillTriangle(x - 5, y - 2, x + 5, y - 2, x, y - 8);
          g.fillStyle(PALETTE.wall, 1);
          g.fillRect(x - 4, y - 2, 8, 6);
          g.lineStyle(1, PALETTE.ink, 0.7);
          g.strokeRect(x - 4, y - 2, 8, 6);
        }
        g.fillStyle(PALETTE.gold, 1);
        g.fillCircle(c.x, c.y - 2, 4);
        g.lineStyle(1.5, PALETTE.ink, 0.9);
        g.strokeCircle(c.x, c.y - 2, 4);
        const label = this.add.text(c.x, c.y + rad * 0.7 + 4, `${i18n.t(`town.${t.name}`, { defaultValue: t.name })}`, {
          fontFamily: "'EB Garamond', 'Amiri', Georgia, serif", fontSize: "13px", color: "#2a2018",
          backgroundColor: "rgba(244,236,214,0.78)", padding: { x: 4, y: 1 },
        }).setOrigin(0.5, 0).setResolution(2);
        this.labels.push(label);
        continue;
      }
      const b = it.b;
      const def = BUILDINGS[b.type];
      // Plinth.
      g.fillStyle(PALETTE.paper, 0.95);
      g.fillEllipse(c.x, c.y + 4, 30, 14);
      g.lineStyle(1, PALETTE.ink, 0.55);
      g.strokeEllipse(c.x, c.y + 4, 30, 14);
      // Overlay tints: price vs natural, or wage vs average (icons as well as colour).
      if (ov === "prices" && def.good) {
        const gs = s.goods[def.good];
        const ratio = gs.price / gs.natural;
        const col = ratio > 1.15 ? PALETTE.bad : ratio < 0.87 ? PALETTE.cool : PALETTE.good;
        g.fillStyle(col, 0.5);
        g.fillEllipse(c.x, c.y + 4, 34, 17);
        this.badge(c.x + 14, c.y - 16, ratio > 1.15 ? "▲" : ratio < 0.87 ? "▼" : "=", col);
      }
      if (ov === "wages" && def.good) {
        const ratio = b.wage / avgWage;
        const col = ratio > 1.1 ? PALETTE.good : ratio < 0.9 ? PALETTE.bad : PALETTE.warn;
        g.fillStyle(col, 0.5);
        g.fillEllipse(c.x, c.y + 4, 34, 17);
      }
      this.icon(g, b, c.x, c.y);
      if (def.good) {
        // Specialists: one dot per worker, coloured by role; more roles at higher levels (§4.2).
        const n = Math.min(20, Math.round(b.workers));
        for (let i = 0; i < n; i++) {
          const role = i % b.level;
          const row = Math.floor(i / 10), col = i % 10;
          g.fillStyle(ROLE_COLORS[role], 1);
          g.fillCircle(c.x - 13 + col * 2.9, c.y + 14 + row * 3.5, 1.3);
        }
        // Level pips.
        for (let i = 0; i < 5; i++) {
          g.fillStyle(i < b.level ? PALETTE.gold : PALETTE.paperDark, 1);
          g.fillRect(c.x - 9 + i * 4, c.y - 22, 3, 3);
          g.lineStyle(0.6, PALETTE.ink, 0.7);
          g.strokeRect(c.x - 9 + i * 4, c.y - 22, 3, 3);
        }
        if (b.inputFill < 0.7) this.badge(c.x - 15, c.y - 16, "!", PALETTE.bad);       // bottleneck
        else if (b.sold < 0.6 && b.output > 0) this.badge(c.x - 15, c.y - 16, "✕", PALETTE.muted); // no buyers
        else if (b.level < b.maxLevel) this.badge(c.x + 15, c.y - 20, "↑", PALETTE.good);
        if (b.private) { g.fillStyle(PALETTE.ink, 0.6); g.fillCircle(c.x + 13, c.y + 9, 1.6); }
      }
    }
  }

  private badge(x: number, y: number, glyph: string, color: number) {
    const t = this.add.text(x, y, glyph, {
      fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#fff",
      backgroundColor: `#${color.toString(16).padStart(6, "0")}`, padding: { x: 3, y: 0 },
    }).setOrigin(0.5).setResolution(2);
    this.labels.push(t);
  }

  /** Small vector icons per building type: ink line art on the plinth. */
  private icon(g: Phaser.GameObjects.Graphics, b: Building, x: number, y: number) {
    const ink = PALETTE.ink;
    g.lineStyle(1.4, ink, 0.9);
    switch (b.type) {
      case "farm":
        g.fillStyle(PALETTE.wheat, 1);
        for (let i = -2; i <= 2; i++) { g.fillRect(x + i * 4 - 1, y - 9, 2, 10); g.fillEllipse(x + i * 4, y - 10, 3, 5); }
        break;
      case "pasture":
        g.fillStyle(0xffffff, 1); g.fillEllipse(x - 3, y - 4, 12, 8); g.strokeEllipse(x - 3, y - 4, 12, 8);
        g.fillStyle(ink, 1); g.fillCircle(x + 4, y - 6, 2.5);
        break;
      case "lumber":
        g.fillStyle(PALETTE.wood, 1); g.fillRect(x - 9, y - 6, 18, 4); g.fillRect(x - 7, y - 11, 14, 4);
        g.strokeRect(x - 9, y - 6, 18, 4); g.strokeRect(x - 7, y - 11, 14, 4);
        break;
      case "mine":
        g.fillStyle(PALETTE.ink, 1); g.fillTriangle(x - 8, y, x + 8, y, x, y - 12);
        g.fillStyle(PALETTE.ore, 1); g.fillCircle(x, y - 4, 2.5);
        break;
      case "port":
        g.lineStyle(2, ink, 1); g.lineBetween(x, y - 14, x, y + 2);
        g.beginPath(); g.arc(x, y - 3, 7, 0.2, Math.PI - 0.2); g.strokePath(); g.lineBetween(x - 5, y - 11, x + 5, y - 11);
        break;
      case "courthouse":
        g.fillStyle(PALETTE.wall, 1); g.fillRect(x - 9, y - 9, 18, 9); g.strokeRect(x - 9, y - 9, 18, 9);
        g.fillStyle(PALETTE.roof, 1); g.fillTriangle(x - 11, y - 9, x + 11, y - 9, x, y - 16);
        for (let i = -1; i <= 1; i++) g.lineBetween(x + i * 5, y - 8, x + i * 5, y);
        break;
      case "school":
        g.fillStyle(PALETTE.paper, 1); g.fillRect(x - 8, y - 11, 16, 10); g.strokeRect(x - 8, y - 11, 16, 10);
        g.lineBetween(x, y - 11, x, y - 1);
        break;
      case "granary":
        g.fillStyle(PALETTE.wheat, 1); g.fillEllipse(x, y - 6, 14, 14); g.strokeEllipse(x, y - 6, 14, 14);
        break;
      default: {
        // Workshops: a roofed shop with a chimney; the craft's colour on the door.
        const door: Record<string, number> = { bakery: 0xc58a3c, weaver: 0x8a5aa8, smithy: 0x555555, builder: 0xa0522d, pinworks: 0xb8b8c8 };
        g.fillStyle(PALETTE.wall, 1); g.fillRect(x - 9, y - 9, 18, 10); g.strokeRect(x - 9, y - 9, 18, 10);
        g.fillStyle(PALETTE.roof, 1); g.fillTriangle(x - 11, y - 9, x + 11, y - 9, x, y - 17); g.strokeTriangle(x - 11, y - 9, x + 11, y - 9, x, y - 17);
        g.fillStyle(PALETTE.ink, 1); g.fillRect(x + 5, y - 19, 3, 6);
        g.fillStyle(door[b.type] ?? ink, 1); g.fillRect(x - 3, y - 5, 6, 6);
        if (b.type === "pinworks") { g.lineStyle(1, ink, 1); g.lineBetween(x - 7, y - 3, x - 7, y + 1); g.fillCircle(x - 7, y - 3, 1); }
      }
    }
  }

  // ---------------------------------------------------------------- moving goods
  private buildMovers(s: GameState) {
    const gr = buildGraph(s);
    const movers: Mover[] = [];
    const towns = s.towns;
    for (const b of s.buildings) {
      const def = BUILDINGS[b.type];
      if (!def.good || b.output <= 0.1 || !towns.length) continue;
      const nearest = towns.reduce((a, t) => (Math.abs(t.q - b.q) + Math.abs(t.r - b.r) < Math.abs(a.q - b.q) + Math.abs(a.r - b.r) ? t : a));
      const idx = pathBetween(gr, gr.index.get(key(b))!, gr.index.get(key(nearest))!);
      if (idx.length < 2) continue;
      const path = idx.map((i) => this.surface(s, s.tiles[i].q, s.tiles[i].r));
      const value = b.output * s.goods[def.good].price;
      const count = Math.max(1, Math.min(4, Math.round(Math.sqrt(value) / 2)));
      for (let k = 0; k < count; k++) {
        movers.push({ path, t: k / count, speed: 0.00012 * (s.infra[key(b)] ? 2 : 1) * (6 / path.length + 0.4), color: PALETTE.goods[def.good] ?? PALETTE.ink, size: 2.6 });
      }
    }
    // Ships leave the ports for the open sea.
    for (const b of s.buildings.filter((x) => x.type === "port")) {
      const start = this.surface(s, b.q, b.r);
      const seaN = s.tiles.filter((t) => t.terrain === "sea" && Math.abs(t.q - b.q) + Math.abs(t.r - b.r) <= 2)[0];
      if (!seaN) continue;
      const mid = this.surface(s, seaN.q, seaN.r);
      const out = { x: mid.x + (mid.x - start.x) * 6, y: mid.y + (mid.y - start.y) * 6 };
      const trade = s.goods.spices.imported + Object.values(s.goods).reduce((a, g) => a + g.exported, 0);
      const ships = Math.max(1, Math.min(3, Math.round(trade / 20)));
      for (let k = 0; k < ships; k++) movers.push({ path: [start, mid, out], t: k / ships, speed: 0.00006, color: PALETTE.ink, size: 4, ship: true });
    }
    this.movers = movers.slice(0, 500); // §12: 500 moving units at 60 fps
  }

  private drawLive(s: GameState, delta: number) {
    const g = this.live;
    g.clear();
    for (const m of this.movers) {
      m.t = (m.t + m.speed * delta) % 1;
      const n = m.path.length - 1;
      const f = m.t * n;
      const i = Math.min(n - 1, Math.floor(f));
      const a = m.path[i], b = m.path[i + 1];
      const x = a.x + (b.x - a.x) * (f - i), y = a.y + (b.y - a.y) * (f - i);
      if (m.ship) {
        const fade = 1 - m.t;
        g.fillStyle(PALETTE.paper, fade);
        g.fillTriangle(x - 5, y, x + 5, y, x, y - 8);
        g.lineStyle(1, PALETTE.ink, fade);
        g.strokeTriangle(x - 5, y, x + 5, y, x, y - 8);
      } else {
        g.fillStyle(m.color, 1);
        g.fillCircle(x, y - 3, m.size);
        g.lineStyle(0.8, PALETTE.ink, 0.8);
        g.strokeCircle(x, y - 3, m.size);
      }
    }
    // Smoke from busy, specialised workshops.
    if (Math.random() < delta / 120) {
      const busy = s.buildings.filter((b) => b.level >= 3 && BUILDINGS[b.type].good && !["farm", "pasture", "lumber"].includes(b.type));
      if (busy.length) {
        const b = busy[Math.floor(Math.random() * busy.length)];
        const c = this.surface(s, b.q, b.r);
        this.smoke.push({ x: c.x + 6, y: c.y - 20, age: 0 });
      }
    }
    this.smoke = this.smoke.filter((p) => (p.age += delta) < 2200);
    for (const p of this.smoke) {
      const k = p.age / 2200;
      g.fillStyle(PALETTE.smoke, 0.5 * (1 - k));
      g.fillCircle(p.x + k * 8, p.y - k * 22, 2 + k * 5);
    }
    // Selection, hover and build preview.
    const cur = this.cursor;
    cur.clear();
    const sel = game.ui.selected;
    if (sel) {
      const c = this.surface(s, sel.q, sel.r);
      cur.lineStyle(3, PALETTE.gold, 1);
      cur.strokePoints(hexPoints(c.x, c.y, SIZE - 2), true);
    }
    const h = game.ui.hover;
    if (h && !game.ui.modal) {
      const tile = s.tiles.find((t) => t.q === h.q && t.r === h.r);
      if (tile) {
        const c = this.surface(s, h.q, h.r);
        const tool = game.ui.tool;
        let ok = true;
        if (tool.kind === "build") ok = canPlace(s, tool.building, tile) === null;
        if (tool.kind === "infra") ok = tile.terrain !== "sea";
        cur.lineStyle(2, tool.kind === "inspect" ? PALETTE.ink : ok ? PALETTE.good : PALETTE.bad, 0.9);
        cur.strokePoints(hexPoints(c.x, c.y, SIZE - 4), true);
      }
    }
  }
}

export function mountMap(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#d9c9a3",
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    scene: [MapScene],
    render: { antialias: true },
    input: { keyboard: true, mouse: { preventDefaultWheel: true } },
  });
}
