import DTRData from "../models/DTRData.js";
import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import dayjs from "dayjs";
import mongoose from "mongoose";
import User from "../models/User.js";

// In-memory progress store for delete jobs (simple, cleared on restart)
const deleteJobs = new Map();

export const deleteDTRDataJob = async (req, res) => {
  try {
    const { id } = req.params;

    // Basic permission check (caller must be admin or developer-ish)
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller || !(caller.isAdmin || caller.userType === 'developer' || caller.canManipulateBiometrics)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
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

        // Count total logs linked to this DTRData
        const total = await DTRLog.countDocuments({ DTR_ID: mongoose.Types.ObjectId(id) });
        deleteJobs.set(jobId, { status: 'running', total, deleted: 0, recordId: id });

        const batchSize = 500;
        let deleted = 0;

        while (true) {
          // fetch a batch of ids
          const docs = await DTRLog.find({ DTR_ID: mongoose.Types.ObjectId(id) }).select('_id').limit(batchSize).lean();
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
      const start = dayjs(startDate).startOf("day");
      const end = dayjs(endDate).endOf("day");
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

    const start = dayjs(startDate).startOf("day");
    const end = dayjs(endDate).endOf("day");

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
      const rStart = dayjs(r?.DTR_Cut_Off?.start).startOf("day");
      const rEnd = dayjs(r?.DTR_Cut_Off?.end).endOf("day");

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
      const s = dayjs(r?.DTR_Cut_Off?.start).startOf("day");
      const e = dayjs(r?.DTR_Cut_Off?.end).endOf("day");
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