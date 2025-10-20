import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import DTRData from "../models/DTRData.js";
import dayjs from "dayjs";
import mongoose from "mongoose";
import User from "../models/User.js";

export const getMergedDTRLogs = async (req, res) => {
  try {
    const { recordName, acNo, startDate, endDate, names } = req.query;

    const filter = {};

    // Filter by DTR_Record_Name if provided
    if (recordName) {
      const matchedRecords = await DTRData.find({
        DTR_Record_Name: recordName,
      }).select("_id");

      if (matchedRecords.length) {
        filter.DTR_ID = { $in: matchedRecords.map((r) => r._id) };
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    if (names) {
      const nameList = names.split(",").map((n) => n.trim());
      filter.Name = { $in: nameList.map(name => new RegExp(name, 'i')) };
    } else if (acNo) {
      // split and trim, then regex match each AC-No exactly or by partial digits
      const acNoList = acNo.split(",").map((a) => a.trim());

      // We'll use $or regex match for each AC-No
      filter["AC-No"] = {
        $in: acNoList,
      };
    }

    // Filter by date range on Time field if provided
    if (startDate || endDate) {
      filter.Time = {};
      if (startDate) {
        const start = dayjs(startDate).startOf("day").toDate();
        filter.Time.$gte = start;
      }
      if (endDate) {
        const end = dayjs(endDate).endOf("day").toDate();
        filter.Time.$lte = end;
      }
    }

    // Query DTRLogs with filters, populate DTRData record name, sort ascending by time
    const logs = await DTRLog.find(filter)
      .populate("DTR_ID", "DTR_Record_Name")
      .sort({ Time: 1 })
      .lean();

    const employees = await Employee.find().lean();

    // Map logs to include matched employee info by AC-No partial matching or name
    const mergedData = logs.map((log, index) => {
      const acNoRaw = log["AC-No"] || "";
      const acNoDigits = String(acNoRaw).replace(/\D/g, "");

      let matchedEmployee = null;

      const logName = log.Name?.trim().toLowerCase() || "";
      if (logName) {
        matchedEmployee = employees.find((emp) => {
          const empName = emp.name?.toLowerCase() || "";
          return empName.includes(logName) || logName.includes(empName);
        });
      }

      if (!matchedEmployee && acNoDigits) {
        matchedEmployee = employees.find((emp) => {
          const allIds = [emp.empId, ...(emp.alternateEmpIds || [])].filter(
            Boolean
          );
          const allIdsDigits = allIds.map(id => String(id).replace(/\D/g, ""));
          return allIdsDigits.some(idDigits => idDigits.includes(acNoDigits) || acNoDigits.includes(idDigits));
        });
      }

      return {
        no: index + 1,
        time: log.Time,
        state: log.State,
        acNo: log["AC-No"] || "-",
        name: log.Name,
        employeeName: matchedEmployee
          ? matchedEmployee.name
          : "Unknown Employee",
        empId: matchedEmployee ? matchedEmployee.empId : null,
        newState: log["New State"],
        newStateEmployeeName: matchedEmployee
          ? matchedEmployee.name
          : "Unknown Employee",
        DTR_Record_Name: log.DTR_ID?.DTR_Record_Name || null,
      };
    });

    res.json({ success: true, data: mergedData });
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
    if (!caller || !(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev)) {
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

    const allowedToManage = !!(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev || caller.userType === 'developer');
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