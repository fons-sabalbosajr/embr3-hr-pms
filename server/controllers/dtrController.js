import dayjs from "dayjs";
import mongoose from "mongoose";
import DTRData from "../models/DTRData.js";
import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import DTRGenerationLog from "../models/DTRGenerationLog.js";
import { getSocketInstance } from "../socket.js";


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

    // 🔹 Map state → human-readable
    const mappedLogs = logs.map((log) => {
      let stateLabel;
      switch (log.State) {
        case "C/In": stateLabel = "Time In"; break;
        case "C/Out": stateLabel = "Time Out"; break;
        case "Out": stateLabel = "Break Out"; break;
        case "Out Back": stateLabel = "Break In"; break;
        case "Overtime In": stateLabel = "OT In"; break;
        case "Overtime Out": stateLabel = "OT Out"; break;
        default: stateLabel = log.State;
      }

      return {
        acNo: log["AC-No"] || "-",
        name: log.Name,
        time: log.Time,
        state: stateLabel,
      };
    });

    // 🔹 Enrich with Employee data and group logs
    const employeeMap = new Map();
    const employees = await Employee.find({}).lean();
    for (const emp of employees) {
      const normalizedEmpId = (emp.empId || "").replace(/-/g, "").replace(/^0+/, "");
      if (normalizedEmpId) {
        employeeMap.set(normalizedEmpId, emp);
      }
    }

    const grouped = {};
    mappedLogs.forEach((log) => {
      // Normalize AC-No and try to match employees. Accept both dashed and non-dashed formats.
      if (!log.acNo) return;
      const normalizedAcNo = String(log.acNo).replace(/-/g, "").replace(/^0+/, "");
      if (!normalizedAcNo) return;
      const employee = employeeMap.get(normalizedAcNo);

      if (employee) { // Only process logs that have a matching employee
        const dateKey = dayjs(log.time).format("YYYY-MM-DD");
        const key = `${log.acNo}-${dateKey}`;

        if (!grouped[key]) {
          grouped[key] = {
            empId: employee.empId,
            name: employee.name,
            position: employee.position || "N/A",
            sectionOrUnit: employee.sectionOrUnit || "N/A",
            division: employee.division || "N/A",
            acNo: log.acNo,
            date: dateKey,
            timeIn: "---",
            breakOut: "---",
            breakIn: "---",
            timeOut: "---",
            otIn: "---",
            otOut: "---",
          };
        }

        switch (log.state) {
          case "Time In":
            if (grouped[key].timeIn === "---") grouped[key].timeIn = log.time;
            break;
          case "Break Out":
            if (grouped[key].breakOut === "---") grouped[key].breakOut = log.time;
            break;
          case "Break In":
            grouped[key].breakIn = log.time; // last one wins
            break;
          case "Time Out":
            grouped[key].timeOut = log.time; // last one wins
            break;
          case "OT In":
            if (grouped[key].otIn === "---") grouped[key].otIn = log.time;
            break;
          case "OT Out":
            grouped[key].otOut = log.time; // last one wins
            break;
        }
      }
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

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getAttendance:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getLogsByAcNo = async (req, res) => {
  try {
    const { acNo, acNos, startDate, endDate } = req.query;

    // Allow single acNo or multiple via acNos (comma-separated or repeated param)
    let acList = [];
    if (acNos) {
      if (Array.isArray(acNos)) acList = acNos;
      else acList = String(acNos).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (acNo) {
      acList = String(acNo).split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (!acList.length) return res.status(400).json({ success: false, message: 'acNo or acNos is required' });

    const filter = { 'AC-No': { $in: acList } };
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
