// utils/normalizeAttendance.js
const dayjs = require("dayjs");

function normalizeTimeLogs(record) {
  const date = dayjs(record.date).startOf("day"); // base day

  const fixTime = (time, expected) => {
    if (!time || time === "---") return "---";

    let parsed = dayjs(time);

    // Force to the same base date
    parsed = parsed.year(date.year()).month(date.month()).date(date.date());

    // Adjust based on expected shift
    if (expected === "AM" && parsed.hour() >= 12) {
      // If mistakenly PM, subtract 12 hours
      parsed = parsed.subtract(12, "hour");
    }
    if (expected === "PM" && parsed.hour() < 12) {
      // If mistakenly AM, add 12 hours
      parsed = parsed.add(12, "hour");
    }

    return parsed.toDate();
  };

  return {
    ...record,
    timeIn: fixTime(record.timeIn, "AM"),
    breakOut: fixTime(record.breakOut, "PM"),
    breakIn: fixTime(record.breakIn, "PM"),
    timeOut: fixTime(record.timeOut, "PM"),
  };
}

module.exports = { normalizeTimeLogs };
