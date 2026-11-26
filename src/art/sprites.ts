// Illustrated sprite set, drawn as SVG and rasterised into Phaser textures at boot.
// Art direction (GDD §11 "living ledger", with Arabic art as the main inspiration):
//   • buildings and towns after the 13th-century Baghdad miniatures of al-Wasiti (Maqamat al-Hariri):
//     domes, pointed arches, iwans, mashrabiya lattices, striped ablaq stone, gold accents;
//   • an Iznik palette (turquoise, cobalt, coral, sage) on parchment;
//   • Persian-miniature landscape: sponge-rock hills, cypress and plane trees, scrolled waves;
//   • watercolour texture from SVG turbulence filters, ink outlines, hatching.
// Every sprite is drawn at 2× and shown at half scale for crisp lines.

export const K = 2; // supersampling
export const HEX = { S: 30, SQUASH: 0.62 };

const INK = "#2a2018";
const C = {
  paper: "#f4ecd6", ochre: "#e2cf9c", sand: "#d8c08a", sage: "#a9b98a", olive: "#7d9a5c", cypress: "#3f5e3a",
  turq: "#4fa3a5", cobalt: "#2c5d8f", deep: "#1f4870", coral: "#c8553d", rose: "#d9a6a0", lilac: "#a796b4",
  gold: "#c89b2c", goldL: "#e8c766", stone: "#e9dcc0", stoneD: "#c9b48c", brick: "#b5694a", wood: "#8a5a34", white: "#fbf6e9",
};

export interface SpriteDef { key: string; svg: string; w: number; h: number; ox: number; oy: number }

const svg = (w: number, h: number, body: string, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w * K}" height="${h * K}" viewBox="0 0 ${w} ${h}">` +
  `<defs>${defs}</defs>${body}</svg>`;

/** Watercolour wash and paper grain filters (seeded so variants differ). */
const washDefs = (id: string, seed: number, freq = 0.08, strength = 0.35) => `
  <filter id="w${id}" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${strength * 2.2} -${strength * 0.6}" result="a"/>
    <feComposite in="SourceGraphic" in2="a" operator="arithmetic" k1="0" k2="1" k3="-0.55" k4="0"/>
  </filter>
  <filter id="g${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed + 3}"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.12  0 0 0 0 0.09  0 0 0 0.12 0"/></filter>`;

// ---------------------------------------------------------------- terrain tiles
export const LIFT: Record<string, number> = { sea: 0, plains: 3, fertile: 3, forest: 4, hills: 9, mountains: 15 };

function hexPath(cx: number, cy: number, s: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + s * Math.cos(a)).toFixed(2)},${(cy + s * Math.sin(a) * HEX.SQUASH).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

function rnd(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Persian-miniature cypress: tall flame shape with ink outline. */
const cypress = (x: number, y: number, h: number) =>
  `<path d="M${x},${y - h} C${x + h * 0.28},${y - h * 0.55} ${x + h * 0.22},${y - h * 0.1} ${x},${y} C${x - h * 0.22},${y - h * 0.1} ${x - h * 0.28},${y - h * 0.55} ${x},${y - h}Z" fill="${C.cypress}" stroke="${INK}" stroke-width="0.5"/>
   <path d="M${x},${y - h * 0.85} L${x},${y - h * 0.1}" stroke="#2c4429" stroke-width="0.4"/>`;
/** Plane tree: round crown of leaf scallops. */
const plane = (x: number, y: number, r: number) =>
  `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - r * 1.1}" stroke="${C.wood}" stroke-width="1.1"/>
   <circle cx="${x}" cy="${y - r * 1.6}" r="${r}" fill="${C.olive}" stroke="${INK}" stroke-width="0.5"/>
   <circle cx="${x - r * 0.35}" cy="${y - r * 1.8}" r="${r * 0.35}" fill="#93b06d"/>
   <circle cx="${x + r * 0.3}" cy="${y - r * 1.45}" r="${r * 0.28}" fill="#93b06d"/>`;
/** Sponge-rock hill in the Tabriz/Shiraz manner. */
const rock = (x: number, y: number, w: number, h: number, fill: string) =>
  `<path d="M${x - w / 2},${y} C${x - w * 0.45},${y - h * 0.7} ${x - w * 0.2},${y - h} ${x},${y - h} C${x + w * 0.25},${y - h * 1.05} ${x + w * 0.5},${y - h * 0.6} ${x + w / 2},${y} Z" fill="${fill}" stroke="${INK}" stroke-width="0.6"/>
   <path d="M${x - w * 0.25},${y - h * 0.45} q${w * 0.12},-${h * 0.2} ${w * 0.25},0 M${x + w * 0.05},${y - h * 0.75} q${w * 0.1},-${h * 0.15} ${w * 0.2},0" fill="none" stroke="${INK}" stroke-width="0.4" opacity="0.7"/>`;

export function terrainSprite(terrain: string, variant: number): SpriteDef {
  const S = HEX.S;
  const lift = LIFT[terrain];
  const W = Math.ceil(S * Math.sqrt(3)) + 4;
  const top = S * HEX.SQUASH + 2;
  const H = Math.ceil(2 * S * HEX.SQUASH + lift + 4);
  const cx = W / 2, cy = top;
  const r = rnd(terrain.length * 97 + variant * 13 + 5);
  const id = `${terrain}${variant}`;
  const fill: Record<string, string> = { sea: C.turq, plains: C.ochre, fertile: C.sage, forest: "#b4c18d", hills: C.sand, mountains: "#cbb9b2" };
  const side: Record<string, string> = { plains: "#bfa56f", fertile: "#8d9a6c", forest: "#8f9a68", hills: "#a88c5c", mountains: "#998a8f" };
  let deco = "";
  if (terrain === "sea") {
    deco += `<path d="${hexPath(cx, cy, S)}" fill="url(#sea${id})"/>`;
    for (let i = 0; i < 4; i++) {
      const x = cx - 16 + r() * 32, y = cy - 8 + r() * 14;
      // Scrolled waves, as in miniature painting.
      deco += `<path d="M${x - 5},${y} q2.5,-3 5,0 q2.5,3 5,0" fill="none" stroke="${C.white}" stroke-width="0.7" opacity="0.75"/>
               <path d="M${x + 5},${y} c1.5,-2.2 -1,-3.4 -2,-1.6" fill="none" stroke="${C.white}" stroke-width="0.6" opacity="0.7"/>`;
    }
  } else if (terrain === "plains") {
    for (let i = 0; i < 14; i++) deco += `<circle cx="${cx - 20 + r() * 40}" cy="${cy - 9 + r() * 18}" r="${0.4 + r() * 0.4}" fill="#9c8452" opacity="0.6"/>`;
    for (let i = 0; i < 3; i++) { const x = cx - 14 + r() * 28, y = cy - 5 + r() * 10; deco += `<path d="M${x},${y} l1,-3 M${x + 1.5},${y} l0,-3.4 M${x + 3},${y} l-0.8,-2.8" stroke="#8a7a3c" stroke-width="0.5"/>`; }
  } else if (terrain === "fertile") {
    for (let i = -3; i <= 3; i++) deco += `<path d="M${cx - 22},${cy + i * 3.4} q22,-3 44,0" fill="none" stroke="#6f8a4c" stroke-width="0.6" opacity="0.65"/>`;
    for (let i = 0; i < 5; i++) deco += `<circle cx="${cx - 16 + r() * 32}" cy="${cy - 7 + r() * 14}" r="0.9" fill="${C.coral}" opacity="0.8"/>`;
  } else if (terrain === "forest") {
    const trees: string[] = [];
    for (let i = 0; i < 5; i++) {
      const x = cx - 15 + i * 7.5 + (r() - 0.5) * 3, y = cy + 2 + (r() - 0.5) * 8;
      trees.push(r() < 0.5 ? cypress(x, y, 11 + r() * 4) : plane(x, y, 3.4 + r()));
    }
    deco += trees.join("");
  } else if (terrain === "hills") {
    deco += rock(cx - 8, cy + 6, 22, 11, "#d6b98a") + rock(cx + 9, cy + 7, 18, 9, "#ccae7c");
    deco += cypress(cx + 15, cy + 4, 8);
  } else if (terrain === "mountains") {
    deco += rock(cx, cy + 6, 30, 22, "#c9b0b6") + rock(cx - 11, cy + 8, 16, 11, C.lilac) + rock(cx + 12, cy + 8, 14, 10, "#b9a3ab");
    deco += `<path d="M${cx - 4},${cy - 13} q4,-3 8,0" fill="${C.white}" stroke="${INK}" stroke-width="0.4"/>`;
  }
  const defs = washDefs(id, variant * 7 + terrain.length, terrain === "sea" ? 0.05 : 0.09) +
    `<linearGradient id="sea${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.turq}"/><stop offset="1" stop-color="${C.cobalt}"/></linearGradient>
     <clipPath id="c${id}"><path d="${hexPath(cx, cy, S)}"/></clipPath>`;
  let walls = "";
  if (lift > 0) {
    // Earthen side walls, hatched.
    const pts = (yy: number) => [0, 1, 2, 3].map((i) => { const a = (Math.PI / 180) * (60 * i - 30); return [cx + S * Math.cos(a), yy + S * Math.sin(a) * HEX.SQUASH]; });
    const t = pts(cy), b = pts(cy + lift);
    walls = `<path d="M${t[0][0]},${t[0][1]} L${t[1][0]},${t[1][1]} L${t[2][0]},${t[2][1]} L${t[3][0]},${t[3][1]} L${b[3][0]},${b[3][1]} L${b[2][0]},${b[2][1]} L${b[1][0]},${b[1][1]} L${b[0][0]},${b[0][1]} Z" fill="${side[terrain]}" stroke="${INK}" stroke-width="0.5"/>`;
    for (let i = 0; i < 6; i++) { const x = t[1][0] + (t[3][0] - t[1][0]) * (i + 0.5) / 6; walls += `<line x1="${x}" y1="${cy + S * HEX.SQUASH - 1}" x2="${x - 1.5}" y2="${cy + S * HEX.SQUASH + lift - 1}" stroke="${INK}" stroke-width="0.35" opacity="0.4"/>`; }
  }
  const body = `${walls}
    <g clip-path="url(#c${id})">
      <path d="${hexPath(cx, cy, S)}" fill="${fill[terrain]}" filter="url(#w${id})"/>
      <rect x="0" y="0" width="${W}" height="${H}" filter="url(#g${id})"/>
      ${deco}
    </g>
    <path d="${hexPath(cx, cy, S - 0.3)}" fill="none" stroke="${INK}" stroke-opacity="${terrain === "sea" ? 0.12 : 0.28}" stroke-width="0.6"/>`;
  return { key: `t-${terrain}-${variant}`, svg: svg(W, H, body, defs), w: W, h: H, ox: cx / W, oy: cy / H };
}

// ---------------------------------------------------------------- buildings (al-Wasiti / Maqamat manner)
const B = { W: 48, H: 52 }; // sprite box; ground point at (24, 44)

/** Isometric block: front-left and front-right walls plus a top. */
function block(x: number, y: number, w: number, d: number, h: number, wallL: string, wallR: string, roof: string): string {
  const dx = d * 0.866, dy = d * 0.5;
  return `
  <path d="M${x},${y} L${x + w},${y} L${x + w},${y - h} L${x},${y - h}Z" fill="${wallL}" stroke="${INK}" stroke-width="0.6"/>
  <path d="M${x + w},${y} L${x + w + dx},${y - dy} L${x + w + dx},${y - dy - h} L${x + w},${y - h}Z" fill="${wallR}" stroke="${INK}" stroke-width="0.6"/>
  <path d="M${x},${y - h} L${x + w},${y - h} L${x + w + dx},${y - dy - h} L${x + dx},${y - dy - h}Z" fill="${roof}" stroke="${INK}" stroke-width="0.6"/>`;
}
/** Pointed (Abbasid) arch opening. */
const arch = (x: number, y: number, w: number, h: number, fill = "#3b2d22") =>
  `<path d="M${x},${y} L${x},${y - h * 0.55} Q${x},${y - h} ${x + w / 2},${y - h} Q${x + w},${y - h} ${x + w},${y - h * 0.55} L${x + w},${y}Z" fill="${fill}" stroke="${INK}" stroke-width="0.5"/>`;
/** Onion-ish dome with finial. */
const dome = (cx: number, by: number, r: number, fill: string) =>
  `<path d="M${cx - r},${by} C${cx - r},${by - r * 1.2} ${cx - r * 0.2},${by - r * 1.4} ${cx},${by - r * 1.75} C${cx + r * 0.2},${by - r * 1.4} ${cx + r},${by - r * 1.2} ${cx + r},${by}Z" fill="${fill}" stroke="${INK}" stroke-width="0.6"/>
   <path d="M${cx - r * 0.55},${by - r * 0.25} C${cx - r * 0.5},${by - r} ${cx - r * 0.1},${by - r * 1.25} ${cx},${by - r * 1.5}" fill="none" stroke="${C.white}" stroke-width="0.5" opacity="0.6"/>
   <line x1="${cx}" y1="${by - r * 1.75}" x2="${cx}" y2="${by - r * 2.2}" stroke="${C.gold}" stroke-width="0.8"/><circle cx="${cx}" cy="${by - r * 2.25}" r="0.9" fill="${C.goldL}"/>`;
/** Mashrabiya lattice window. */
const lattice = (x: number, y: number, w: number, h: number) => {
  let l = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.wood}" stroke="${INK}" stroke-width="0.4"/>`;
  for (let i = 1; i < 4; i++) l += `<line x1="${x + (w * i) / 4}" y1="${y}" x2="${x + (w * i) / 4}" y2="${y + h}" stroke="${C.goldL}" stroke-width="0.3"/>`;
  for (let i = 1; i < 4; i++) l += `<line x1="${x}" y1="${y + (h * i) / 4}" x2="${x + w}" y2="${y + (h * i) / 4}" stroke="${C.goldL}" stroke-width="0.3"/>`;
  return l;
};
/** Ablaq: alternating stone courses. */
const ablaq = (x: number, y: number, w: number, h: number, n = 4) => {
  let s = "";
  for (let i = 0; i < n; i++) s += `<rect x="${x}" y="${y - h + (h * i) / n}" width="${w}" height="${h / n}" fill="${i % 2 ? C.stone : "#d7b07a"}" opacity="0.9"/>`;
  return s;
};
const ground = `<ellipse cx="24" cy="45" rx="20" ry="6.2" fill="#c9b07a" stroke="${INK}" stroke-width="0.5" opacity="0.9"/>`;
const smoke = (x: number, y: number) => `<path d="M${x},${y} c-2,-3 2,-5 0,-8 c-2,-3 2,-5 0,-7" fill="none" stroke="#8c8478" stroke-width="1.2" opacity="0.55"/>`;
const tile = (x: number, y: number) => `<rect x="${x}" y="${y}" width="3" height="3" fill="${C.turq}" stroke="${C.cobalt}" stroke-width="0.3"/>`;

const BUILDING_ART: Record<string, string> = {
  farm: `${ground}
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M${6 + i * 3},${46 - i * 1.4} q14,-6 28,0" fill="none" stroke="#7c8f3e" stroke-width="1.3"/>`).join("")}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${10 + i * 4},${40 - i} l0,-6 m-1,1 l1,-2 l1,2" stroke="#b9902c" stroke-width="0.8" fill="none"/>`).join("")}
    <circle cx="36" cy="30" r="7" fill="none" stroke="${C.wood}" stroke-width="1.4"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => { const a = i * Math.PI / 3; return `<line x1="36" y1="30" x2="${36 + Math.cos(a) * 7}" y2="${30 + Math.sin(a) * 7}" stroke="${C.wood}" stroke-width="0.7"/><rect x="${35 + Math.cos(a) * 7}" y="${29 + Math.sin(a) * 7}" width="2" height="2" fill="${C.cobalt}"/>`; }).join("")}
    <path d="M30,40 q6,3 12,0" fill="none" stroke="${C.cobalt}" stroke-width="1.5"/>`,
  pasture: `${ground}
    <path d="M6,42 L42,42 M6,38 L42,38" stroke="${C.wood}" stroke-width="0.9"/>
    ${[6, 15, 24, 33, 42].map((x) => `<line x1="${x}" y1="36" x2="${x}" y2="44" stroke="${C.wood}" stroke-width="1"/>`).join("")}
    ${[[14, 35], [24, 33], [32, 36]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4.2" ry="2.8" fill="${C.white}" stroke="${INK}" stroke-width="0.5"/><circle cx="${x + 4}" cy="${y - 1.2}" r="1.4" fill="${INK}"/><line x1="${x - 2}" y1="${y + 2.5}" x2="${x - 2}" y2="${y + 4}" stroke="${INK}" stroke-width="0.6"/><line x1="${x + 2}" y1="${y + 2.5}" x2="${x + 2}" y2="${y + 4}" stroke="${INK}" stroke-width="0.6"/>`).join("")}
    ${block(30, 30, 10, 6, 8, C.stone, C.stoneD, C.coral)}`,
  lumber: `${ground}
    ${[0, 1, 2].map((i) => `<rect x="${10 + i * 2}" y="${36 - i * 4}" width="${22 - i * 4}" height="4" rx="2" fill="${C.wood}" stroke="${INK}" stroke-width="0.5"/><circle cx="${10 + i * 2}" cy="${38 - i * 4}" r="2" fill="#d7b48a" stroke="${INK}" stroke-width="0.4"/>`).join("")}
    ${cypress(37, 40, 15)}
    <path d="M30,26 l6,-6 m-1,-1 l3,3" stroke="${INK}" stroke-width="1"/>`,
  mine: `${ground}
    ${rock(24, 44, 40, 26, C.lilac)}
    <path d="M17,44 L17,32 Q24,24 31,32 L31,44Z" fill="#2b221b" stroke="${INK}" stroke-width="0.7"/>
    <path d="M15,44 L15,31 L33,31 L33,44 M14,31 L34,31" fill="none" stroke="${C.wood}" stroke-width="1.6"/>
    <rect x="27" y="40" width="7" height="4" fill="${C.wood}" stroke="${INK}" stroke-width="0.4"/><circle cx="30.5" cy="39.5" r="1.5" fill="#6e7f8c"/>`,
  bakery: `${ground}
    ${block(8, 43, 22, 10, 13, C.stone, C.stoneD, C.sand)}
    ${dome(19, 30, 6, "#e3c08a")}
    ${arch(13, 43, 6, 9, "#e2702e")}
    <circle cx="16" cy="40" r="1.6" fill="${C.goldL}" opacity="0.9"/>
    ${smoke(30, 26)}`,
  weaver: `${ground}
    ${block(8, 43, 24, 10, 15, C.stone, C.stoneD, C.coral)}
    ${arch(11, 43, 6, 11)}${arch(21, 43, 6, 11)}
    <rect x="11" y="33" width="16" height="0.8" fill="${C.wood}"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${12 + i * 2.4}" y1="33" x2="${12 + i * 2.4}" y2="42" stroke="${[C.coral, C.cobalt, C.gold, C.turq][i % 4]}" stroke-width="0.6"/>`).join("")}
    <rect x="34" y="24" width="7" height="12" fill="${C.cobalt}" stroke="${INK}" stroke-width="0.4"/><rect x="34" y="24" width="7" height="3" fill="${C.coral}"/>`,
  smithy: `${ground}
    ${block(8, 43, 22, 10, 13, "#cdb48c", "#b0956c", "#8c7b68")}
    ${arch(12, 43, 8, 10, "#3a1f14")}
    <circle cx="16" cy="39" r="2.6" fill="#f0782a" opacity="0.9"/><circle cx="16" cy="39" r="1.3" fill="${C.goldL}"/>
    <rect x="32" y="38" width="7" height="3" fill="#555" stroke="${INK}" stroke-width="0.4"/><rect x="34" y="41" width="3" height="3" fill="#555"/>
    <rect x="25" y="18" width="3" height="9" fill="${C.brick}" stroke="${INK}" stroke-width="0.4"/>${smoke(26.5, 17)}`,
  builder: `${ground}
    ${ablaq(10, 43, 18, 14)}
    <path d="M10,43 L10,29 L28,29 L28,43" fill="none" stroke="${INK}" stroke-width="0.6"/>
    ${arch(15, 43, 8, 11, "#c9b07a")}
    <path d="M30,44 L30,20 M38,44 L38,20 M29,28 L39,28 M29,36 L39,36 M30,44 L38,36 M30,36 L38,28" stroke="${C.wood}" stroke-width="0.9"/>
    <rect x="31" y="17" width="2" height="4" fill="${C.wood}"/><line x1="32" y1="17" x2="22" y2="15" stroke="${INK}" stroke-width="0.5"/>`,
  pinworks: `${ground}
    ${block(7, 44, 26, 10, 24, C.stone, C.stoneD, C.turq)}
    ${ablaq(7, 44, 26, 6, 2)}
    ${arch(10, 37, 5, 8)}${arch(17.5, 37, 5, 8)}${arch(25, 37, 5, 8)}
    ${lattice(10, 22, 5, 6)}${lattice(17.5, 22, 5, 6)}${lattice(25, 22, 5, 6)}
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => tile(7 + i * 3.25, 18.5)).join("")}
    <line x1="40" y1="30" x2="40" y2="20" stroke="${C.gold}" stroke-width="0.8"/><circle cx="40" cy="19.5" r="1.3" fill="${C.goldL}" stroke="${INK}" stroke-width="0.3"/>`,
  port: `<path d="M2,46 Q24,50 46,46 L46,52 L2,52Z" fill="${C.cobalt}" opacity="0.75"/>
    <rect x="6" y="38" width="30" height="5" fill="${C.wood}" stroke="${INK}" stroke-width="0.5"/>
    ${[8, 16, 24, 32].map((x) => `<line x1="${x}" y1="43" x2="${x}" y2="48" stroke="${C.wood}" stroke-width="1"/>`).join("")}
    ${block(32, 40, 7, 6, 18, C.stone, C.stoneD, C.stone)}
    <rect x="33" y="17" width="9" height="5" fill="${C.goldL}" stroke="${INK}" stroke-width="0.4"/>${dome(37.5, 17, 3.2, C.turq)}
    <path d="M12,37 L26,37 L23,34 L15,34Z" fill="${C.wood}" stroke="${INK}" stroke-width="0.5"/>
    <path d="M19,34 L19,18 L28,31 Z" fill="${C.white}" stroke="${INK}" stroke-width="0.5"/>`,
  courthouse: `${ground}
    ${block(6, 44, 28, 10, 17, C.stone, C.stoneD, C.stone)}
    <path d="M13,44 L13,33 Q20,22 27,33 L27,44Z" fill="${C.cobalt}" stroke="${INK}" stroke-width="0.6"/>
    <path d="M15,44 L15,34 Q20,26 25,34 L25,44Z" fill="#3b2d22"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => tile(6 + i * 3.1, 26)).join("")}
    ${dome(29, 26, 6.5, C.turq)}
    <path d="M18,22 l4,0 m-2,0 l0,-4 m-3,1 l6,0 m-6,0 l-1,2.5 l2,0 z m6,0 l-1,2.5 l2,0z" stroke="${C.gold}" stroke-width="0.6" fill="${C.goldL}"/>`,
  school: `${ground}
    ${block(6, 44, 28, 10, 15, C.stone, C.stoneD, C.sand)}
    ${arch(9, 44, 6, 10)}${arch(17, 44, 6, 10)}${arch(25, 44, 6, 10)}
    <rect x="36" y="14" width="5" height="22" fill="${C.stone}" stroke="${INK}" stroke-width="0.6"/>
    <rect x="35" y="20" width="7" height="2" fill="${C.turq}"/>${dome(38.5, 14, 3, C.turq)}
    <rect x="11" y="27" width="8" height="5" fill="${C.white}" stroke="${INK}" stroke-width="0.4"/><line x1="15" y1="27" x2="15" y2="32" stroke="${INK}" stroke-width="0.4"/>`,
  granary: `${ground}
    ${[[12, 44, 7], [24, 42, 8.5], [36, 44, 7]].map(([x, y, r]) => `<rect x="${x - r}" y="${y - r * 0.9}" width="${r * 2}" height="${r * 0.9}" fill="${C.stone}" stroke="${INK}" stroke-width="0.5"/>${dome(x, y - r * 0.9, r, "#dfc58f")}`).join("")}`,
};

export function buildingSprite(type: string): SpriteDef {
  const defs = washDefs(`b${type}`, type.length * 11, 0.15, 0.22);
  const body = `<g filter="url(#wb${type})">${BUILDING_ART[type] ?? ""}</g>`;
  return { key: `b-${type}`, svg: svg(B.W, B.H, body, defs), w: B.W, h: B.H, ox: 24 / B.W, oy: 45 / B.H };
}

// ---------------------------------------------------------------- towns: houses, domes, a suq
export function townSprite(size: number): SpriteDef {
  const W = 64, H = 60;
  const r = rnd(size * 31 + 7);
  const n = 3 + size * 2;
  let houses = "";
  const spots: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4, d = 8 + r() * (6 + size * 2);
    spots.push([32 + Math.cos(a) * d, 46 + Math.sin(a) * d * 0.45]);
  }
  spots.sort((p, q) => p[1] - q[1]);
  for (const [x, y] of spots) {
    const w = 7 + r() * 3, h = 5 + r() * 5;
    houses += block(x - w / 2, y, w, 4, h, C.stone, C.stoneD, r() < 0.35 ? C.coral : "#e6d4a8");
    if (r() < 0.4) houses += lattice(x - w / 2 + 1.5, y - h + 1.5, 2.5, 3);
    else houses += `<rect x="${x - 1}" y="${y - 3.5}" width="2" height="3.5" fill="#3b2d22"/>`;
  }
  // Congregational dome and minaret-like tower, and a market awning.
  const monument = `${block(24, 47, 16, 7, 10, C.stone, C.stoneD, C.stone)}${dome(32, 37, 6 + size * 0.6, size >= 3 ? C.turq : C.goldL)}
    <rect x="${43}" y="${22 - size * 2}" width="3.5" height="${25 + size * 2}" fill="${C.stone}" stroke="${INK}" stroke-width="0.5"/>
    <rect x="42.3" y="${30 - size}" width="5" height="1.6" fill="${C.turq}"/>${dome(44.75, 22 - size * 2, 2.2, C.turq)}
    <path d="M14,50 L26,50 L24,46 L16,46Z" fill="${C.coral}" stroke="${INK}" stroke-width="0.4"/><path d="M16,46 l2,4 m2,-4 l2,4 m2,-4 l1,4" stroke="${C.white}" stroke-width="0.6"/>`;
  const body = `<ellipse cx="32" cy="48" rx="${22 + size * 3}" ry="${8 + size}" fill="#cdb98a" stroke="${INK}" stroke-width="0.4" opacity="0.85"/>${houses}${monument}`;
  return { key: `town-${size}`, svg: svg(W, H, `<g filter="url(#wt${size})">${body}</g>`, washDefs(`t${size}`, size * 5, 0.12, 0.2)), w: W, h: H, ox: 0.5, oy: 48 / H };
}

// ---------------------------------------------------------------- workers (two animation frames)
export const ROLE_HUES = [C.coral, C.cobalt, C.gold, C.turq, "#8a5aa8"];
export function workerSprite(role: number, frame: number): SpriteDef {
  const W = 8, H = 13;
  const col = ROLE_HUES[role % ROLE_HUES.length];
  const arm = frame === 0 ? "M2.2,6.5 L0.8,4.2" : "M2.2,6.5 L1,8.8";
  const arm2 = frame === 0 ? "M5.8,6.5 L7.2,8.6" : "M5.8,6.5 L7.4,4.4";
  const body = `
    <path d="M2,12.5 L2.6,8 L5.4,8 L6,12.5Z" fill="${col}" stroke="${INK}" stroke-width="0.4"/>
    <path d="M2.3,9 L2.6,5.5 Q4,4.8 5.4,5.5 L5.7,9Z" fill="${C.white}" stroke="${INK}" stroke-width="0.4"/>
    <path d="${arm} M${arm2.slice(1)}" stroke="${INK}" stroke-width="0.7" stroke-linecap="round"/>
    <circle cx="4" cy="3.6" r="1.5" fill="#c8946a" stroke="${INK}" stroke-width="0.35"/>
    <path d="M2.4,3 Q4,0.6 5.6,3 Q4,2.2 2.4,3Z" fill="${col}" stroke="${INK}" stroke-width="0.35"/>`;
  return { key: `w-${role}-${frame}`, svg: svg(W, H, body), w: W, h: H, ox: 0.5, oy: 1 };
}

// ---------------------------------------------------------------- vehicles
export function vehicleSprite(kind: "cart" | "ship" | "barge" | "camel"): SpriteDef {
  if (kind === "ship") {
    // A dhow: lateen sail, curved hull.
    const body = `<path d="M2,14 Q12,19 22,13 L20,16 Q12,20 4,16Z" fill="${C.wood}" stroke="${INK}" stroke-width="0.6"/>
      <line x1="12" y1="15" x2="10" y2="2" stroke="${INK}" stroke-width="0.7"/>
      <path d="M10,2 Q19,8 18,14 L6,14 Q9,8 10,2Z" fill="${C.white}" stroke="${INK}" stroke-width="0.5"/>
      <path d="M10,5 Q15,9 15,13" fill="none" stroke="${C.coral}" stroke-width="0.6"/>`;
    return { key: "v-ship", svg: svg(24, 20, body), w: 24, h: 20, ox: 0.5, oy: 0.85 };
  }
  if (kind === "barge") {
    const body = `<path d="M1,8 L19,8 L17,11 L3,11Z" fill="${C.wood}" stroke="${INK}" stroke-width="0.5"/><rect x="5" y="4" width="10" height="4" fill="${C.sand}" stroke="${INK}" stroke-width="0.4"/>`;
    return { key: "v-barge", svg: svg(20, 12, body), w: 20, h: 12, ox: 0.5, oy: 0.8 };
  }
  if (kind === "camel") {
    const body = `<path d="M3,9 Q5,3 9,6 Q11,2 14,6 L16,5 L17,3 L18,4 L17,8 L15,9 Z" fill="#c79a5c" stroke="${INK}" stroke-width="0.5"/>
      ${[5, 7, 12, 14].map((x) => `<line x1="${x}" y1="9" x2="${x}" y2="13" stroke="${INK}" stroke-width="0.6"/>`).join("")}
      <rect x="7" y="2.5" width="5" height="3" fill="${C.coral}" stroke="${INK}" stroke-width="0.4"/>`;
    return { key: "v-camel", svg: svg(20, 14, body), w: 20, h: 14, ox: 0.5, oy: 0.9 };
  }
  // Ox cart.
  const body = `<rect x="7" y="4" width="10" height="5" fill="${C.wood}" stroke="${INK}" stroke-width="0.5"/>
    <circle cx="12" cy="10" r="2.6" fill="none" stroke="${INK}" stroke-width="0.8"/><line x1="12" y1="7.4" x2="12" y2="12.6" stroke="${INK}" stroke-width="0.4"/>
    <path d="M1,8 Q1,4 4,4 L6,4 L6,8 Z" fill="#8c6a4a" stroke="${INK}" stroke-width="0.5"/><line x1="6" y1="6" x2="8" y2="6" stroke="${INK}" stroke-width="0.6"/>
    <line x1="2" y1="8" x2="2" y2="11" stroke="${INK}" stroke-width="0.6"/><line x1="5" y1="8" x2="5" y2="11" stroke="${INK}" stroke-width="0.6"/>`;
  return { key: "v-cart", svg: svg(18, 13, body), w: 18, h: 13, ox: 0.5, oy: 0.9 };
}

/** Everything the map needs. */
export function allSprites(): SpriteDef[] {
  const out: SpriteDef[] = [];
  for (const t of ["sea", "plains", "fertile", "forest", "hills", "mountains"]) for (let v = 0; v < 3; v++) out.push(terrainSprite(t, v));
  for (const b of Object.keys(BUILDING_ART)) out.push(buildingSprite(b));
  for (let s = 1; s <= 5; s++) out.push(townSprite(s));
  for (let r = 0; r < 5; r++) for (let f = 0; f < 2; f++) out.push(workerSprite(r, f));
  for (const v of ["cart", "ship", "barge", "camel"] as const) out.push(vehicleSprite(v));
  return out;
}

export const svgDataUrl = (s: string) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(s)))}`;
