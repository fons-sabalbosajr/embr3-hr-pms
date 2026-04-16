import DTRLog from "../models/DTRLog.js";
import DTRResolution from "../models/DTRResolution.js";
import Employee from "../models/Employee.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const LOCAL_TZ = "Asia/Manila";

const parseInLocalTz = (value) => {
  if (!value) return dayjs.invalid();
  if (value instanceof Date || typeof value === "number") return dayjs(value).tz(LOCAL_TZ);
  const s = String(value);
  const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
  return hasZone ? dayjs(s).tz(LOCAL_TZ) : dayjs.tz(s, LOCAL_TZ);
};

const normalizeDigits = (v) => (v ? String(v).replace(/\D/g, "").replace(/^0+/, "") : "");

/**
 * GET /dtr-resolutions/search-biometric
 * Search across all uploaded DTR Data for an employee's biometric punches on specific dates.
 * Query: empId (required), startDate, endDate
 */
export const searchBiometricLogs = async (req, res) => {
  try {
    const { empId, startDate, endDate } = req.query;
    if (!empId) {
      return res.status(400).json({ success: false, message: "empId is required" });
    }

    const employee = await Employee.findOne({ empId }).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Build all possible AC-No identifiers for this employee
    const allIds = [employee.empId, ...(employee.alternateEmpIds || []), employee.empNo].filter(Boolean);
    const digits = [...new Set(allIds.map(normalizeDigits).filter(Boolean))];

    // Build filter
    const or = [];
    if (digits.length) {
      or.push({ normalizedAcNo: { $in: digits } });
      // Suffix match for biometric systems that prefix IDs
      digits.filter((d) => d.length >= 3).forEach((d) => {
        or.push({ normalizedAcNo: new RegExp(`${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
      });
    }

    if (!or.length) {
      return res.json({ success: true, data: [] });
    }

    const filter = { $or: or };

    if (startDate || endDate) {
      filter.Time = {};
      if (startDate) {
        const s = parseInLocalTz(startDate);
        if (s.isValid()) filter.Time.$gte = s.startOf("day").toDate();
      }
      if (endDate) {
        const e = parseInLocalTz(endDate);
        if (e.isValid()) filter.Time.$lte = e.endOf("day").toDate();
      }
    }

    const logs = await DTRLog.find(filter)
      .populate("DTR_ID", "DTR_Record_Name")
      .sort({ Time: 1 })
      .limit(2000)
      .lean();

    // Group by date and state
    const grouped = {};
    for (const log of logs) {
      const t = parseInLocalTz(log.Time);
      if (!t.isValid()) continue;
      const dateKey = t.format("YYYY-MM-DD");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({
        _id: log._id,
        time: t.format("h:mm A"),
        time24: t.format("HH:mm"),
        state: log.State || "",
        name: log.Name || "",
        acNo: log["AC-No"] || "",
        source: log.DTR_ID?.DTR_Record_Name || "Unknown",
      });
    }

    res.json({ success: true, data: grouped });
  } catch (err) {
    console.error("searchBiometricLogs error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /dtr-resolutions
 * Load saved resolutions for an employee + record.
 * Query: empId, recordId
 */
export const getResolutions = async (req, res) => {
  try {
    const { empId, recordId } = req.query;
    if (!empId || !recordId) {
      return res.status(400).json({ success: false, message: "empId and recordId are required" });
    }

    const resolutions = await DTRResolution.find({ empId, recordId }).lean();
    const map = {};
    for (const r of resolutions) {
      map[r.dateKey] = {
        _id: r._id,
        timeIn: r.timeIn || "",
        breakOut: r.breakOut || "",
        breakIn: r.breakIn || "",
        timeOut: r.timeOut || "",
        workStatus: r.workStatus || "",
        source: r.source,
      };
    }

    res.json({ success: true, data: map });
  } catch (err) {
    console.error("getResolutions error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /dtr-resolutions
 * Save or update a resolution for a specific date.
 * Body: { empId, recordId, dateKey, timeIn, breakOut, breakIn, timeOut, source }
 */
export const saveResolution = async (req, res) => {
  try {
    const { empId, recordId, dateKey, timeIn, breakOut, breakIn, timeOut, workStatus, source } = req.body;
    if (!empId || !recordId || !dateKey) {
      return res.status(400).json({ success: false, message: "empId, recordId, and dateKey are required" });
    }

    const callerId = req.user?.id || req.user?._id;

    const resolution = await DTRResolution.findOneAndUpdate(
      { empId, recordId, dateKey },
      {
        timeIn: timeIn || "",
        breakOut: breakOut || "",
        breakIn: breakIn || "",
        timeOut: timeOut || "",
        workStatus: workStatus || "",
        source: source || "manual",
        createdBy: callerId,
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: resolution });
  } catch (err) {
    console.error("saveResolution error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /dtr-resolutions/bulk
 * Save or update multiple resolutions at once.
 * Body: { empId, recordId, entries: [{ dateKey, timeIn, breakOut, breakIn, timeOut, source }] }
 */
export const bulkSaveResolutions = async (req, res) => {
  try {
    const { empId, recordId, entries } = req.body;
    if (!empId || !recordId || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: "empId, recordId, and entries array are required" });
    }

    const callerId = req.user?.id || req.user?._id;
    const ops = entries.map((e) => ({
      updateOne: {
        filter: { empId, recordId, dateKey: e.dateKey },
        update: {
          timeIn: e.timeIn || "",
          breakOut: e.breakOut || "",
          breakIn: e.breakIn || "",
          timeOut: e.timeOut || "",
          source: e.source || "biometric",
          createdBy: callerId,
        },
        upsert: true,
      },
    }));

    await DTRResolution.bulkWrite(ops);

    // Return the updated map
    const resolutions = await DTRResolution.find({ empId, recordId }).lean();
    const map = {};
    for (const r of resolutions) {
      map[r.dateKey] = {
        _id: r._id,
        timeIn: r.timeIn || "",
        breakOut: r.breakOut || "",
        breakIn: r.breakIn || "",
        timeOut: r.timeOut || "",
        source: r.source,
      };
    }

    res.json({ success: true, data: map, count: entries.length });
  } catch (err) {
    console.error("bulkSaveResolutions error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * DELETE /dtr-resolutions/:id
 * Remove a saved resolution.
 */
export const deleteResolution = async (req, res) => {
  try {
    const { id } = req.params;
    await DTRResolution.findByIdAndDelete(id);
    res.json({ success: true, message: "Resolution removed" });
  } catch (err) {
    console.error("deleteResolution error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
