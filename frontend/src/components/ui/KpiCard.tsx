import * as icons from "lucide-react";
import clsx from "clsx";

export type Tone = "blue" | "purple" | "green" | "pink" | "amber" | "orange" | "teal";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down";
  icon: string;
  tone?: Tone;
  emphasize?: boolean;
}

const toneClasses: Record<Tone, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-gradient-to-br from-(--tone-blue) to-(--tone-blue)/70", text: "text-white", border: "border-(--tone-blue)/30" },
  purple: { bg: "bg-gradient-to-br from-(--tone-purple) to-(--tone-purple)/70", text: "text-white", border: "border-(--tone-purple)/30" },
  green: { bg: "bg-gradient-to-br from-(--tone-green) to-(--tone-green)/70", text: "text-white", border: "border-(--tone-green)/30" },
  pink: { bg: "bg-gradient-to-br from-(--tone-pink) to-(--tone-pink)/70", text: "text-white", border: "border-(--tone-pink)/30" },
  amber: { bg: "bg-gradient-to-br from-(--tone-amber) to-(--tone-amber)/70", text: "text-white", border: "border-(--tone-amber)/30" },
  orange: { bg: "bg-gradient-to-br from-(--tone-orange) to-(--tone-orange)/70", text: "text-white", border: "border-(--tone-orange)/30" },
  teal: { bg: "bg-gradient-to-br from-(--tone-teal) to-(--tone-teal)/70", text: "text-white", border: "border-(--tone-teal)/30" },
};

export default function KpiCard({ label, value, delta, deltaDirection, icon, tone = "orange" }: KpiCardProps) {
  const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[icon] ?? icons.Circle;
  const isDown = deltaDirection === "down";
  const t = toneClasses[tone];

  return (
    <div
      data-tone={tone}
      className={clsx(
        "glow-hover rounded-(--radius-card) border p-4 sm:p-5 flex flex-col gap-3 bg-(--color-surface) animate-fade-in-up",
        t.border
      )}
    >
      <div className="flex items-center justify-between">
        <span className={clsx("flex h-9 w-9 items-center justify-center rounded-xl", t.bg, t.text)}>
          <Icon size={18} strokeWidth={2.25} />
        </span>
        {delta && (
          <span
            className={clsx(
              "text-xs font-medium font-mono",
              isDown ? "text-(--color-danger)" : "text-(--color-good)"
            )}
          >
            {isDown ? "▼ " : "▲ "}
            {delta}
          </span>
        )}
      </div>
      <div>
        <p className="font-display text-2xl font-semibold text-(--color-text) tabular-nums">{value}</p>
        <p className="text-xs text-(--color-text-muted) mt-0.5">{label}</p>
      </div>
    </div>
  );
}
