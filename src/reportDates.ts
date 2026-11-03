// ISO calendar dates retain their day; timestamps are displayed in Ecuador time.
export const reportDateKeys = new Set(['planned_start_date', 'planned_end_date', 'planned_date', 'start', 'end', 'date', 'start_date', 'end_date']);
export const reportDateTimeKeys = new Set(['created_at', 'updated_at', 'uploaded_at']);
export function reportDate(value: unknown, withTime = false): string {
  if (value == null || value === '') return '';
  const text = String(value);
  const calendar = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(text);
  if (!withTime && calendar) return `${calendar[3]}/${calendar[2]}/${calendar[1]}`;
  if (!withTime) return text;
  const date = value instanceof Date ? value : new Date(text);
  if (Number.isNaN(date.valueOf())) return text;
  const parts = new Intl.DateTimeFormat('es-EC', {timeZone:'America/Guayaquil',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const get = (key: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === key)?.value || '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}
