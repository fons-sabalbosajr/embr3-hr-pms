import DTRRequest from "../models/DTRRequest.js";
import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import dayjs from "dayjs";
import { getSocketInstance } from "../socket.js";
import mongoose from "mongoose";

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

    // Use aggregation to normalize raw AC-No dynamically (handles old data without normalizedAcNo)
    const pipeline = [
      { $match: { Time: { $gte: start, $lte: end } } },
      {
        $addFields: {
          normalizedRaw: {
            $regexReplace: {
              input: { $ifNull: ["$AC-No", ""] },
              regex: /\D/g,
              replacement: "",
            },
          },
        },
      },
      {
        $addFields: {
          normalizedRaw: {
            $regexReplace: {
              input: "$normalizedRaw",
              regex: /^0+/,
              replacement: "",
            },
          },
        },
      },
      {
        $match: {
          $or: [
            { normalizedAcNo: { $in: acNos } },
            { normalizedRaw: { $in: acNos } },
          ],
        },
      },
      { $limit: 1 },
    ];

    const sample = await DTRLog.aggregate(pipeline).exec();
    const count = sample.length;

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

    const pipeline = [];
    if (start && end) pipeline.push({ $match: { Time: { $gte: start, $lte: end } } });
    pipeline.push({
      $addFields: {
        normalizedRaw: {
          $regexReplace: {
            input: { $ifNull: ["$AC-No", ""] },
            regex: /\D/g,
            replacement: "",
          },
        },
      },
    });
    pipeline.push({
      $addFields: {
        normalizedRaw: {
          $regexReplace: { input: "$normalizedRaw", regex: /^0+/, replacement: "" },
        },
      },
    });
    pipeline.push({ $project: { _id: 0, Time: 1, ACNo: "$AC-No", normalizedAcNo: 1, normalizedRaw: 1 } });
    pipeline.push({ $limit: 50 });

    const sample = await DTRLog.aggregate(pipeline).exec();
    res.json({ success: true, data: { acNos, sample } });
  } catch (err) {
    console.error("debugResolveDTR error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
