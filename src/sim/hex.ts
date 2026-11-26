// Axial hex coordinates (pointy-top). Key format "q,r".

export interface Hex {
  q: number;
  r: number;
}

export const DIRS: readonly Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export const key = (h: Hex): string => `${h.q},${h.r}`;
export const parseKey = (k: string): Hex => {
  const [q, r] = k.split(",").map(Number);
  return { q, r };
};
export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const neighbors = (h: Hex): Hex[] => DIRS.map((d) => add(h, d));
export const distance = (a: Hex, b: Hex): number =>
  (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;

export function hexesInRadius(radius: number, center: Hex = { q: 0, r: 0 }): Hex[] {
  const out: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) out.push({ q: center.q + q, r: center.r + r });
  }
  return out;
}

/** Pixel centre of a hex for a pointy-top layout of the given size (flat, before iso squash). */
export function toPixel(h: Hex, size: number): { x: number; y: number } {
  return { x: size * Math.sqrt(3) * (h.q + h.r / 2), y: size * 1.5 * h.r };
}

export function fromPixel(x: number, y: number, size: number): Hex {
  const q = ((Math.sqrt(3) / 3) * x - y / 3) / size;
  const r = ((2 / 3) * y) / size;
  return roundHex(q, r);
}

function roundHex(qf: number, rf: number): Hex {
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}
