// All date math is UTC so day comparisons never drift with the local timezone.

const MS_PER_DAY = 86_400_000;

// Returns null for malformed or impossible dates.
export const parseDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  // Reject dates like 2026-02-31 that JS silently rolls into the next month.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
};

export const toISODate = (date: Date): string => date.toISOString().slice(0, 10);

export const addDays = (date: Date, n: number): Date => new Date(date.getTime() + n * MS_PER_DAY);

// b - a in days; same day = 0.
export const diffDays = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);

// Truncated to UTC midnight to match the chart domain.
export const todayUTC = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const formatVN = (date: Date): string => {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getUTCFullYear()}`;
};

export const formatShort = (date: Date): string => {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}`;
};
