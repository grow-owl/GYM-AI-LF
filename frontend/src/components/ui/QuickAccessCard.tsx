import { Link } from "react-router-dom";
import * as icons from "lucide-react";
import clsx from "clsx";

export type Tone = "blue" | "purple" | "green" | "pink" | "amber" | "orange" | "teal" | "default" | "accent";

interface QuickAccessCardProps {
  label: string;
  path: string;
  icon: string;
  tone?: Tone;
  sublabel?: string;
}

const toneClasses: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-gradient-to-br from-(--tone-blue) to-(--tone-blue)/70", text: "text-white", border: "border-(--tone-blue)/30" },
  purple: { bg: "bg-gradient-to-br from-(--tone-purple) to-(--tone-purple)/70", text: "text-white", border: "border-(--tone-purple)/30" },
  green: { bg: "bg-gradient-to-br from-(--tone-green) to-(--tone-green)/70", text: "text-white", border: "border-(--tone-green)/30" },
  pink: { bg: "bg-gradient-to-br from-(--tone-pink) to-(--tone-pink)/70", text: "text-white", border: "border-(--tone-pink)/30" },
  amber: { bg: "bg-gradient-to-br from-(--tone-amber) to-(--tone-amber)/70", text: "text-white", border: "border-(--tone-amber)/30" },
  orange: { bg: "bg-gradient-to-br from-(--tone-orange) to-(--tone-orange)/70", text: "text-white", border: "border-(--tone-orange)/30" },
  teal: { bg: "bg-gradient-to-br from-(--tone-teal) to-(--tone-teal)/70", text: "text-white", border: "border-(--tone-teal)/30" },
  accent: { bg: "bg-gradient-to-br from-(--color-accent) to-(--color-accent-strong)", text: "text-white", border: "border-(--color-accent)/30" },
};

// Auto-assigned rotation so a list of cards without explicit tones still looks varied
const rotation: (keyof typeof toneClasses)[] = ["blue", "purple", "green", "pink", "amber", "teal", "orange"];
let rotationIndex = 0;
const rotationCache = new Map<string, keyof typeof toneClasses>();

function toneForKey(key: string) {
  if (!rotationCache.has(key)) {
    rotationCache.set(key, rotation[rotationIndex % rotation.length]);
    rotationIndex += 1;
  }
  return rotationCache.get(key)!;
}

export default function QuickAccessCard({ label, path, icon, tone, sublabel }: QuickAccessCardProps) {
  const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[icon] ?? icons.Circle;
  const resolvedTone = tone && tone !== "default" ? tone : toneForKey(path);
  const t = toneClasses[resolvedTone] ?? toneClasses.orange;

  return (
    <Link
      to={path}
      data-tone={resolvedTone}
      className={clsx(
        "glow-hover group flex flex-col items-start gap-3 rounded-2xl border p-4 bg-(--color-surface)",
        "active:scale-[0.98]",
        t.border
      )}
    >
      <span className={clsx("flex h-10 w-10 items-center justify-center rounded-xl transition-colors", t.bg, t.text)}>
        <Icon size={19} strokeWidth={2.25} />
      </span>
      <div>
        <p className="text-sm font-medium text-(--color-text) leading-tight">{label}</p>
        {sublabel && <p className="text-xs text-(--color-text-faint) mt-0.5">{sublabel}</p>}
      </div>
    </Link>
  );
}
