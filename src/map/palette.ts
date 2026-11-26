// "Living ledger" palette (§11): parchment, ink, gold leaf. Map state colours are paired with
// icons everywhere (▲ ▼ ! ✕ ↑), so nothing relies on colour alone (§11 accessibility).
const shade = (c: number, f: number) => {
  const r = Math.round(((c >> 16) & 255) * f), g = Math.round(((c >> 8) & 255) * f), b = Math.round((c & 255) * f);
  return (r << 16) | (g << 8) | b;
};

export const PALETTE = {
  paper: 0xf4ecd6,
  paperDark: 0xd9c9a3,
  ink: 0x2a2018,
  gold: 0xc89b2c,
  river: 0x4f7aa0,
  road: 0x8a6a42,
  canal: 0x3f6f9a,
  rail: 0x3a3a3a,
  roof: 0xa8503a,
  wall: 0xefe2c0,
  wheat: 0xd9b04a,
  wood: 0x9a6b3a,
  ore: 0x6e7f8c,
  snow: 0xf0ece2,
  forestDark: 0x4f6b3a,
  smoke: 0x8c8478,
  muted: 0x7a7266,
  // Okabe–Ito-derived, colourblind-safe states.
  good: 0x009e73,
  warn: 0xe69f00,
  bad: 0xd55e00,
  cool: 0x0072b2,
  terrain: {
    sea: 0x8aa6b5,
    plains: 0xe6d6a8,
    fertile: 0xcdd394,
    forest: 0x9fb37c,
    hills: 0xc9ad7c,
    mountains: 0xa89886,
  } as Record<string, number>,
  goods: {
    grain: 0xd9b04a, wool: 0xf4f0e8, timber: 0x9a6b3a, ore: 0x6e7f8c, bread: 0xc58a3c,
    cloth: 0x8a5aa8, tools: 0x555555, housing: 0xa0522d, pins: 0xc9c9d8, spices: 0xc0392b,
  } as Record<string, number>,
  shade,
};

/** Five specialist roles: each specialisation level adds a visibly different kind of worker. */
export const ROLE_COLORS = [0x2a2018, 0x0072b2, 0xd55e00, 0x009e73, 0xcc79a7];
