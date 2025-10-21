import DTRRequest from "../models/DTRRequest.js";
import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import dayjs from "dayjs";
import { getSocketInstance } from "../socket.js";
import mongoose from "mongoose";

// Build a tolerant regex that matches AC-No with optional non-digits and leading zeros
// Example: digits "3946" -> /^0*\D*3\D*9\D*4\D*6\D*$/i which matches "03-946", "0003 9 4 6", etc.
const buildLooseAcNoRegex = (digits) => {
  const seq = String(digits || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!seq) return null;
  const parts = seq.split("").map((ch) => `\\D*${ch}`);
  return new RegExp(`^0*${parts.join("")}\\D*$`, "i");
};

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

    // Query using normalizedAcNo or a tolerant regex on raw AC-No
    const orConds = [{ normalizedAcNo: { $in: acNos } }];
    acNos.forEach((d) => {
      const rx = buildLooseAcNoRegex(d);
      if (rx) orConds.push({ "AC-No": { $regex: rx } });
    });
    const count = await DTRLog.countDocuments({ Time: { $gte: start, $lte: end }, $or: orConds });

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
  const exists = count > 0;
    if (!exists) {
      return res.status(400).json({ success: false, message: "DTR for that cut off is not yet available." });
    }

    const request = await DTRRequest.create({ employeeId, startDate: start, endDate: end, email });

    const io = getSocketInstance();
    if (io) {
      const payload = { ...request.toObject(), type: "DTRRequest" };
      io.emit("newNotification", payload);
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

// Optional: debug endpoint to inspect resolution and matching
export const debugResolveDTR = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const acNos = await resolveAcNosForEmployee(employeeId || "");
    const start = startDate ? dayjs(startDate).startOf("day").toDate() : null;
    const end = endDate ? dayjs(endDate).endOf("day").toDate() : null;

    const match = start && end ? { Time: { $gte: start, $lte: end } } : {};
    const sampleDocs = await DTRLog.find(match).sort({ Time: 1 }).limit(50).lean();
    const sample = sampleDocs.map((doc) => ({
      Time: doc.Time,
      ACNo: doc["AC-No"],
      normalizedAcNo: doc.normalizedAcNo,
      normalizedRaw: String(doc["AC-No"] || "").replace(/\D/g, "").replace(/^0+/, ""),
    }));
    res.json({ success: true, data: { acNos, sample } });
  } catch (err) {
    console.error("debugResolveDTR error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
