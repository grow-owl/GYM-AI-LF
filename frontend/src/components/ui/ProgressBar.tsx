import clsx from "clsx";

export default function ProgressBar({
  value,
  max,
  className,
  trackClassName,
}: {
  value: number;
  max: number;
  className?: string;
  trackClassName?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={clsx("h-2 w-full rounded-full bg-(--color-surface-3) overflow-hidden", trackClassName)}>
      <div
        className={clsx("h-full rounded-full bg-(--color-accent)", className)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
