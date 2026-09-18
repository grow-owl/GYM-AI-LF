import { useEffect, useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  formattedValue?: string;
}

export default function BarChart({ data, height = 120 }: { data: BarDatum[]; height?: number }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 30);
    return () => clearTimeout(t);
  }, []);

  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex items-end gap-2 sm:gap-3 md:gap-4 w-full" style={{ height }}>
      {data.map((d, i) => {
        const pct = Math.max(8, (d.value / max) * 100);
        const displayVal = d.formattedValue ?? (typeof d.value === "number" ? d.value.toLocaleString("en-IN") : String(d.value));

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end min-w-0 group">
            <span
              className="text-[10px] sm:text-[11px] font-bold font-mono text-(--color-text) shrink-0 transition-transform group-hover:scale-110 truncate max-w-full"
              title={displayVal}
            >
              {displayVal}
            </span>
            <div className="w-full flex-1 flex items-end justify-center">
              <div
                className="w-full max-w-[36px] sm:max-w-[52px] md:max-w-[68px] lg:max-w-[80px] mx-auto rounded-t-xl transition-all duration-700 ease-out shadow-xs group-hover:brightness-110"
                style={{
                  height: animated ? `${pct}%` : "0%",
                  backgroundColor: d.color ?? "var(--color-accent)",
                  minHeight: 6,
                }}
                title={`${d.label}: ${displayVal}`}
              />
            </div>
            <span
              className="text-[10px] sm:text-[11px] font-medium text-(--color-text-muted) truncate w-full text-center mt-1 select-none"
              title={d.label}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
