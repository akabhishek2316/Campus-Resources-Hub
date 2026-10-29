// College-local time helpers. All data is stored in UTC; the college offset is configured by env.
export const TZ_OFFSET_MIN = Number(process.env.NEXT_PUBLIC_TZ_OFFSET_MIN ?? 330);
export const TZ_LABEL = process.env.NEXT_PUBLIC_TZ_LABEL ?? 'IST';
const MIN = 60000;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAYS = DAYS;

export function toLocal(d: Date | string): Date {
  const t = typeof d === 'string' ? new Date(d) : d;
  return new Date(t.getTime() + TZ_OFFSET_MIN * MIN);
}
export function localToUtc(dateStr: string, hour: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, 0, 0) - TZ_OFFSET_MIN * MIN);
}
export const localWeekday = (d: Date | string) => toLocal(d).getUTCDay();
export function localHourFloat(d: Date | string) {
  const l = toLocal(d);
  return l.getUTCHours() + l.getUTCMinutes() / 60;
}
export const localDateStr = (d: Date | string) => toLocal(d).toISOString().slice(0, 10);
export const todayLocalStr = () => localDateStr(new Date());

export function weekStartUtc(d: Date | string): Date {
  const l = toLocal(d);
  const dow = (l.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(
    Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - dow) - TZ_OFFSET_MIN * MIN
  );
}
export function hoursBetween(a: Date | string, b: Date | string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}
export function fmtTime(d: Date | string) {
  const l = toLocal(d);
  return `${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}`;
}
export function fmtDateTime(d: Date | string) {
  const l = toLocal(d);
  return `${DAYS[l.getUTCDay()]} ${l.getUTCDate()} ${MONTHS[l.getUTCMonth()]}, ${fmtTime(d)}`;
}
export function fmtRange(s: Date | string, e: Date | string) {
  return `${fmtDateTime(s)} to ${fmtTime(e)}`;
}
export function hourLabel(h: number) {
  return `${pad(h)}:00`;
}

// "Mon-Fri 10:00-17:00" style summary of availability windows.
export function summarizeWindows(
  windows: { weekday: number; start_hour: number; end_hour: number }[]
) {
  const groups = new Map<string, number[]>();
  for (const w of windows) {
    const k = `${w.start_hour}-${w.end_hour}`;
    groups.set(k, [...(groups.get(k) ?? []), w.weekday]);
  }
  return [...groups.entries()].map(([k, days]) => {
    const [s, e] = k.split('-').map(Number);
    const sorted = days.sort((a, b) => a - b);
    const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
    const label =
      contiguous && sorted.length > 2
        ? `${DAYS[sorted[0]]} to ${DAYS[sorted[sorted.length - 1]]}`
        : sorted.map((d) => DAYS[d]).join(', ');
    return `${label}, ${hourLabel(s)} to ${hourLabel(e)}`;
  });
}
