const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-time ISO date (YYYY-MM-DD). Never use toISOString() — that's UTC. */
export function toISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole days from `iso` to today. Negative = in the past. */
export function daysFromToday(iso: string | null | undefined): number | null {
  const date = parseISODate(iso);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / DAY_MS);
}

export function daysSince(timestamp: number): number {
  return Math.max(0, Math.floor((Date.now() - timestamp) / DAY_MS));
}

export function startOfWeek(date: Date = new Date()): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Monday-based week.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${`${rest}`.padStart(2, '0')}`;
}

/** Used on the Korean-language stats screens, so the unit is Korean too. */
export function formatMinutes(seconds: number): string {
  const total = Math.floor(seconds / 60);
  if (total < 60) return `${total}분`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export function formatFriendlyDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatRelativeDay(timestamp: number): string {
  const days = daysSince(timestamp);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
