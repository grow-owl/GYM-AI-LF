import { useEffect, useState } from "react";
import clsx from "clsx";

export interface DonutSegment {
  label: string;
  value: number;
  color: string; // CSS color or var(--tone-x)
}

export default function DonutChart({
  segments,
  size = 140,
  thickness = 16,
  centerLabel,
  centerValue,
  layout = "auto",
  className,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  layout?: "auto" | "horizontal" | "vertical";
  className?: string;
}) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 40);
    return () => clearTimeout(t);
  }, []);

  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);
  const radius = Math.max(1, (size - thickness) / 2);
  const circumference = 2 * Math.PI * radius;

  // Filter out 0-value segments for drawing SVG circle segments to prevent dot glitches
  const activeSegments = segments.filter((seg) => (seg.value || 0) > 0);

  let offsetAcc = 0;

  const isVertical = layout === "vertical";
  const isHorizontal = layout === "horizontal";

  return (
    <div
      className={clsx(
        "w-full min-w-0 flex items-center justify-between gap-4 p-1",
        isVertical ? "flex-col" : isHorizontal ? "flex-col sm:flex-row" : "flex-col sm:flex-row",
        className
      )}
    >
      {/* SVG Donut Visual */}
      <div
        className="relative shrink-0 flex items-center justify-center mx-auto sm:mx-0"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 block">
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-surface-3, #334155)"
            strokeWidth={thickness}
            strokeOpacity="0.25"
          />

          {/* Active SVG segments */}
          {activeSegments.map((seg) => {
            const fraction = total > 0 ? seg.value / total : 0;
            const dash = animated ? fraction * circumference : 0;
            const gap = Math.max(0, circumference - dash);
            const rotation = total > 0 ? (offsetAcc / total) * 360 : 0;
            offsetAcc += seg.value;

            return (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${gap}`}
                strokeLinecap={activeSegments.length === 1 ? "butt" : "round"}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "center",
                  transition: "stroke-dasharray 1s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            );
          })}
        </svg>

        {/* Center Text Stats */}
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
            {centerValue && (
              <span className="font-display text-lg sm:text-xl font-black text-(--color-text) tracking-tight leading-none">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-wider mt-0.5 truncate max-w-[90%]">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Styled Legend & Breakdown Cards */}
      <div className="flex-1 w-full min-w-0 space-y-1.5">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div
              key={seg.label}
              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-(--color-surface-2)/80 border border-(--color-border)/50 hover:bg-(--color-surface-2) transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-2 ring-white/10"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-xs font-semibold text-(--color-text) truncate">{seg.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-extrabold text-(--color-text)">
                  {Number.isInteger(seg.value) ? seg.value : Math.floor(seg.value) === 0 ? 0 : seg.value.toFixed(1)}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-(--color-surface-3) text-(--color-text-muted) tabular-nums">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
