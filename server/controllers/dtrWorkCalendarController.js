// controllers/dtrWorkCalendarController.js
import DTRLog from "../models/DTRLog.js";
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

export const getWorkCalendar = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query; // accept optional date range

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Missing required query parameters",
      });
    }

    //console.log("Incoming request for employeeId:", employeeId);

    // Resolve employee by empId first, fallback to _id if provided
    const normalizeDigits = (v) => (v ? String(v).replace(/\D/g, "").replace(/^0+/, "") : "");
    let employee = await Employee.findOne({ empId: employeeId }).lean();
    if (!employee && /^[a-fA-F0-9]{24}$/.test(String(employeeId))) {
      const byId = await Employee.findById(employeeId).lean();
      if (byId) employee = byId;
    }

    // Build robust AC-No candidates
    const allowedDigits = new Set();
    const pushed = (v) => { const d = normalizeDigits(v); if (d) allowedDigits.add(d); };
    pushed(employeeId);
    if (employee) {
      pushed(employee.empId);
      pushed(employee.empNo);
      (employee.alternateEmpIds || []).forEach(pushed);
    }

    const orConds = [];
    if (allowedDigits.size) {
      const list = Array.from(allowedDigits);
      orConds.push({ normalizedAcNo: { $in: list } });
      orConds.push({ "AC-No": { $in: list } }); // fallback for legacy logs
    }

    const filter = orConds.length ? { $or: orConds } : {};
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

    const logs = await DTRLog.find(filter).sort({ Time: 1 });

    //console.log(`Found ${logs.length} logs for AC-No ${mappedACNo}`);

    const formattedLogs = logs.map((log) => ({
      id: log._id,
      time: log.Time,
      state: log.State,
      ACNo: log["AC-No"],
      Name: log.Name,
    }));

    //console.log("Formatted logs to return:", formattedLogs);

    res.json({ success: true, data: formattedLogs });
  } catch (error) {
    console.error("getWorkCalendar error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching work calendar logs",
    });
  }
};
