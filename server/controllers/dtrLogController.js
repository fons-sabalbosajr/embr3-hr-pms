import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import DTRData from "../models/DTRData.js";
import dayjs from "dayjs";
import mongoose from "mongoose";
import User from "../models/User.js";

export const getMergedDTRLogs = async (req, res) => {
  try {
    const { recordName, acNo, startDate, endDate, names, empIds, q } = req.query;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 500);

    // Helper normalizers
    const normalizeDigits = (v) => (v ? String(v).replace(/\D/g, "").replace(/^0+/, "") : "");
    const normalizeText = (s) => {
      if (!s) return "";
      let t = String(s).toLowerCase().trim();
      if (t.includes(",")) {
        const parts = t.split(",");
        const left = parts.shift().trim();
        const right = parts.join(" ").trim();
        t = (right + " " + left).trim();
      }
      t = t.replace(/\b(jr|sr|ii|iii|iv|jr\.|sr\.)\b/g, " ");
      t = t.replace(/[^a-z0-9\s]/g, " ");
      return t.replace(/\s+/g, " ").trim();
    };

  const filter = {};

    // Restrict by DTR Data record if provided
    if (recordName) {
      const matchedRecords = await DTRData.find({ DTR_Record_Name: recordName }).select("_id");
      if (matchedRecords.length) {
        filter.DTR_ID = { $in: matchedRecords.map((r) => r._id) };
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    // Restrict by date range first to keep dataset small
    if (startDate || endDate) {
      filter.Time = {};
      if (startDate) filter.Time.$gte = dayjs(startDate).startOf("day").toDate();
      if (endDate) filter.Time.$lte = dayjs(endDate).endOf("day").toDate();
    }

    // Build robust target sets from query
    const employees = await Employee.find().lean();
    const nameList = (names ? String(names).split(",") : [])
      .map((n) => n && n.trim())
      .filter(Boolean);
    const empIdList = (empIds ? String(empIds).split(",") : [])
      .map((e) => e && e.trim())
      .filter(Boolean);
    const acNoList = (acNo ? String(acNo).split(",") : [])
      .map((a) => a && a.trim())
      .filter(Boolean);

    // Quick query 'q' support: if provided, push into name list and digits candidates
    if (q && String(q).trim().length > 0) {
      const qStr = String(q).trim();
      nameList.push(qStr);
      const qDigits = normalizeDigits(qStr);
      if (qDigits) {
        // include digits into acNo candidates
        acNoList.push(qDigits);
      }
    }

    const allowedDigits = new Set();
    const rawAcNoCandidates = new Set();
    // From acNo query
    acNoList.forEach((a) => {
      const d = normalizeDigits(a);
      if (d) allowedDigits.add(d);
      if (a) rawAcNoCandidates.add(String(a));
    });
    // From empIds
    if (empIdList.length) {
      empIdList.forEach((eid) => {
        const emp = employees.find((e) => e.empId === eid);
        if (emp) {
          [emp.empId, ...(emp.alternateEmpIds || []), emp.empNo]
            .filter(Boolean)
            .map(normalizeDigits)
            .forEach((d) => d && allowedDigits.add(d));
          // Also allow raw forms exactly as stored in some biometric systems
          [emp.empId, ...(emp.alternateEmpIds || []), emp.empNo]
            .filter(Boolean)
            .forEach((v) => rawAcNoCandidates.add(String(v)));
        }
      });
    }
    // From names
    if (nameList.length) {
      const normTargets = nameList.map((n) => normalizeText(n));
      const targetEmps = employees.filter((e) => {
        const en = normalizeText(e.name);
        return en && normTargets.some((t) => en.includes(t) || t.includes(en));
      });
      targetEmps.forEach((emp) => {
        [emp.empId, ...(emp.alternateEmpIds || []), emp.empNo]
          .filter(Boolean)
          .map(normalizeDigits)
          .forEach((d) => d && allowedDigits.add(d));
      });
    }

    // When we have targets, prefer an $or on normalizedAcNo and (fallback) Name regex
    const or = [];
    if (allowedDigits.size > 0) {
      or.push({ normalizedAcNo: { $in: Array.from(allowedDigits) } });
      // Fallback for legacy logs without normalizedAcNo
      or.push({ "AC-No": { $in: Array.from(allowedDigits) } });
    }
    if (nameList.length > 0) {
      const nameRegex = nameList.map((n) => new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
      or.push({ Name: { $in: nameRegex } });
    }
    if (rawAcNoCandidates.size > 0) {
      or.push({ "AC-No": { $in: Array.from(rawAcNoCandidates) } });
    }
    if (or.length > 0) {
      filter.$or = or;
    } else if (acNoList.length > 0) {
      // Fallback to raw AC-No list if provided and no digits
      filter["AC-No"] = { $in: acNoList };
    }

    // Count total BEFORE pagination
    const total = await DTRLog.countDocuments(filter);

    // Query DTRLogs, sort ascending by time with pagination
    const logs = await DTRLog.find(filter)
      .populate("DTR_ID", "DTR_Record_Name")
      .sort({ Time: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Map logs → include matched employee via robust rules
    const mergedData = logs.map((log, index) => {
      const acNoRaw = log["AC-No"] || "";
      const acNoDigits = normalizeDigits(acNoRaw);
      const logNameNorm = normalizeText(log.Name);

      let matchedEmployee = null;

      if (logNameNorm) {
        matchedEmployee = employees.find((emp) => {
          const en = normalizeText(emp.name);
          return en && (en.includes(logNameNorm) || logNameNorm.includes(en));
        });
      }

      if (!matchedEmployee && acNoDigits) {
        matchedEmployee = employees.find((emp) => {
          const idDigits = [emp.empId, ...(emp.alternateEmpIds || []), emp.empNo]
            .filter(Boolean)
            .map(normalizeDigits)
            .filter(Boolean);
          return idDigits.some((d) => d.includes(acNoDigits) || acNoDigits.includes(d));
        });
      }

      return {
        no: index + 1,
        time: log.Time,
        state: log.State,
        acNo: log["AC-No"] || "-",
        name: log.Name,
        employeeName: matchedEmployee ? matchedEmployee.name : "Unknown Employee",
        empId: matchedEmployee ? matchedEmployee.empId : null,
        newState: log["New State"],
        newStateEmployeeName: matchedEmployee ? matchedEmployee.name : "Unknown Employee",
        DTR_Record_Name: log.DTR_ID?.DTR_Record_Name || null,
      };
    });

    res.json({ success: true, data: mergedData, page, limit, total });
  } catch (error) {
    console.error("Error merging DTR logs:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getWorkCalendarLogs = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const filter = {};

    // 🔹 Employee resolution
    if (employeeId) {
      let acNos = [];

      // Case 1: If employeeId is a MongoDB ObjectId → fetch employee
      if (mongoose.Types.ObjectId.isValid(employeeId)) {
        const emp = await Employee.findById(employeeId).lean();
        if (emp) {
          acNos = [
            emp.empId.replace(/\D/g, ""), // normalize "03-946" → "3946"
            ...(emp.alternateEmpIds || []).map(id => id.replace(/\D/g, ""))
          ];
        }
      }

      // Case 2: If employeeId looks like "03-946" (empId format)
      if (!acNos.length && /\d{2,}-\d{2,}/.test(employeeId)) {
        const emp = await Employee.findOne({ empId: employeeId }).lean();
        if (emp) {
          acNos = [
            emp.empId.replace(/\D/g, ""),
            ...(emp.alternateEmpIds || []).map(id => id.replace(/\D/g, ""))
          ];
        }
      }

      // Case 3: Otherwise assume it's an AC-No already ("3946")
      if (!acNos.length) {
        acNos = [employeeId.replace(/\D/g, "")];
      }

      filter["AC-No"] = { $in: acNos };
    }

    // 🔹 Date filtering
    if (startDate || endDate) {
      filter.Time = {};
      if (startDate) filter.Time.$gte = dayjs(startDate).startOf("day").toDate();
      if (endDate) filter.Time.$lte = dayjs(endDate).endOf("day").toDate();
    }

    // 🔹 Fetch logs
    const logs = await DTRLog.find(filter).sort({ Time: 1 }).lean();

    // 🔹 Map State → human-readable
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
        id: log._id,
        acNo: log["AC-No"] || "-",
        name: log.Name,
        time: log.Time,
        state: stateLabel,
      };
    });

    res.json({ success: true, data: mappedLogs });
  } catch (error) {
    console.error("Error in getWorkCalendarLogs:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const markDTRLogAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await DTRLog.findById(id);

    if (!log) {
      return res.status(404).json({ success: false, message: "Log not found" });
    }

    log.read = true;
    await log.save();

    res.json({ success: true, data: log });
  } catch (error) {
    console.error("Error marking log as read:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const markAllDTRLogsAsRead = async (req, res) => {
  try {
    await DTRLog.updateMany({}, { $set: { read: true } });
    res.json({ success: true, message: "All logs marked as read" });
  } catch (error) {
    console.error("Error marking all logs as read:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const deleteDTRLog = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller || !(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev || caller.canManipulateBiometrics || caller.userType === 'developer')) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions to delete dtr log' });
    }

    const { id } = req.params;
    const deleted = await DTRLog.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete dtr log' });
  }
};

// Update DTR log (supports toggling 'hidden')
export const updateDTRLog = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    let caller = null;
    if (callerId) caller = await User.findById(callerId);
    if (!caller && req.user && typeof req.user === 'object') caller = req.user;
    if (!caller) {
      console.warn('updateDTRLog: no caller resolved', { callerId, tokenPayload: req.user });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

  const allowedToManage = !!(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev || caller.canManipulateBiometrics || caller.userType === 'developer');
    if (!allowedToManage) {
      console.warn('updateDTRLog: permission denied', { callerId, caller: { id: caller._id || caller.id, isAdmin: caller.isAdmin, canManageNotifications: caller.canManageNotifications, canAccessNotifications: caller.canAccessNotifications, canSeeDev: caller.canSeeDev, userType: caller.userType } });
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

    const { id } = req.params;
    const body = req.body || {};
    const allowed = ['hidden'];
    const changes = {};
    Object.keys(body).forEach(k => { if (allowed.includes(k)) changes[k] = body[k]; });
    const updated = await DTRLog.findByIdAndUpdate(id, { $set: changes }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update dtr log' });
  }
};