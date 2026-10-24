"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Datum } from "@/lib/types";

/** Single-series vertical bar chart with hover tooltip. */
export function BarChart({
  data,
  label,
  unit,
  fmt,
  every: everyProp,
}: {
  data: Datum[];
  label: string;
  unit?: string;
  fmt?: (v: number) => string | number;
  every?: number;
}) {
  const [hv, setHv] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    if (!box.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((en) => setW(Math.max(280, Math.round(en[0].contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const H = 220, L = 44, B = 24, T = 8, n = data.length;
  const max = Math.max(...data.map((d) => d.v)) || 1;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const bw = (W - L) / n;
  const gap = Math.max(2, Math.min(bw * 0.25, 24));
  const every = everyProp || Math.ceil(n / Math.max(1, Math.floor((W - L) / 56)));
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const f = (v: number) => (fmt ? fmt(v) : v);

  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="gl" x1={L} x2={W} y1={y(t)} y2={y(t)} />
            <text className="ax" x={L - 8} y={y(t) + 4} textAnchor="end">
              {f(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = L + i * bw + gap / 2, w = bw - gap, yy = y(d.v), hh = H - B - yy, r = Math.min(4, w / 2, hh);
          const path = `M${x},${H - B}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + w - r}Q${x + w},${yy} ${x + w},${yy + r}V${H - B}Z`;
          return (
            <g key={i}>
              <path className={"b" + (hv != null && hv !== i ? " dim" : "")} d={hh > 0 ? path : ""} />
              {i % every === 0 ? (
                <text className="ax" x={x + w / 2} y={H - 6} textAnchor="middle">
                  {d.k}
                </text>
              ) : null}
              <rect
                className="hit"
                x={L + i * bw}
                y={T}
                width={bw}
                height={H - T - B}
                onMouseEnter={() => setHv(i)}
                onMouseLeave={() => setHv(null)}
              />
            </g>
          );
        })}
      </svg>
      {hv != null ? (
        <div className="tip" style={{ left: ((L + (hv + 0.5) * bw) / W) * 100 + "%", top: (y(data[hv].v) / H) * 100 + "%" }}>
          {data[hv].k} · {f(data[hv].v)}
          {unit ? " " + unit : ""}
        </div>
      ) : null}
    </div>
  );
}

export function HBars({ rows }: { rows: { k: string; label?: ReactNode; v: number }[] }) {
  const max = Math.max(...rows.map((r) => r.v)) || 1;
  return (
    <div>
      {rows.map((r) => (
        <div key={r.k} className="hbar">
          <span>{r.label ?? r.k}</span>
          <div className="track">
            <i style={{ width: (r.v / max) * 100 + "%" }} />
          </div>
          <span className="v">{r.v.toLocaleString("en-US")}</span>
        </div>
      ))}
    </div>
  );
}
