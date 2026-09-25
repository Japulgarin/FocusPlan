export const DEFAULT_TEMPLATE = { wake: "08:00", sleep: "22:00", blockMin: 50, breakMin: 10 };

const LUNCH_AT = 12 * 60 + 30;
const DINNER_AT = 17 * 60 + 30;
const LONG_BREAK_MIN = 20;
const MEAL_MIN = 60;
const WIND_DOWN_MIN = 45;
const MIN_BLOCK_MIN = 30;

export function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fromMin(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// Builds one day's segments: wake, focus blocks with short breaks, a long break every
// third block, lunch at ~12:30, dinner at ~17:30, then wind-down before sleep.
export function buildDaySegments(template = DEFAULT_TEMPLATE) {
  const { wake, sleep, blockMin, breakMin } = { ...DEFAULT_TEMPLATE, ...template };
  const segs = [];
  const wakeMin = toMin(wake);
  const windStart = toMin(sleep) - WIND_DOWN_MIN;
  let t = wakeMin + 30;
  segs.push({ type: "wake", label: "Wake up, breakfast, quick review", start: fromMin(wakeMin), end: fromMin(t) });

  let n = 0;
  let sinceRest = 0;
  let lunchDone = false;
  let dinnerDone = false;

  while (windStart - t >= MIN_BLOCK_MIN) {
    const end = Math.min(t + blockMin, windStart);
    n++;
    segs.push({ type: "study", blockNum: n, start: fromMin(t), end: fromMin(end) });
    t = end;
    sinceRest++;
    if (t >= windStart) break;

    let rest;
    if (!lunchDone && t >= LUNCH_AT) {
      rest = { type: "meal", label: "Lunch", len: MEAL_MIN };
      lunchDone = true;
      sinceRest = 0;
    } else if (!dinnerDone && t >= DINNER_AT) {
      rest = { type: "meal", label: "Dinner", len: MEAL_MIN };
      dinnerDone = true;
      sinceRest = 0;
    } else if (sinceRest >= 3) {
      rest = { type: "break", label: "Long break — stretch / walk", len: LONG_BREAK_MIN };
      sinceRest = 0;
    } else {
      rest = { type: "break", label: "Short break", len: breakMin };
    }
    if (t + rest.len + MIN_BLOCK_MIN > windStart) break;
    segs.push({ type: rest.type, label: rest.label, start: fromMin(t), end: fromMin(t + rest.len) });
    t += rest.len;
  }

  segs.push({ type: "wind", label: "Wind down, no screens", start: fromMin(t), end: sleep });
  return segs;
}

export function countStudyBlocks(template) {
  return buildDaySegments(template).filter(s => s.type === "study").length;
}

export function segmentsFor(plan, day) {
  return day.segments || buildDaySegments(plan.template);
}

export function dateRange(startISO, endISO) {
  const out = [];
  for (let iso = startISO; iso <= endISO; iso = addDays(iso, 1)) out.push(iso);
  return out;
}

export function formatShort(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatDay(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
