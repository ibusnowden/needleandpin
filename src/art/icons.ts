// Goods and tool icons for inventory slots, in the same inked-miniature style as the map sprites.
// 32×32 viewBox, drawn as SVG and used as <img> data URLs in the UI.
const INK = "#2a2018";

const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64">${body}</svg>`;

const ICONS: Record<string, string> = {
  grain: `${[0, 1, 2].map((i) => `<path d="M${10 + i * 6},29 L${12 + i * 5},8" stroke="#8a6a1e" stroke-width="1.4"/>
    ${[0, 1, 2, 3].map((k) => `<ellipse cx="${11.6 + i * 5 + k * 0.1}" cy="${10 + k * 3.6}" rx="2" ry="3" fill="#e0b440" stroke="${INK}" stroke-width="0.6" transform="rotate(${k % 2 ? 25 : -25} ${11.6 + i * 5} ${10 + k * 3.6})"/>`).join("")}`).join("")}`,
  wool: `<circle cx="12" cy="17" r="7" fill="#f6f0e2" stroke="${INK}" stroke-width="0.9"/><circle cx="20" cy="15" r="7" fill="#fbf7ee" stroke="${INK}" stroke-width="0.9"/><circle cx="17" cy="21" r="6" fill="#efe7d4" stroke="${INK}" stroke-width="0.9"/>
    <path d="M9,16 q3,-3 6,0 M16,13 q3,-3 6,0 M14,21 q3,-3 6,0" fill="none" stroke="#b8a888" stroke-width="0.8"/>`,
  timber: `${[0, 1, 2].map((i) => `<rect x="${4 + i * 1.5}" y="${8 + i * 6}" width="${24 - i * 3}" height="6" rx="3" fill="#9a6b3a" stroke="${INK}" stroke-width="0.8"/><ellipse cx="${4 + i * 1.5}" cy="${11 + i * 6}" rx="2.6" ry="3" fill="#e2c094" stroke="${INK}" stroke-width="0.7"/><circle cx="${4 + i * 1.5}" cy="${11 + i * 6}" r="1" fill="none" stroke="#9a6b3a" stroke-width="0.5"/>`).join("")}`,
  ore: `<path d="M5,24 L9,12 L17,7 L26,12 L28,22 L19,27 Z" fill="#6e7f8c" stroke="${INK}" stroke-width="1"/>
    <path d="M9,12 L15,17 L17,7 M15,17 L19,27 M15,17 L26,12" fill="none" stroke="${INK}" stroke-width="0.6" opacity="0.7"/>
    <circle cx="20" cy="15" r="1.6" fill="#c8553d"/><circle cx="11" cy="20" r="1.2" fill="#c8553d"/>`,
  bread: `<path d="M4,20 C4,10 28,10 28,20 C28,24 4,24 4,20Z" fill="#c98a3c" stroke="${INK}" stroke-width="1"/>
    <path d="M10,13 q2,4 0,8 M16,12 q2,5 0,9 M22,13 q2,4 0,8" fill="none" stroke="#f3d79a" stroke-width="1.2"/>`,
  cloth: `<path d="M5,8 L23,6 L27,24 L9,26 Z" fill="#8a5aa8" stroke="${INK}" stroke-width="1"/>
    <path d="M7,13 L25,11 M8,18 L26,16 M8.5,22 L26.5,20" stroke="#c8a8de" stroke-width="0.9"/>
    <path d="M12,7.5 L14,25.5 M18,7 L20,25" stroke="#e8c766" stroke-width="0.7"/>`,
  tools: `<path d="M8,26 L18,16" stroke="#8a5a34" stroke-width="3" stroke-linecap="round"/>
    <path d="M14,8 L24,6 L26,12 L20,13 L17,16 L14,13 Z" fill="#7d8a94" stroke="${INK}" stroke-width="1"/>
    <path d="M22,26 L12,16" stroke="#8a5a34" stroke-width="2.4" stroke-linecap="round"/><rect x="5" y="8" width="7" height="5" rx="1" transform="rotate(-45 8.5 10.5)" fill="#9aa6ae" stroke="${INK}" stroke-width="0.9"/>`,
  housing: `<path d="M5,15 L16,6 L27,15" fill="#c8553d" stroke="${INK}" stroke-width="1"/><rect x="7" y="15" width="18" height="12" fill="#ece0bf" stroke="${INK}" stroke-width="1"/>
    <path d="M14,27 L14,21 Q16,18 18,21 L18,27" fill="#3b2d22"/><rect x="9.5" y="17.5" width="3" height="3" fill="#4fa3a5" stroke="${INK}" stroke-width="0.5"/><rect x="20" y="17.5" width="3" height="3" fill="#4fa3a5" stroke="${INK}" stroke-width="0.5"/>`,
  pins: `${[0, 1, 2, 3].map((i) => `<line x1="${7 + i * 5}" y1="27" x2="${10 + i * 5}" y2="7" stroke="#c9ccd8" stroke-width="1.4"/><line x1="${7 + i * 5}" y1="27" x2="${10 + i * 5}" y2="7" stroke="${INK}" stroke-width="0.3"/><circle cx="${10 + i * 5}" cy="7" r="1.8" fill="#e8c766" stroke="${INK}" stroke-width="0.6"/>`).join("")}`,
  spices: `<path d="M6,26 Q4,16 10,12 L22,12 Q28,16 26,26 Z" fill="#b5694a" stroke="${INK}" stroke-width="1"/>
    <path d="M10,12 L11,8 L21,8 L22,12" fill="#d9a26a" stroke="${INK}" stroke-width="0.8"/><path d="M8,20 q8,-4 16,0" fill="none" stroke="#e8c766" stroke-width="1"/>
    ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${11 + i * 2.5}" cy="${7 - (i % 2)}" r="1.1" fill="${["#c8553d", "#e0b440", "#7d9a5c"][i % 3]}"/>`).join("")}`,
};

/** A geometric eight-pointed star (khatam) used for slot corners and frames. */
export const KHATAM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 0 12.9 7.1 20 10 12.9 12.9 10 20 7.1 12.9 0 10 7.1 7.1Z" fill="#c89b2c"/><rect x="5" y="5" width="10" height="10" fill="none" stroke="#c89b2c" stroke-width="1" transform="rotate(45 10 10)"/></svg>`;

const cache = new Map<string, string>();
export function iconUrl(id: string): string {
  let u = cache.get(id);
  if (!u) {
    u = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(wrap(ICONS[id] ?? ""))))}`;
    cache.set(id, u);
  }
  return u;
}
