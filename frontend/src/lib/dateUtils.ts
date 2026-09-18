/**
 * Date and Timezone Utilities for Member Dashboard & Daily Loggers
 */

/**
 * Returns a 'YYYY-MM-DD' date string localized to the user's browser local timezone.
 * Unlike date.toISOString().slice(0, 10) which returns the UTC date (often 5.5 hours behind in IST),
 * getLocalDateKey() guarantees that right at 12:00 AM midnight local time, it flips to the new day.
 */
export function getLocalDateKey(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}
