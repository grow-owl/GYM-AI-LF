/**
 * Utility functions for formatting branch names cleanly across desktop, tablet, and mobile.
 */

/**
 * Returns a clean, short branch name (e.g. "Pune Branch") for mobile and tablet views
 * dynamically derived from the backend branch data without hardcoding.
 *
 * Examples:
 * - "Amar Fitness - Pune (Primary Branch)" -> "Pune Branch"
 * - "Gold Gym - Bandra West" -> "Bandra West Branch"
 * - "Cult - Whitefield Branch" -> "Whitefield Branch"
 * - "Main Branch" -> "Main Branch"
 */
export function getShortBranchName(
  rawName?: string | null,
  gymName?: string | null,
  city?: string | null
): string {
  if (!rawName && !city) return "";
  let name = (rawName || "").trim();

  // 1. Strip parentheticals like "(Primary Branch)", "(Main Branch)"
  name = name.replace(/\s*\([^)]*\)/g, "").trim();

  // 2. If the gym name is prefixed, strip it (e.g. "Amar Fitness - Pune" -> "Pune")
  if (gymName && name.toLowerCase().startsWith(gymName.toLowerCase())) {
    name = name.slice(gymName.length).replace(/^[\s\-–—:]+/, "").trim();
  } else if (name.includes("-") || name.includes("–") || name.includes("—")) {
    // If there's a hyphen / dash separator, take the location part after the dash
    const parts = name.split(/[\-–—]/);
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart) {
      name = lastPart;
    }
  }

  // 3. If empty after stripping, fallback to city if available
  if (!name && city) {
    name = city.trim();
  }

  // 4. If name doesn't contain "Branch", append " Branch" (e.g. "Pune" -> "Pune Branch")
  if (name && !name.toLowerCase().includes("branch")) {
    name = `${name} Branch`;
  }

  return name || rawName || "";
}

/**
 * Returns clean full branch name for desktop (e.g. "Amar Fitness - Pune")
 * by removing parentheticals like "(Primary Branch)" while keeping gym brand context.
 */
export function getCleanDesktopBranchName(rawName?: string | null): string {
  if (!rawName) return "";
  return rawName.replace(/\s*\([^)]*\)/g, "").trim();
}
