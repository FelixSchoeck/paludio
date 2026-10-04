import { useMemo, useState } from 'react';

export interface Series {
  name: string;
  color: string;
  data: (number | null)[];
  dashed?: boolean;
  area?: boolean;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    max = min + 1;
  }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) out.push(Math.round(v / step) * step);
  return out;
}

const W = 680;

export function LineChart({
  labels, series, height = 240, yFormat = (v) => String(Math.round(v)), band, invertY = false, xTickEvery = 0, zeroLine = false, unit = '',
}: {
  labels: string[];
  series: Series[];
  height?: number;
  yFormat?: (v: number) => string;
  band?: { lo: number; hi: number; color: string; label?: string };
  invertY?: boolean;
  xTickEvery?: number;
  zeroLine?: boolean;
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 54, r: 12, t: 12, b: 28 };
  const n = labels.length;
  const { ticks, y, x } = useMemo(() => {
    const vals: number[] = [];
    series.forEach((s) => s.data.forEach((v) => v != null && vals.push(v)));
    if (band) vals.push(band.lo, band.hi);
    if (zeroLine) vals.push(0);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (!isFinite(min)) {
      min = 0;
      max = 1;
    }
    const ticks = niceTicks(min, max);
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const ih = height - pad.t - pad.b;
    const y = (v: number) => (invertY ? pad.t + ((v - lo) / (hi - lo)) * ih : pad.t + ih - ((v - lo) / (hi - lo)) * ih);
    const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
    return { ticks, y, x };
  }, [series, band, height, invertY, n, zeroLine]);

  const every = xTickEvery || Math.max(1, Math.ceil(n / 8));

  const path = (s: Series) => {
    let d = '';
    let pen = false;
    s.data.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  return (
    <div className="chart">
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
        ))}
        {band && <span><i style={{ background: band.color, opacity: 0.4 }} />{band.label ?? 'Zielkorridor'}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
          setHover(i < 0 || i >= n ? null : i);
        }}>
        {band && (
          <rect x={pad.l} width={W - pad.l - pad.r} y={Math.min(y(band.lo), y(band.hi))} height={Math.abs(y(band.lo) - y(band.hi))} fill={band.color} opacity={0.18} />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e4ddcf" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#7a6f60">{yFormat(t)}</text>
          </g>
        ))}
        {zeroLine && <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#9a8d78" strokeWidth={1.2} />}
        {labels.map((l, i) => (i % every === 0 ? (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="#7a6f60">{l}</text>
        ) : null))}
        {series.map((s) => (
          <g key={s.name}>
            {s.area && (
              <path d={`${path(s)}L${x(n - 1)},${y(0 > ticks[0] ? 0 : ticks[0])}L${x(0)},${y(0 > ticks[0] ? 0 : ticks[0])}Z`} fill={s.color} opacity={0.12} />
            )}
            <path d={path(s)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '6 4' : undefined} strokeLinejoin="round" />
          </g>
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="#3b3226" strokeDasharray="3 3" />
            {series.map((s) => s.data[hover] != null && <circle key={s.name} cx={x(hover)} cy={y(s.data[hover] as number)} r={4} fill={s.color} stroke="#fff" strokeWidth={1.5} />)}
            {(() => {
              const bx = x(hover) > W * 0.62 ? x(hover) - 170 : x(hover) + 10;
              return (
                <g transform={`translate(${bx},${pad.t + 4})`}>
                  <rect width={160} height={20 + series.length * 16} rx={6} fill="#2b2118" opacity={0.92} />
                  <text x={8} y={15} fontSize={11} fill="#f5f2ea" fontWeight={600}>{labels[hover]}</text>
                  {series.map((s, k) => (
                    <text key={s.name} x={8} y={31 + k * 16} fontSize={11} fill="#f5f2ea">
                      <tspan fill={s.color}>● </tspan>{s.name}: {s.data[hover] != null ? yFormat(s.data[hover] as number) : '–'}{unit}
                    </text>
                  ))}
                </g>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}

export function BarChart({
  labels, series, height = 220, yFormat = (v) => String(Math.round(v)), stacked = false,
}: {
  labels: string[];
  series: { name: string; color: string; data: (number | null)[] }[];
  height?: number;
  yFormat?: (v: number) => string;
  stacked?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 54, r: 12, t: 12, b: 28 };
  const n = labels.length;
  const ih = height - pad.t - pad.b;
  const { ticks, y } = useMemo(() => {
    let min = 0;
    let max = 0;
    for (let i = 0; i < n; i++) {
      if (stacked) {
        let pos = 0;
        let neg = 0;
        series.forEach((s) => {
          const v = s.data[i] ?? 0;
          if (v >= 0) pos += v;
          else neg += v;
        });
        max = Math.max(max, pos);
        min = Math.min(min, neg);
      } else series.forEach((s) => {
        const v = s.data[i] ?? 0;
        max = Math.max(max, v);
        min = Math.min(min, v);
      });
    }
    if (max === 0 && min === 0) max = 1;
    const ticks = niceTicks(min, max);
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    return { ticks, y: (v: number) => pad.t + ih - ((v - lo) / (hi - lo)) * ih };
  }, [series, n, stacked, ih]);

  const slot = (W - pad.l - pad.r) / n;
  const every = Math.max(1, Math.ceil(n / 12));
  return (
    <div className="chart">
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e4ddcf" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#7a6f60">{yFormat(t)}</text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#9a8d78" />
        {labels.map((l, i) => {
          const gx = pad.l + i * slot;
          const bw = stacked ? slot * 0.6 : (slot * 0.76) / series.length;
          let pos = 0;
          let neg = 0;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={gx} y={pad.t} width={slot} height={ih} fill={hover === i ? '#2b2118' : 'transparent'} opacity={0.05} />
              {series.map((s, k) => {
                const v = s.data[i];
                if (v == null) return null;
                let y0: number;
                let y1: number;
                if (stacked) {
                  if (v >= 0) {
                    y0 = y(pos);
                    y1 = y(pos + v);
                    pos += v;
                  } else {
                    y0 = y(neg);
                    y1 = y(neg + v);
                    neg += v;
                  }
                } else {
                  y0 = y(0);
                  y1 = y(v);
                }
                const bx = stacked ? gx + (slot - bw) / 2 : gx + slot * 0.12 + k * bw;
                return <rect key={s.name} x={bx} y={Math.min(y0, y1)} width={Math.max(1, bw - 1)} height={Math.abs(y0 - y1)} rx={2} fill={s.color} />;
              })}
              {i % every === 0 && <text x={gx + slot / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="#7a6f60">{l}</text>}
            </g>
          );
        })}
        {hover != null && (
          <g transform={`translate(${Math.min(W - 176, pad.l + hover * slot + slot / 2 + 8)},${pad.t + 2})`}>
            <rect width={168} height={20 + series.length * 16} rx={6} fill="#2b2118" opacity={0.92} />
            <text x={8} y={15} fontSize={11} fill="#f5f2ea" fontWeight={600}>{labels[hover]}</text>
            {series.map((s, k) => (
              <text key={s.name} x={8} y={31 + k * 16} fontSize={11} fill="#f5f2ea">
                <tspan fill={s.color}>● </tspan>{s.name}: {s.data[hover] != null ? yFormat(s.data[hover] as number) : '–'}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
