// Small SVG line chart (§12: D3 for the ghost line, meters and counterfactual replays).
import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { fmt } from "../i18n/index.ts";

export interface Series { id: string; label: string; points: [number, number][]; color: string; dashed?: boolean; band?: [number, number, number][] }

export function LineChart({ series, width = 320, height = 150, yLabel, compact }: { series: Series[]; width?: number; height?: number; yLabel?: string; compact?: boolean }) {
  const all = series.flatMap((s) => [...s.points, ...(s.band?.flatMap((b) => [[b[0], b[1]], [b[0], b[2]]] as [number, number][]) ?? [])]);
  if (!all.length) return null;
  const pad = compact ? { l: 38, r: 14, t: 8, b: 18 } : { l: 48, r: 16, t: 10, b: 22 };
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const x = scaleLinear().domain([xMin, xMax === xMin ? xMin + 1 : xMax]).range([pad.l, width - pad.r]);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const y = scaleLinear().domain([yMin - (yMax - yMin) * 0.08, yMax + (yMax - yMin) * 0.08 || 1]).nice().range([height - pad.b, pad.t]);
  const mk = line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]));
  const band = area<[number, number, number]>().x((d) => x(d[0])).y0((d) => y(d[1])).y1((d) => y(d[2]));
  const yt = y.ticks(compact ? 3 : 4);
  const xt = compact ? [xMin, Math.round((xMin + xMax) / 2), xMax].filter((v, i, a) => a.indexOf(v) === i) : x.ticks(5);
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={series.map((s) => s.label).join(", ")}>
      {yt.map((t) => (
        <g key={`y${t}`}>
          <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={pad.l - 4} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{fmt(t, t < 10 && t % 1 ? 1 : 0)}</text>
        </g>
      ))}
      {xt.map((t, i) => (
        <text key={`x${t}`} x={x(t)} y={height - 4} className="tick"
          textAnchor={compact && i === 0 ? "start" : compact && i === xt.length - 1 ? "end" : "middle"}>
          {Math.round(t)}
        </text>
      ))}
      {series.map((s) => s.band && <path key={`b${s.id}`} d={band(s.band) ?? ""} fill={s.color} opacity={0.15} />)}
      {series.map((s) => {
        const last = s.points[s.points.length - 1];
        return (
          <g key={s.id}>
            <path d={mk(s.points) ?? ""} fill="none" stroke={s.color} strokeWidth={compact ? 1.8 : 2.1} strokeDasharray={s.dashed ? "5 4" : undefined} />
            {!s.dashed && last && <circle cx={x(last[0])} cy={y(last[1])} r={compact ? 2.4 : 3} fill={s.color} stroke="#1b1815" strokeWidth={0.8} />}
          </g>
        );
      })}
      {yLabel && !compact && <text x={pad.l} y={pad.t - 1} className="tick" dominantBaseline="hanging">{yLabel}</text>}
    </svg>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.id}><svg width="18" height="6"><line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "4 3" : undefined} /></svg>{s.label}</span>
      ))}
    </div>
  );
}
