import clsx from "clsx";

type Tone = "good" | "warn" | "danger" | "accent" | "neutral";

const toneClasses: Record<Tone, string> = {
  good: "bg-(--color-good-soft) text-(--color-good) border-(--color-good)/30",
  warn: "bg-(--color-warn-soft) text-(--color-warn) border-(--color-warn)/30",
  danger: "bg-(--color-danger-soft) text-(--color-danger) border-(--color-danger)/30",
  accent: "bg-(--color-accent-soft) text-(--color-accent-text) border-(--color-accent)/30",
  neutral: "bg-(--color-surface-3) text-(--color-text-muted) border-(--color-border)",
};

export default function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
