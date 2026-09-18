/**
 * Timezone Utility for Branch-Localized Date Keying
 */

/**
 * Returns a 'YYYY-MM-DD' date string localized to the given branch IANA timezone
 * (e.g., 'Asia/Kolkata', 'America/New_York', 'UTC').
 */
export const getDayKeyForBranch = (date: Date = new Date(), timezone: string = 'UTC'): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // en-CA locale formats as YYYY-MM-DD
    return formatter.format(date);
  } catch (error) {
    // Fallback to UTC if an invalid timezone string was supplied
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};
