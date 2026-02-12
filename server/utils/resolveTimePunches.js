import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const LOCAL_TZ = "Asia/Manila";

/**
 * Given an array of DTR log punches for a SINGLE day, resolves
 * them into { timeIn, breakOut, breakIn, timeOut } using time-of-day
 * windows rather than the biometric State field (which can be wrong).
 *
 * Time windows (standard PH government office hours):
 *   Time In   → earliest punch before noon (morning arrival)
 *   Time Out  → latest punch at 2 PM or later (afternoon departure)
 *   Break Out → punch in lunch window (11 AM–1:59 PM), earliest remaining
 *   Break In  → punch in lunch window, latest remaining (if ≥2 candidates)
 *
 * If no break punches found but Time In + Time Out both exist,
 * breaks are NOT defaulted (server callers can opt-in via defaultBreak).
 *
 * @param {Array} logs - Array of objects with { Time } (Date) or { time } field.
 * @param {Object} [opts]
 * @param {boolean} [opts.defaultBreak=false] - Auto-fill noon break (server default is false).
 * @returns {{ timeIn: Date|null, breakOut: Date|null, breakIn: Date|null, timeOut: Date|null }}
 */
export function resolveTimePunches(logs, opts = {}) {
  const { defaultBreak = false } = opts;

  const result = { timeIn: null, breakOut: null, breakIn: null, timeOut: null };

  if (!logs || !logs.length) return result;

  const sorted = logs
    .map((l) => {
      const raw = l.Time || l.time;
      const t = dayjs(raw).tz(LOCAL_TZ);
      return t.isValid() ? { time: t } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.time.valueOf() - b.time.valueOf());

  if (!sorted.length) return result;

  const toDate = (d) => d.toDate();

  // Time In: earliest punch before noon
  const timeInPunch = sorted.find((p) => p.time.hour() < 12);
  if (timeInPunch) result.timeIn = toDate(timeInPunch.time);

  // Time Out: latest punch at 2 PM or later
  const timeOutPunch = [...sorted].reverse().find((p) => p.time.hour() >= 14);
  if (timeOutPunch) result.timeOut = toDate(timeOutPunch.time);

  // Single-punch edge case
  if (!result.timeIn && !result.timeOut && sorted.length >= 1) {
    if (sorted[0].time.hour() >= 12) result.timeOut = toDate(sorted[0].time);
    else result.timeIn = toDate(sorted[0].time);
    return result;
  }

  // Break candidates in lunch window (11 AM – 1:59 PM), excluding used punches
  const usedTimestamps = new Set();
  if (timeInPunch) usedTimestamps.add(timeInPunch.time.valueOf());
  if (timeOutPunch) usedTimestamps.add(timeOutPunch.time.valueOf());

  const breakCandidates = sorted.filter((p) => {
    if (usedTimestamps.has(p.time.valueOf())) return false;
    const h = p.time.hour();
    return h >= 11 && h <= 13;
  });

  if (breakCandidates.length >= 2) {
    result.breakOut = toDate(breakCandidates[0].time);
    result.breakIn = toDate(breakCandidates[breakCandidates.length - 1].time);
  } else if (breakCandidates.length === 1) {
    const h = breakCandidates[0].time.hour();
    const m = breakCandidates[0].time.minute();
    if (h < 12 || (h === 12 && m <= 30)) {
      result.breakOut = toDate(breakCandidates[0].time);
    } else {
      result.breakIn = toDate(breakCandidates[0].time);
    }
  }

  return result;
}
