import dayjs from "dayjs";
import mongoose from "mongoose";
import DTRData from "../models/DTRData.js";
import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import DTRGenerationLog from "../models/DTRGenerationLog.js";
import { getSocketInstance } from "../socket.js";
import { resolveTimePunches } from "../utils/resolveTimePunches.js";


export const uploadDTR = async (req, res) => {
  try {
    const { recordName, cutOffStart, cutOffEnd, userId, uploadedBy, logs } =
      req.body;

    // Create DTRData header
    const header = await DTRData.create({
      DTR_Record_Name: recordName,
      DTR_Cut_Off: {
        start: new Date(cutOffStart),
        end: new Date(cutOffEnd),
      },
      Uploaded_By: userId,
      Uploaded_By_Name: uploadedBy,
      Uploaded_Date: new Date(),
    });

    // Prepare logs: convert Time strings to Date and add DTR_ID
    const logDocs = logs.map((log) => ({
      ...log,
      Time: log.Time ? new Date(log.Time) : null,
      DTR_ID: header._id,
    }));

    // Bulk insert with ordered:false to skip duplicates (requires unique index on Name+Time)
    await DTRLog.insertMany(logDocs, { ordered: false });

    res.status(200).json({ message: "DTR and logs uploaded successfully" });
  } catch (error) {
    // Handle duplicate errors gracefully if possible
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(409)
        .json({ message: "Duplicate entries detected and skipped." });
    }
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to upload DTR", error: error.message });
  }
};

export const getRecentAttendance = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const filter = {};
    // If startDate/endDate provided, use them; otherwise use latest day
    if (startDate && endDate) {
      filter.Time = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else {
      // Find the latest date from DTRLog collection
      const latestLog = await DTRLog.findOne().sort({ Time: -1 }).lean();
      if (!latestLog) {
        return res.json({ success: true, data: [] }); // No logs, return empty
      }
      const latestDate = dayjs(latestLog.Time);

      // Set filter to only use the latest date
      filter.Time = {
        $gte: latestDate.startOf("day").toDate(),
        $lte: latestDate.endOf("day").toDate(),
      };
    }

    // 🔹 Employee resolution (same as getWorkCalendarLogs)
    if (employeeId) {
      let acNos = [];

      if (mongoose.Types.ObjectId.isValid(employeeId)) {
        const emp = await Employee.findById(employeeId).lean();
        if (emp) {
          acNos = [
            emp.empId.replace(/\D/g, ""),
            ...(emp.alternateEmpIds || []).map((id) => id.replace(/\D/g, "")),
          ];
        }
      }

      if (!acNos.length && /\d{2,}-\d{2,}/.test(employeeId)) {
        const emp = await Employee.findOne({ empId: employeeId }).lean();
        if (emp) {
          acNos = [
            emp.empId.replace(/\D/g, ""),
            ...(emp.alternateEmpIds || []).map((id) => id.replace(/\D/g, "")),
          ];
        }
      }

      if (!acNos.length) {
        acNos = [employeeId.replace(/\D/g, "")];
      }

      filter["AC-No"] = { $in: acNos };
    }

    // 🔹 Fetch logs
    const logs = await DTRLog.find(filter).sort({ Time: 1 }).lean();

    // 🔹 Enrich with Employee data and group raw logs by employee+date
    const employeeMap = new Map();
    const employees = await Employee.find({}).lean();
    for (const emp of employees) {
      // Map primary empId (strip ALL non-digits + leading zeros for consistency with DTRLog.normalizedAcNo)
      const normalizedEmpId = (emp.empId || "").replace(/\D/g, "").replace(/^0+/, "");
      if (normalizedEmpId) {
        employeeMap.set(normalizedEmpId, emp);
      }
      // Also map alternateEmpIds so biometric AC-Nos stored as alternates are matched
      if (Array.isArray(emp.alternateEmpIds)) {
        for (const altId of emp.alternateEmpIds) {
          const normalizedAlt = String(altId).replace(/\D/g, "").replace(/^0+/, "");
          if (normalizedAlt && !employeeMap.has(normalizedAlt)) {
            employeeMap.set(normalizedAlt, emp);
          }
        }
      }
    }

    // Collect raw logs per employee-date key
    const rawLogCount = logs.length;
    let matchedLogCount = 0;
    const unmatchedAcNos = new Set();
    const rawByKey = {};
    logs.forEach((log) => {
      const acNo = log["AC-No"] || "-";
      if (!acNo || acNo === "-") return;
      const normalizedAcNo = String(acNo).replace(/\D/g, "").replace(/^0+/, "");
      if (!normalizedAcNo) return;
      const employee = employeeMap.get(normalizedAcNo);
      if (!employee) {
        unmatchedAcNos.add(acNo);
        return;
      }
      matchedLogCount++;

      const dateKey = dayjs(log.Time).format("YYYY-MM-DD");
      const key = `${acNo}-${dateKey}`;

      if (!rawByKey[key]) {
        rawByKey[key] = {
          employee,
          acNo,
          dateKey,
          logs: [],
        };
      }
      rawByKey[key].logs.push(log);
    });

    // Resolve each day using chronological position-based detection
    const grouped = {};
    Object.entries(rawByKey).forEach(([key, { employee, acNo, dateKey, logs: dayLogs }]) => {
      const resolved = resolveTimePunches(dayLogs);
      grouped[key] = {
        empId: employee.empId,
        name: employee.name,
        position: employee.position || "N/A",
        sectionOrUnit: employee.sectionOrUnit || "N/A",
        division: employee.division || "N/A",
        acNo,
        date: dateKey,
        timeIn: resolved.timeIn || "---",
        breakOut: resolved.breakOut || "---",
        breakIn: resolved.breakIn || "---",
        timeOut: resolved.timeOut || "---",
        otIn: "---",
        otOut: "---",
      };
    });

    let result = Object.values(grouped);
    if (!result.length) {
      console.debug("getRecentAttendance: no grouped rows found for filter", filter);
      return res.json({ success: true, data: [] });
    }

    // Phantom-row verification: by default enabled in non-production or when VERIFY_PHANTOM=true
    const VERIFY_PHANTOM = process.env.VERIFY_PHANTOM
      ? String(process.env.VERIFY_PHANTOM).toLowerCase() === "true"
      : process.env.NODE_ENV !== "production";

    if (VERIFY_PHANTOM) {
      try {
        // Determine overall date window to check (from query params or filter)
        const startDate = req.query.startDate
          ? new Date(req.query.startDate)
          : filter.Time && filter.Time.$gte
          ? filter.Time.$gte
          : null;
        const endDate = req.query.endDate
          ? new Date(req.query.endDate)
          : filter.Time && filter.Time.$lte
          ? filter.Time.$lte
          : null;

        if (startDate && endDate) {
          const acNos = Array.from(new Set(result.map((r) => r.acNo).filter(Boolean)));
          if (acNos.length) {
            // Fetch raw logs once for all AC-No in window
            const raw = await DTRLog.find({
              "AC-No": { $in: acNos },
              Time: { $gte: startDate, $lte: endDate },
            }).lean();

            const presentKeys = new Set();
            raw.forEach((l) => {
              const dateKey = dayjs(l.Time).format("YYYY-MM-DD");
              presentKeys.add(`${l["AC-No"]}-${dateKey}`);
            });

            // Keep only grouped rows that have at least one raw log in that date
            result = result.filter((r) => presentKeys.has(`${r.acNo}-${r.date}`));
          }
        }
      } catch (verifyErr) {
        console.warn("Phantom verification failed, returning unfiltered results", verifyErr);
      }
    }

    res.json({
      success: true,
      data: result,
      meta: {
        rawLogCount,
        matchedLogCount,
        groupedRowCount: result.length,
        unmatchedAcNos: Array.from(unmatchedAcNos),
      },
    });
  } catch (error) {
    console.error("Error in getAttendance:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getLogsByAcNo = async (req, res) => {
  try {
    const { acNo, acNos, empId, startDate, endDate } = req.query;

    // Allow single acNo or multiple via acNos (comma-separated or repeated param)
    let acList = [];
    if (acNos) {
      if (Array.isArray(acNos)) acList = acNos;
      else acList = String(acNos).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (acNo) {
      acList = String(acNo).split(",").map((s) => s.trim()).filter(Boolean);
    }

    // If empId is provided, resolve employee's primary + alternate IDs into acList
    if (empId) {
      const emp = await Employee.findOne({ empId: String(empId).trim() }).lean();
      if (emp) {
        const allIds = [emp.empId, ...(emp.alternateEmpIds || []), emp.empNo]
          .filter(Boolean)
          .map((v) => String(v).replace(/\D/g, "").replace(/^0+/, ""))
          .filter(Boolean);
        acList = [...new Set([...acList, ...allIds])];
      }
    }

    if (!acList.length) return res.status(400).json({ success: false, message: 'acNo, acNos, or empId is required' });

    // Query using both raw AC-No and normalizedAcNo for robustness
    const normalizedList = acList
      .map((v) => String(v).replace(/\D/g, "").replace(/^0+/, ""))
      .filter(Boolean);
    const filterOr = [
      { 'AC-No': { $in: acList } },
    ];
    if (normalizedList.length) {
      filterOr.push({ normalizedAcNo: { $in: normalizedList } });
    }
    const filter = { $or: filterOr };
    if (startDate && endDate) {
      filter.Time = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const logs = await DTRLog.find(filter).sort({ Time: 1 }).lean();

    // If single ac requested, return array; if multiple, return mapping acNo -> logs
    if (acList.length === 1) {
      return res.json({ success: true, data: logs });
    }

    const map = {};
    acList.forEach((a) => (map[a] = []));
    logs.forEach((l) => {
      const a = l['AC-No'];
      if (!map[a]) map[a] = [];
      map[a].push(l);
    });
    res.json({ success: true, data: map });
  } catch (err) {
    console.error('getLogsByAcNo error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const logDTRGeneration = async (req, res) => {
  try {
    const { employeeId, period, generatedBy } = req.body;

    if (!employeeId || !period || !generatedBy) {
      return res.status(400).json({ success: false, message: "employeeId, period, and generatedBy are required" });
    }

    const newLog = await DTRGenerationLog.create({ employeeId, period, generatedBy });

    if (newLog) {
      const io = getSocketInstance();
      if (io) {
        io.emit("newDTRMessage", {
          type: "DTRGeneration",
          data: newLog,
        });
      }
    }

    res.status(201).json({ success: true, data: newLog });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to log DTR generation" });
  }
};
