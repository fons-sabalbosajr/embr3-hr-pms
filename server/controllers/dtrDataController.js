import DTRData from "../models/DTRData.js";
import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import mongoose from "mongoose";
import User from "../models/User.js";

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

// In-memory progress store for delete jobs (simple, cleared on restart)
const deleteJobs = new Map();

export const deleteDTRDataJob = async (req, res) => {
  try {
    const { id } = req.params;

    // Basic permission check (caller must be developer or have Edit Time Records)
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller) {
      return res.status(403).json({ success: false, message: 'Forbidden: user context missing' });
    }
    if (!(caller.userType === 'developer' || caller.canManipulateBiometrics)) {
      return res.status(403).json({ success: false, message: 'Forbidden: only developers or users with Edit Time Records permission can delete records' });
    }

    // Verify record exists
    const record = await DTRData.findById(id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    deleteJobs.set(jobId, { status: 'queued', total: 0, deleted: 0, recordId: id });

    // Start background task (do not await)
    (async () => {
      try {
        deleteJobs.set(jobId, { status: 'running', total: 0, deleted: 0, recordId: id });

        const objectId = new mongoose.Types.ObjectId(id);

        // Build filter: logs linked to THIS DTR record, narrowed by cut-off dates.
        // Only logs whose Time falls within the cut-off range are deleted.
        const combinedFilter = { DTR_ID: objectId };
        if (record.DTR_Cut_Off?.start && record.DTR_Cut_Off?.end) {
          const start = parseInLocalTz(record.DTR_Cut_Off.start).startOf("day").toDate();
          const end = parseInLocalTz(record.DTR_Cut_Off.end).endOf("day").toDate();
          combinedFilter.Time = { $gte: start, $lte: end };
        }

        // Count total logs to delete
        const total = await DTRLog.countDocuments(combinedFilter);
        deleteJobs.set(jobId, { status: 'running', total, deleted: 0, recordId: id });

        const batchSize = 500;
        let deleted = 0;

        while (true) {
          // fetch a batch of ids
          const docs = await DTRLog.find(combinedFilter).select('_id').limit(batchSize).lean();
          if (!docs || docs.length === 0) break;
          const ids = docs.map(d => d._id);
          const del = await DTRLog.deleteMany({ _id: { $in: ids } });
          deleted += del.deletedCount || ids.length;
          deleteJobs.set(jobId, { status: 'running', total, deleted, recordId: id });
        }

        // Finally remove the DTRData record itself
        await DTRData.findByIdAndDelete(id);

        deleteJobs.set(jobId, { status: 'done', total, deleted, recordId: id });
        // expire job after short time
        setTimeout(() => deleteJobs.delete(jobId), 1000 * 60 * 5);
      } catch (e) {
        deleteJobs.set(jobId, { status: 'error', message: String(e), recordId: id });
        setTimeout(() => deleteJobs.delete(jobId), 1000 * 60 * 5);
      }
    })();

    return res.json({ success: true, jobId });
  } catch (err) {
    console.error('deleteDTRDataJob error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getDeleteJobProgress = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ success: false, message: 'jobId required' });
    const p = deleteJobs.get(jobId);
    if (!p) return res.status(404).json({ success: false, message: 'Job not found' });
    return res.json({ success: true, data: p });
  } catch (err) {
    console.error('getDeleteJobProgress error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getDTRDataList = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    let haveRange = false;
    if (startDate && endDate) {
      const start = parseInLocalTz(startDate).startOf("day");
      const end = parseInLocalTz(endDate).endOf("day");
      if (start.isValid() && end.isValid()) {
        // Overlap logic: record.start <= end AND record.end >= start
        filter["DTR_Cut_Off.start"] = { $lte: end.toDate() };
        filter["DTR_Cut_Off.end"] = { $gte: start.toDate() };
        haveRange = true;
      }
    }

    const query = DTRData.find(filter, "DTR_Record_Name DTR_Cut_Off Uploaded_By Uploaded_Date")
      .sort({ "DTR_Cut_Off.start": -1, createdAt: -1 });
    const records = await query.lean();

    res.json({
      success: true,
      data: records,
      filtered: haveRange,
      startDate: haveRange ? startDate : undefined,
      endDate: haveRange ? endDate : undefined,
      count: records.length,
    });
  } catch (error) {
    console.error("Error fetching DTRData list:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const checkDTRData = async (req, res) => {
  try {
    const { startDate, endDate, empId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate and endDate are required" });
    }

    const start = parseInLocalTz(startDate).startOf("day");
    const end = parseInLocalTz(endDate).endOf("day");

    // Find any records that overlap with the requested range
    const overlappingRecords = await DTRData.find({
      "DTR_Cut_Off.start": { $lte: end.toDate() },
      "DTR_Cut_Off.end": { $gte: start.toDate() },
    })
      .sort({ "DTR_Cut_Off.start": 1 })
      .lean();
    const hasAnyDTRData = !!(overlappingRecords && overlappingRecords.length > 0);

    // Determine if the overlapping records fully cover the requested range (without gaps)
    // We scan from the earliest overlapping cutoff and extend a contiguous coverage window.
    let fullyCovered = false;
    let coveredUntil = null; // end of the currently merged contiguous interval

    if (hasAnyDTRData) for (const r of overlappingRecords) {
      const rStart = parseInLocalTz(r?.DTR_Cut_Off?.start).startOf("day");
      const rEnd = parseInLocalTz(r?.DTR_Cut_Off?.end).endOf("day");

      // Skip records that end before our requested start
      if (rEnd.isBefore(start)) continue;
      // If we don't have a coverage chain yet, it must begin on/before the requested start
      if (coveredUntil === null) {
        if (rStart.isAfter(start)) {
          // The first candidate begins after the requested start -> gap
          break;
        }
        coveredUntil = rEnd;
      } else {
        // For contiguous coverage, the next interval must start on/before coveredUntil + 1 day
        if (rStart.isAfter(coveredUntil.add(1, "day"))) {
          // gap
          break;
        }
        if (rEnd.isAfter(coveredUntil)) {
          coveredUntil = rEnd;
        }
      }

      if (coveredUntil.isAfter(end) || coveredUntil.isSame(end)) {
        fullyCovered = true;
        break;
      }
    }

    // Backward-compat: select a primary record.
    // Prefer a record that contains the start of the requested range; otherwise first overlapping.
    const containingStart = (overlappingRecords || []).find((r) => {
      const s = parseInLocalTz(r?.DTR_Cut_Off?.start).startOf("day");
      const e = parseInLocalTz(r?.DTR_Cut_Off?.end).endOf("day");
      const startsBeforeOrSame = s.isBefore(start) || s.isSame(start);
      const endsAfterOrSame = e.isAfter(start) || e.isSame(start);
      return startsBeforeOrSame && endsAfterOrSame;
    });
    const primary = containingStart || (overlappingRecords && overlappingRecords[0]) || null;

    // Optional: determine if there are any logs for the employee within range
    let hasLogs = false;
    if (empId) {
      try {
        const employees = await Employee.find().lean();
        const target = employees.find((e) => e.empId === empId);
        const normalizedDigits = new Set();
        if (target) {
          [target.empId, ...(target.alternateEmpIds || []), target.empNo]
            .filter(Boolean)
            .map((v) => String(v).replace(/\D/g, "").replace(/^0+/, ""))
            .forEach((d) => d && normalizedDigits.add(d));
        } else {
          // Fallback: treat given empId as digits directly
          const d = String(empId).replace(/\D/g, "").replace(/^0+/, "");
          if (d) normalizedDigits.add(d);
        }

        const logFilter = {
          Time: { $gte: start.toDate(), $lte: end.toDate() },
        };
        if (normalizedDigits.size > 0) {
          logFilter.normalizedAcNo = { $in: Array.from(normalizedDigits) };
        }

        const sample = await DTRLog.findOne(logFilter).select("_id");
        hasLogs = !!sample;
      } catch (_) {
        // keep hasLogs=false on errors
      }
    }

    // Availability: true if we have any overlapping DTRData OR there are DTR logs for the employee
    const available = hasAnyDTRData || hasLogs;

    return res.json({
      success: true,
      data: {
        available,
        record: primary,
        records: overlappingRecords,
        fullyCovered,
        hasLogs,
      },
    });
  } catch (error) {
    console.error("Error checking DTRData:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// controllers/dtrDataController.js
export const updateDTRData = async (req, res) => {
  try {
    const { id } = req.params;
    const { DTR_Record_Name, DTR_Cut_Off } = req.body;

    // Permission check (caller must be developer or have Edit Time Records)
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller) {
      return res.status(403).json({ success: false, message: 'Forbidden: user context missing' });
    }
    if (!(caller.userType === 'developer' || caller.canManipulateBiometrics)) {
      return res.status(403).json({ success: false, message: 'Forbidden: only developers or users with Edit Time Records permission can edit records' });
    }

    const record = await DTRData.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    if (DTR_Record_Name) record.DTR_Record_Name = DTR_Record_Name;
    if (DTR_Cut_Off) {
      record.DTR_Cut_Off = {
        start: DTR_Cut_Off.start ? new Date(DTR_Cut_Off.start) : record.DTR_Cut_Off.start,
        end: DTR_Cut_Off.end ? new Date(DTR_Cut_Off.end) : record.DTR_Cut_Off.end,
      };
    }

    await record.save();
    res.json({ success: true, data: record });
  } catch (err) {
    console.error("updateDTRData error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
