import { useState } from "react";
import clsx from "clsx";

export interface HeatmapCell {
  label: string;
  value: number; // 0-4 intensity, or raw value if max provided
  date?: string;
}

const levelClasses = [
  "bg-(--color-surface-3)",
  "bg-(--tone-orange)/25",
  "bg-(--tone-orange)/50",
  "bg-(--tone-orange)/75",
  "bg-(--tone-orange)",
];

export default function Heatmap({
  weeks,
  dayLabels: _dayLabels,
  max,
}: {
  weeks: HeatmapCell[][]; // array of weeks, each week = 7 cells
  dayLabels?: string[];
  max?: number;
}) {
  const [hoveredCell, setHoveredCell] = useState<{ label: string; value: number } | null>(null);
  const flatMax = max ?? Math.max(1, ...weeks.flat().map((c) => c.value));

  const levelFor = (value: number) => {
    if (value <= 0) return 0;
    const ratio = value / flatMax;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  };

  return (
    <div className="w-full space-y-1.5 sm:space-y-2 min-w-0">
      {/* Top info bar showing hovered date and value */}
      <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs min-h-[18px] mb-1">
        <span className="text-(--color-text-faint) font-medium truncate">
          {hoveredCell ? (
            <span className="text-(--color-text) font-semibold">
              {hoveredCell.label}: <span className="text-(--tone-orange)">{hoveredCell.value} check-ins</span>
            </span>
          ) : (
            <>
              <span className="sm:hidden">Tap cell for daily check-ins</span>
              <span className="hidden sm:inline">Hover over any cell to view daily check-in count & date</span>
            </>
          )}
        </span>
        <span className="text-[9px] sm:text-[11px] text-(--color-text-faint) shrink-0 whitespace-nowrap">
          14-week activity
        </span>
      </div>

      <div className="w-full max-w-full overflow-x-auto no-scrollbar pb-0.5">
        {weeks.length === 0 ? (
          <div className="w-full min-w-0 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 sm:gap-1.5 md:gap-2 opacity-40">
            {Array.from({ length: 14 }).map((_, wi) => (
              <div key={wi} className="flex flex-col justify-between items-center w-full min-w-0">
                <div className="flex flex-col gap-1 sm:gap-1.5 w-full">
                  {Array.from({ length: 7 }).map((_, di) => (
                    <div
                      key={di}
                      className="w-full aspect-square rounded-[2.5px] sm:rounded-sm md:rounded-[4px] bg-(--color-surface-3)"
                    />
                  ))}
                </div>
                <span className="text-[8.5px] sm:text-[10px] font-medium text-(--color-text-faint) mt-1.5 sm:mt-2 whitespace-nowrap text-center select-none overflow-visible leading-none">
                  {wi % 3 === 0 ? `W${wi + 1}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full min-w-0 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 sm:gap-1.5 md:gap-2">
            {weeks.map((week, wi) => {
              const firstCellDate = week[0]?.date || `W${wi + 1}`;
              return (
                <div key={wi} className="flex flex-col justify-between items-center w-full min-w-0">
                  <div className="flex flex-col gap-1 sm:gap-1.5 w-full">
                    {week.map((cell, di) => (
                      <div
                        key={di}
                        onClick={() => setHoveredCell({ label: cell.label, value: cell.value })}
                        onMouseEnter={() => setHoveredCell({ label: cell.label, value: cell.value })}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={`${cell.label}: ${cell.value} check-ins`}
                        className={clsx(
                          "w-full aspect-square rounded-[2.5px] sm:rounded-sm md:rounded-[4px] transition-all cursor-pointer hover:scale-125 hover:z-10",
                          levelClasses[levelFor(cell.value)]
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[8.5px] sm:text-[10px] font-medium text-(--color-text-faint) mt-1.5 sm:mt-2 whitespace-nowrap text-center select-none overflow-visible leading-none">
                    {wi % 3 === 0 ? firstCellDate : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
