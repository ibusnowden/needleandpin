// The map (GDD §11 "living ledger"): 2D isometric hexes, goods visibly moving on routes, the
// glowing market catchment, and overlays. Phaser draws; all game state comes from the controller.
import * as Phaser from "phaser";
import {
  BUILDINGS, SIM, buildGraph, canPlace, costsFrom, ctxFor, key,
  type Building, type GameState,
} from "../sim/index.ts";
import { game } from "../game/store.ts";
import { i18n } from "../i18n/index.ts";
import { allSprites, K, svgDataUrl } from "../art/sprites.ts";
import { PALETTE } from "./palette.ts";

const SPRITES = allSprites();
const SPRITE = new Map(SPRITES.map((d) => [d.key, d]));

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
  private smoke: { x: number; y: number; age: number }[] = [];
  private dragging = false;
  private userMoved = false;
  private dragStart = { x: 0, y: 0, sx: 0, sy: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private catchment: Float64Array | null = null;
  private catchmentFor = "";
  private tileImgs: Phaser.GameObjects.Image[] = [];
  private tilesFor = "";
  private thingImgs: Phaser.GameObjects.GameObject[] = [];
  private workers: { img: Phaser.GameObjects.Image; role: number; b: string }[] = [];
  private moverImgs: Phaser.GameObjects.Image[] = [];
  private animClock = 0;

  constructor() { super("map"); }

  preload() {
    for (const d of SPRITES) this.load.image(d.key, svgDataUrl(d.svg));
  }

  /** Place a sprite with its anchor on a world point, at 1/K scale (sprites are drawn 2×). */
  private sprite(key: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const d = SPRITE.get(key)!;
    return this.add.image(x, y, key).setOrigin(d.ox, d.oy).setScale(1 / K).setDepth(depth);
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.paperDark);
    this.ground = this.add.graphics();
    this.overlay = this.add.graphics();
    this.things = this.add.graphics();
    this.live = this.add.graphics();
    this.cursor = this.add.graphics();
    this.ground.setDepth(5000);
    this.overlay.setDepth(6000);
    this.things.setDepth(9000);
    this.live.setDepth(25000);
    this.cursor.setDepth(30000);
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
    const k = `${this.stateSerial}|${s.netVersion}|${s.turn}|${Math.floor(s.day / 30)}|${s.buildings.length}|${game.ui.overlay}|${sel ? `${sel.q},${sel.r}` : ""}`;
    if (k !== this.drawnKey) {
      this.drawnKey = k;
      this.drawStatic(s);
    }
    this.drawLive(s, delta);
  }

  // ---------------------------------------------------------------- static layers
  private drawStatic(s: GameState) {
    // Textured terrain tiles are created once per map; roads, rivers and things redraw on change.
    const tilesKey = `${s.scenario}|${s.seed}`;
    if (tilesKey !== this.tilesFor) {
      for (const im of this.tileImgs) im.destroy();
      this.tileImgs = s.tiles.map((t) => {
        const c = hexCenter(t.q, t.r);
        const v = Math.abs((t.q * 7 + t.r * 13) % 3);
        return this.sprite(`t-${t.terrain}-${v}`, c.x, c.y - LIFT[t.terrain], c.y);
      });
      this.tilesFor = tilesKey;
    }
    this.ground.clear();
    for (const t of s.tiles) if (t.deposit) {
      const c = this.surface(s, t.q, t.r);
      this.ground.fillStyle(PALETTE.ore, 1).fillCircle(c.x + 10, c.y + 5, 2.6).lineStyle(1, PALETTE.ink, 0.7).strokeCircle(c.x + 10, c.y + 5, 2.6);
    }
    this.drawRivers(s);
    this.drawInfra(s);
    this.drawOverlay(s);
    this.drawThings(s);
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
    for (const o of this.thingImgs) o.destroy();
    for (const w of this.workers) w.img.destroy();
    this.labels = [];
    this.thingImgs = [];
    this.workers = [];
    const ov = game.ui.overlay;
    const avgWage = s.labor.avgWage || 1;
    for (const t of s.towns) {
      const c = this.surface(s, t.q, t.r);
      const size = Math.max(1, Math.min(5, Math.round(Math.sqrt(t.pop) / 2.4)));
      this.thingImgs.push(this.sprite(`town-${size}`, c.x, c.y + 4, 10000 + c.y));
      const label = this.add.text(c.x, c.y + 10, `${i18n.t(`town.${t.name}`, { defaultValue: t.name })}`, {
        fontFamily: "'EB Garamond', 'Amiri', Georgia, serif", fontSize: "13px", color: "#2a2018",
        backgroundColor: "rgba(244,236,214,0.82)", padding: { x: 4, y: 1 },
      }).setOrigin(0.5, 0).setResolution(2).setDepth(20000 + c.y);
      this.labels.push(label);
    }
    for (const b of s.buildings) {
      const def = BUILDINGS[b.type];
      const c = this.surface(s, b.q, b.r);
      // Overlay tints sit under the illustration (with icons, never colour alone).
      if (ov === "prices" && def.good) {
        const gs = s.goods[def.good];
        const ratio = gs.price / gs.natural;
        const col = ratio > 1.15 ? PALETTE.bad : ratio < 0.87 ? PALETTE.cool : PALETTE.good;
        g.fillStyle(col, 0.55).fillEllipse(c.x, c.y + 4, 40, 18);
        this.badge(c.x + 14, c.y - 22, ratio > 1.15 ? "▲" : ratio < 0.87 ? "▼" : "=", col);
      }
      if (ov === "wages" && def.good) {
        const ratio = b.wage / avgWage;
        g.fillStyle(ratio > 1.1 ? PALETTE.good : ratio < 0.9 ? PALETTE.bad : PALETTE.warn, 0.55).fillEllipse(c.x, c.y + 4, 40, 18);
      }
      this.thingImgs.push(this.sprite(`b-${b.type}`, c.x, c.y + 5, 10000 + c.y));
      if (!def.good) continue;
      // Workers at their crafts: one figure per two hands, in the colours of their roles (§4.2).
      const n = Math.min(8, Math.round(b.workers / 2));
      for (let i = 0; i < n; i++) {
        const role = i % b.level;
        const a = Math.PI * (0.15 + (i / Math.max(1, n)) * 0.7);
        const x = c.x + Math.cos(a) * 17 - 1, y = c.y + 9 + Math.sin(a) * 4;
        this.workers.push({ img: this.sprite(`w-${role}-0`, x, y, 10001 + y), role, b: b.id });
      }
      // Specialisation pips (gold leaf).
      for (let i = 0; i < 5; i++) {
        g.fillStyle(i < b.level ? PALETTE.gold : PALETTE.paperDark, 1).fillRect(c.x - 9 + i * 4, c.y - 27, 3, 3);
        g.lineStyle(0.6, PALETTE.ink, 0.7).strokeRect(c.x - 9 + i * 4, c.y - 27, 3, 3);
      }
      if (b.status === "starved") this.badge(c.x - 15, c.y - 22, "!", PALETTE.bad);
      else if (b.status === "blocked") this.badge(c.x - 15, c.y - 22, "✕", PALETTE.muted);
      else if (b.level < b.maxLevel) this.badge(c.x + 15, c.y - 26, "↑", PALETTE.good);
    }
    this.things.setDepth(9000);
  }

  private badge(x: number, y: number, glyph: string, color: number) {
    const t = this.add.text(x, y, glyph, {
      fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#fff",
      backgroundColor: `#${color.toString(16).padStart(6, "0")}`, padding: { x: 3, y: 0 },
    }).setOrigin(0.5).setResolution(2).setDepth(21000 + y);
    this.labels.push(t);
  }

  // ---------------------------------------------------------------- moving goods
  private drawLive(s: GameState, delta: number) {
    const g = this.live;
    g.clear();
    // The simulation's own carts, barges and ships, on the tiles where they really are.
    const ctx = ctxFor(s);
    const carts = s.carts.length > 600 ? s.carts.slice(0, 600) : s.carts;
    while (this.moverImgs.length < carts.length) this.moverImgs.push(this.add.image(0, 0, "v-cart").setScale(1 / K).setOrigin(0.5, 0.9));
    this.moverImgs.forEach((im, i) => im.setVisible(i < carts.length));
    const land = s.scenario === "needle" ? "v-camel" : "v-cart";
    const frac = game.dayFraction();
    carts.forEach((c, idx) => {
      const ti = c.path[c.seg], tn = c.path[Math.min(c.seg + 1, c.path.length - 1)];
      const ta = s.tiles[ti], tb = s.tiles[tn];
      const a = this.surface(s, ta.q, ta.r), b = this.surface(s, tb.q, tb.r);
      const cost = ctx.g.enter[tn] || 1;
      const f = Math.min(1, (c.acc + frac) / cost);
      const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
      const inf = s.infra[`${ta.q},${ta.r}`];
      const tex = ta.terrain === "sea" ? "v-ship" : inf === "canal" || (ta.river && !inf) ? "v-barge" : land;
      const im = this.moverImgs[idx];
      if (im.texture.key !== tex) im.setTexture(tex);
      im.setPosition(x, y).setDepth(10002 + y).setFlipX(b.x < a.x).setTint(c.waited > 0 && s.jam[tn] > 0.5 ? 0xff9a7a : 0xffffff);
      if (tex !== "v-ship") g.fillStyle(PALETTE.goods[c.good] ?? PALETTE.ink, 1).fillRect(x - 2.5, y - 9, 5, 3);
    });
    // Traffic: roads glow with flow and turn red where carts queue.
    if (game.ui.overlay === "traffic") {
      s.tiles.forEach((t, i) => {
        if (s.flow[i] < 0.05 && s.jam[i] < 0.2) return;
        const c = this.surface(s, t.q, t.r);
        const cap = ctx.cap[i] >= 1e8 ? 50 : ctx.cap[i];
        const load = Math.min(1, s.flow[i] / cap + s.jam[i] / 3);
        g.fillStyle(load > 0.75 ? PALETTE.bad : load > 0.4 ? PALETTE.warn : PALETTE.good, 0.25 + 0.5 * load);
        g.fillCircle(c.x, c.y, 4 + 8 * load);
      });
    }
    // Workers at work: two-frame animation; idle shops stand still.
    this.animClock += delta;
    const frame = Math.floor(this.animClock / 380) % 2;
    for (const w of this.workers) {
      const bld = s.buildings.find((x) => x.id === w.b);
      const busy = bld && bld.status === "working" && game.ui.speed > 0;
      w.img.setTexture(`w-${w.role}-${busy ? frame : 0}`);
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
