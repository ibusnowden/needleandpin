// One consistent line-icon set for the interface chrome (24×24, stroke = currentColor), replacing emoji, which render
// differently on every platform and clash with the illustrated art. Goods icons live in src/art/icons.ts.
const P: Record<string, string> = {
  inspect: "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M14.5 14.5 20 20",
  none: "M12 3l8 4.5v9L12 21l-8-4.5v-9z",
  traffic: "M4 20 9.5 4 M20 20 14.5 4 M12 5v2.5 M12 10.5v3 M12 16.5v3",
  reach: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  prices: "M3 12.5 12 3.5h8.5V12l-9 9z M16 7.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z",
  wages: "M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z M5 7v4.5c0 1.7 3.1 3 7 3s7-1.3 7-3V7 M5 11.5V16c0 1.7 3.1 3 7 3s7-1.3 7-3v-4.5",
  mood: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 10v.5 M15 10v.5 M8 14.5c2.2 2.4 5.8 2.4 8 0",
  budget: "M12 4v16 M7.5 20h9 M4 7.5h16 M4 7.5 1.5 13h5z M20 7.5 17.5 13h5z",
  tax: "M6 3h9l4 4v14H6z M15 3v4h4 M9 11.5h7 M9 15.5h7",
  laws: "M8 4h10.5A2.5 2.5 0 0 1 21 6.5H10.5 M8 4a2.5 2.5 0 0 0-2.5 2.5v11A2.5 2.5 0 0 0 8 20h10a2.5 2.5 0 0 0 2.5-2.5V9 M10 11h8 M10 15h6",
  institutions: "M3 9l9-5 9 5z M5.5 9v9 M10 9v9 M14 9v9 M18.5 9v9 M3 20.5h18",
  stats: "M4 20V4 M4 20h16 M7 15l4-5 3 3 5-7",
  codex: "M12 6.5C10 5 7 4.5 4 5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z M12 6.5v14",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  road: "M5 21 10 3 M19 21 14 3 M12 6v2 M12 11v2 M12 16v2",
  canal: "M3 9c3-2 6 2 9 0s6-2 9 0 M3 15c3-2 6 2 9 0s6-2 9 0",
  rail: "M8.5 3 6 21 M15.5 3 18 21 M7.8 7.5h8.4 M7.2 12h9.6 M6.6 16.5h10.8",
  town: "M3 20v-9l5-4 5 4v9 M13 20v-6l4-3 4 3v6 M2 20.5h20 M7 20v-4h2v4",
  demolish: "M5 5l14 14 M19 5 5 19",
  skip: "M4 5l7 7-7 7z M12 5l7 7-7 7z M21 5v14",
  close: "M6 6l12 12 M18 6 6 18",
  starved: "M12 3 22 20H2z M12 9.5v5 M12 17v.5",
  blocked: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M5.6 5.6l12.8 12.8",
  jam: "M3 12h18 M6 8.5h3v7H6z M10.5 8.5h3v7h-3z M15 8.5h3v7h-3z",
  short: "M4 15c0-5 16-5 16 0 0 2.5-16 2.5-16 0z M8.5 12.5l1 2 M12 12v2.2 M15.5 12.5l-1 2 M3 4l18 17",
  ok: "M5 12.5l4.5 4.5L19 7",
  pause: "M8 5v14 M16 5v14",
  play: "M7 5l12 7-12 7z",
  play2: "M4 5l8 7-8 7z M12 5l8 7-8 7z",
  play4: "M3 6l6 6-6 6z M9 6l6 6-6 6z M15 6l6 6-6 6z",
  alt: "M4 6h16v12H4z M8 14l2.5-5 2.5 5 M8.7 12.6h3.6 M15.5 9v5",
  zoomIn: "M10.5 4.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M15 15l5 5 M10.5 8v5 M8 10.5h5",
  zoomOut: "M10.5 4.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M15 15l5 5 M8 10.5h5",
  fit: "M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5",
};

const FILLED = new Set(["play", "play2", "play4", "skip"]);

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false"
      fill={FILLED.has(name) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name]} />
    </svg>
  );
}
