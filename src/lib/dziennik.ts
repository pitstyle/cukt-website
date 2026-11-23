/**
 * Shared helpers for the Habeas Mentem dziennik collection.
 */

/** Normalize frontmatter date (string or YAML Date) to YYYY-MM-DD. */
export function normalizeDziennikDate(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError('dziennik date is an invalid Date');
    }
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const trimmed = value.trim();
  const isoDay = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay) return isoDay[1];
  return trimmed;
}

export const ENTRY_AVAILABLE_IN_POLISH = 'Entry available in Polish';

export type DziennikLocalizedFields = {
  title: string;
  title_en?: string;
  thesis: string;
  thesis_en?: string;
  description?: string;
  description_en?: string;
};

/** True when EN view must fall back to Polish for one or more public fields. */
export function needsPolishOnlyNote(data: DziennikLocalizedFields): boolean {
  if (!data.title_en) return true;
  if (!data.thesis_en) return true;
  if (data.description && !data.description_en) return true;
  return false;
}
