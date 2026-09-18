import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import clsx from "clsx";

export interface SelectOption {
  value: string;
  label: string;
  shortLabel?: string;
  dotColor?: string;
}

interface CustomSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** compact mode — used inside topbar / pill containers */
  compact?: boolean;
  /** asButton mode — renders trigger as a clean, rounded button matching action toolbars */
  asButton?: boolean;
  /** alignment of dropdown menu: "left" | "right" | "auto" */
  align?: "left" | "right" | "auto";
}

export default function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option…",
  required,
  disabled,
  className,
  compact = false,
  asButton = false,
  align = "auto",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Match by value; if no match but options exist, fall back gracefully
  const selected = options.find((o) => o.value === value);
  // For compact: show first option label if value doesn't match yet (loading state)
  const displayLabel = selected?.label ?? (compact && options.length > 0 ? options[0].label : placeholder);

  /* Auto-detect if dropdown should open upwards to prevent screen cutoff */
  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 240 && spaceAbove > spaceBelow) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [open]);

  /* Close on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-select first option in compact mode if value doesn't match
  useEffect(() => {
    if (compact && options.length > 0 && !selected) {
      onChange(options[0].value);
    }
  }, [compact, options, selected, onChange]);

  function choose(val: string) {
    onChange(val);
    setOpen(false);
  }

  if (asButton) {
    /* ── Action button variant (Lead card actions, table rows) ── */
    return (
      <div ref={ref} className={clsx("relative min-w-0", className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={clsx(
            "h-8 px-2.5 rounded-lg border text-xs font-semibold select-none cursor-pointer inline-flex items-center justify-between gap-1.5 transition-all",
            "bg-(--color-surface-2) border-(--color-border) text-(--color-text)",
            "hover:bg-(--color-surface-3) hover:border-(--color-accent)",
            open && "border-(--color-accent) ring-2 ring-[var(--color-accent-soft)] bg-(--color-surface)",
            disabled && "opacity-50 cursor-not-allowed",
            "w-full sm:w-auto"
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            {selected?.dotColor && (
              <span className={clsx("w-2 h-2 rounded-full shrink-0", selected.dotColor)} />
            )}
            <span className="truncate">{selected?.shortLabel || displayLabel}</span>
          </div>
          <ChevronDown
            size={12}
            className={clsx(
              "shrink-0 text-(--color-text-muted) transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <div
            className={clsx(
              "absolute z-[9999] min-w-[170px] max-w-[240px] w-max rounded-xl border border-(--color-border) bg-(--color-surface) shadow-2xl max-h-60 overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-100 p-1 space-y-0.5",
              openUpwards ? "bottom-full mb-1.5" : "top-full mt-1.5",
              align === "left" ? "left-0" : align === "right" ? "right-0" : "left-0 sm:right-0"
            )}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value || (!selected && opt.value === options[0]?.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => choose(opt.value)}
                  className={clsx(
                    "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer",
                    isSelected
                      ? "bg-(--color-accent-soft) text-(--color-accent-text) font-semibold"
                      : "text-(--color-text) hover:bg-(--color-surface-2)"
                  )}
                >
                  <div className="flex items-center gap-2 truncate flex-1">
                    {opt.dotColor && (
                      <span className={clsx("w-2 h-2 rounded-full shrink-0", opt.dotColor)} />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <Check size={13} className="shrink-0 text-(--color-accent-text)" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (compact) {
    /* ── Compact pill variant (TopBar branch selector) ── */
    return (
      <div ref={ref} className={clsx("relative min-w-0", className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 font-semibold text-xs text-(--color-text) cursor-pointer select-none whitespace-nowrap min-w-0"
        >
          {selected?.shortLabel ? (
            <>
              <span className="lg:hidden truncate max-w-[90px] xs:max-w-[130px]">{selected.shortLabel}</span>
              <span className="hidden lg:inline truncate">{displayLabel}</span>
            </>
          ) : (
            <span className="truncate max-w-[90px] xs:max-w-[130px] lg:max-w-none">{displayLabel}</span>
          )}
          <ChevronDown
            size={12}
            className={clsx(
              "shrink-0 text-(--color-text-muted) transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <div
            className={clsx(
              "absolute z-[9999] min-w-[160px] max-w-[220px] sm:max-w-xs w-max rounded-xl border border-(--color-border) bg-(--color-surface) shadow-xl max-h-60 overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-100",
              openUpwards ? "bottom-full mb-1.5" : "top-full mt-2",
              align === "left" ? "left-0" : "right-0"
            )}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => choose(opt.value)}
                className={clsx(
                  "w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm text-left transition-colors cursor-pointer",
                  opt.value === value || (!selected && opt.value === options[0]?.value)
                    ? "bg-(--color-accent-soft) text-(--color-accent-text) font-semibold"
                    : "text-(--color-text) hover:bg-(--color-surface-2)"
                )}
              >
                <div className="flex items-center gap-2 truncate flex-1">
                  {opt.dotColor && (
                    <span className={clsx("w-2 h-2 rounded-full shrink-0", opt.dotColor)} />
                  )}
                  <span className="truncate flex-1 lg:hidden">{opt.shortLabel || opt.label}</span>
                  <span className="truncate flex-1 hidden lg:inline">{opt.label}</span>
                </div>
                {(opt.value === value || (!selected && opt.value === options[0]?.value)) && (
                  <Check size={13} className="shrink-0 text-(--color-accent-text)" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Full-width variant (forms, modals) ── */
  return (
    <div ref={ref} className={clsx("relative", className)}>
      {label && (
        <label className="block text-(--color-text-muted) mb-1 font-medium text-xs">
          {label}
        </label>
      )}
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={clsx(
          "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm text-left",
          "bg-(--color-surface-2) border-(--color-border) text-(--color-text)",
          "transition-colors duration-150 cursor-pointer",
          "focus:outline-none",
          open && "border-(--color-accent) ring-2 ring-[var(--color-accent-soft)] bg-(--color-surface)",
          disabled && "opacity-50 cursor-not-allowed",
          !selected && "text-(--color-text-faint)"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-required={required}
      >
        <span className="truncate flex-1">{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={15}
          className={clsx(
            "shrink-0 text-(--color-text-muted) transition-transform duration-200 ml-1",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown panel — positioned to overflow modal if needed */}
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-[9999] max-h-56 overflow-y-auto rounded-xl border border-(--color-border) bg-(--color-surface) shadow-2xl divide-y divide-(--color-border-soft) animate-in fade-in zoom-in-95 duration-100"
        >
          {options.length === 0 ? (
            <p className="px-4 py-3 text-xs text-(--color-text-faint) text-center">
              No options available
            </p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => choose(opt.value)}
                className={clsx(
                  "w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-left transition-colors",
                  opt.value === value
                    ? "bg-(--color-accent-soft) text-(--color-accent-text) font-semibold"
                    : "text-(--color-text) hover:bg-(--color-surface-2)"
                )}
              >
                {/* Allow wrapping so long labels don't get cut off */}
                <span className="leading-snug">{opt.label}</span>
                {opt.value === value && (
                  <Check size={13} className="shrink-0 text-(--color-accent)" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
