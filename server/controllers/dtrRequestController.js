import DTRRequest from "../models/DTRRequest.js";
import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import dayjs from "dayjs";
import { getSocketInstance } from "../socket.js";

const resolveAcNosForEmployee = async (employeeId) => {
  // Try by empId first
  const emp = await Employee.findOne({ empId: employeeId }).lean();
  const candidates = [];
  if (emp) {
    const base = (emp.empId || "").replace(/\D/g, "").replace(/^0+/, "");
    if (base) candidates.push(base);
    (emp.alternateEmpIds || []).forEach((id) => {
      const clean = (id || "").replace(/\D/g, "").replace(/^0+/, "");
      if (clean) candidates.push(clean);
    });
  }
  // Fallback: treat employeeId as AC-No directly
  if (!candidates.length) {
    const clean = (employeeId || "").replace(/\D/g, "").replace(/^0+/, "");
    if (clean) candidates.push(clean);
  }
  return [...new Set(candidates)].filter(Boolean);
};

export const checkDTRExistsForRange = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "employeeId, startDate and endDate are required" });
    }

    const acNos = await resolveAcNosForEmployee(employeeId);
    if (!acNos.length) return res.json({ success: true, data: { available: false } });

    const start = dayjs(startDate).startOf("day").toDate();
    const end = dayjs(endDate).endOf("day").toDate();

    const count = await DTRLog.countDocuments({
      normalizedAcNo: { $in: acNos },
      Time: { $gte: start, $lte: end },
    });

    return res.json({ success: true, data: { available: count > 0, total: count } });
  } catch (err) {
    console.error("checkDTRExistsForRange error:", err);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const createDTRRequest = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, email } = req.body;
    if (!employeeId || !startDate || !endDate || !email) {
      return res.status(400).json({ success: false, message: "employeeId, startDate, endDate and email are required" });
    }

    // Validate biometrics exist in the given range
    const acNos = await resolveAcNosForEmployee(employeeId);
    const start = dayjs(startDate).startOf("day").toDate();
    const end = dayjs(endDate).endOf("day").toDate();
    const exists = await DTRLog.exists({ normalizedAcNo: { $in: acNos }, Time: { $gte: start, $lte: end } });
    if (!exists) {
      return res.status(400).json({ success: false, message: "DTR for that cut off is not yet available." });
    }

    const request = await DTRRequest.create({ employeeId, startDate: start, endDate: end, email });

    const io = getSocketInstance();
    if (io) {
      io.emit("newNotification", {
        type: "DTRRequest",
        data: request,
      });
    }

    return res.status(201).json({ success: true, data: request });
  } catch (err) {
    console.error("createDTRRequest error:", err);
    return res.status(500).json({ success: false, message: "Failed to create DTR request" });
  }
};

export const getDTRRequests = async (req, res) => {
  try {
    const items = await DTRRequest.find().sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    console.error("getDTRRequests error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch DTR requests" });
  }
};
