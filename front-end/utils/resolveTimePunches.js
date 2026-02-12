import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

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
 * If no break punches found in the lunch window but Time In + Time Out
 * both exist, defaults to 12:00 PM / 1:00 PM.
 *
 * @param {Array} logs - Array of { time, state } where `time` is any value
 *                       parseable by dayjs (Date, ISO string, etc.)
 * @param {Object} [opts]
 * @param {string} [opts.tz=Asia/Manila] - Timezone for hour interpretation.
 * @param {string} [opts.format='h:mm A'] - Output format for times.
 * @param {boolean} [opts.defaultBreak=true] - Auto-fill 12:00/1:00 break when
 *                                             employee has In+Out but no break punches.
 * @returns {{ timeIn: string, breakOut: string, breakIn: string, timeOut: string }}
 *          Empty string for any slot without a punch.
 */
export function resolveTimePunches(logs, opts = {}) {
  const {
    tz = LOCAL_TZ,
    format = "h:mm A",
    defaultBreak = true,
  } = opts;

  const result = { timeIn: "", breakOut: "", breakIn: "", timeOut: "" };

  if (!logs || !logs.length) return result;

  // Parse and sort chronologically
  const sorted = logs
    .map((l) => {
      const t = dayjs(l.time || l.Time).tz(tz);
      return t.isValid() ? { time: t } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.time.valueOf() - b.time.valueOf());

  if (!sorted.length) return result;

  const fmt = (d) => d.format(format);

  // ── Time In: earliest punch before noon (morning arrival) ──
  const timeInPunch = sorted.find((p) => p.time.hour() < 12);
  if (timeInPunch) result.timeIn = fmt(timeInPunch.time);

  // ── Time Out: latest punch at 2 PM or later (afternoon/evening departure) ──
  const timeOutPunch = [...sorted].reverse().find((p) => p.time.hour() >= 14);
  if (timeOutPunch) result.timeOut = fmt(timeOutPunch.time);

  // Edge case: single punch that doesn't fit standard windows
  if (!result.timeIn && !result.timeOut && sorted.length >= 1) {
    if (sorted[0].time.hour() >= 12) result.timeOut = fmt(sorted[0].time);
    else result.timeIn = fmt(sorted[0].time);
    return result;
  }

  // ── Break detection: punches in the lunch window (11 AM – 1:59 PM) ──
  // Exclude punches already assigned to Time In or Time Out
  const usedTimestamps = new Set();
  if (timeInPunch) usedTimestamps.add(timeInPunch.time.valueOf());
  if (timeOutPunch) usedTimestamps.add(timeOutPunch.time.valueOf());

  const breakCandidates = sorted.filter((p) => {
    if (usedTimestamps.has(p.time.valueOf())) return false;
    const h = p.time.hour();
    return h >= 11 && h <= 13; // 11:00 AM to 1:59 PM
  });

  if (breakCandidates.length >= 2) {
    result.breakOut = fmt(breakCandidates[0].time);
    result.breakIn = fmt(breakCandidates[breakCandidates.length - 1].time);
  } else if (breakCandidates.length === 1) {
    // Single lunch punch: ≤12:30 PM → Break Out; after → Break In
    const h = breakCandidates[0].time.hour();
    const m = breakCandidates[0].time.minute();
    if (h < 12 || (h === 12 && m <= 30)) {
      result.breakOut = fmt(breakCandidates[0].time);
    } else {
      result.breakIn = fmt(breakCandidates[0].time);
    }
  }

  // ── Default break: 12:00 PM / 1:00 PM when In+Out exist but no break found ──
  if (defaultBreak && result.timeIn && result.timeOut && !result.breakOut && !result.breakIn) {
    const noon = dayjs().tz(tz).hour(12).minute(0).second(0);
    const onePm = dayjs().tz(tz).hour(13).minute(0).second(0);
    result.breakOut = noon.format(format);
    result.breakIn = onePm.format(format);
  }

  return result;
}

/**
 * Same logic as resolveTimePunches but returns raw dayjs objects instead of
 * formatted strings. Useful for server-side code that stores Date objects.
 *
 * @returns {{ timeIn: Date|null, breakOut: Date|null, breakIn: Date|null, timeOut: Date|null }}
 */
export function resolveTimePunchesRaw(logs, opts = {}) {
  const { tz = LOCAL_TZ, defaultBreak = true } = opts;

  const result = { timeIn: null, breakOut: null, breakIn: null, timeOut: null };

  if (!logs || !logs.length) return result;

  const sorted = logs
    .map((l) => {
      const t = dayjs(l.Time || l.time).tz(tz);
      return t.isValid() ? { time: t } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.time.valueOf() - b.time.valueOf());

  if (!sorted.length) return result;

  // Time In: earliest before noon
  const timeInPunch = sorted.find((p) => p.time.hour() < 12);
  if (timeInPunch) result.timeIn = timeInPunch.time.toDate();

  // Time Out: latest at 2 PM or later
  const timeOutPunch = [...sorted].reverse().find((p) => p.time.hour() >= 14);
  if (timeOutPunch) result.timeOut = timeOutPunch.time.toDate();

  // Single-punch edge case
  if (!result.timeIn && !result.timeOut && sorted.length >= 1) {
    if (sorted[0].time.hour() >= 12) result.timeOut = sorted[0].time.toDate();
    else result.timeIn = sorted[0].time.toDate();
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
    result.breakOut = breakCandidates[0].time.toDate();
    result.breakIn = breakCandidates[breakCandidates.length - 1].time.toDate();
  } else if (breakCandidates.length === 1) {
    const h = breakCandidates[0].time.hour();
    const m = breakCandidates[0].time.minute();
    if (h < 12 || (h === 12 && m <= 30)) {
      result.breakOut = breakCandidates[0].time.toDate();
    } else {
      result.breakIn = breakCandidates[0].time.toDate();
    }
  }

  return result;
}
