import clsx from "clsx";

export default function Card({
  children,
  className,
  sweep,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  sweep?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "card-hover rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-4 sm:p-5 transition-all duration-250",
        sweep && "energy-sweep",
        className
      )}
    >
      {children}
    </div>
  );
}
