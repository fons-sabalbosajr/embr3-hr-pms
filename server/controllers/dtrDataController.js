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

    const query = DTRData.find(filter, "DTR_Record_Name DTR_Cut_Off Uploaded_By Uploaded_Date isContainer childPeriods hiddenFromDropdown")
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
    if (typeof req.body.hiddenFromDropdown === 'boolean') {
      record.hiddenFromDropdown = req.body.hiddenFromDropdown;
    }

    await record.save();
    res.json({ success: true, data: record });
  } catch (err) {
    console.error("updateDTRData error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /dtrdatas/:targetId/merge
 * Merges all DTR logs from one or more source DTR Data records into a target record.
 * Duplicate logs (same AC-No + Time) in the target are overwritten by the source.
 * After merging, the source DTR Data records (and their now-moved logs) are deleted.
 */
/**
 * POST /dtrdatas/:targetId/merge
 * Merges all DTR logs from one or more source DTR Data records into a target record.
 * Duplicate logs (same AC-No + Time) in the target are overwritten by the source.
 * After merging, the source DTR Data records (and their now-moved logs) are deleted.
 */
export const mergeDTRData = async (req, res) => {
  try {
    const { targetId } = req.params;
    const { sourceIds } = req.body; // array of DTRData _ids to merge into target

    // Permission check
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller) {
      return res.status(403).json({ success: false, message: "Forbidden: user context missing" });
    }
    if (!(caller.userType === "developer" || caller.canManipulateBiometrics)) {
      return res.status(403).json({ success: false, message: "Forbidden: insufficient permissions" });
    }

    if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({ success: false, message: "sourceIds array is required" });
    }
    if (sourceIds.includes(targetId)) {
      return res.status(400).json({ success: false, message: "Cannot merge a record into itself" });
    }

    const target = await DTRData.findById(targetId).lean();
    if (!target) {
      return res.status(404).json({ success: false, message: "Target DTR Data record not found" });
    }

    const sources = await DTRData.find({ _id: { $in: sourceIds } }).lean();
    if (!sources.length) {
      return res.status(404).json({ success: false, message: "No source DTR Data records found" });
    }

    const targetObjectId = new mongoose.Types.ObjectId(targetId);

    let totalMoved = 0;
    let totalOverwritten = 0;
    let totalSourceLogsProcessed = 0;

    for (const source of sources) {
      const sourceObjectId = source._id;

      // Fetch all logs belonging to the source record
      const sourceLogs = await DTRLog.find({ DTR_ID: sourceObjectId }).lean();
      totalSourceLogsProcessed += sourceLogs.length;

      for (const srcLog of sourceLogs) {
        // Check for duplicate in target: same normalizedAcNo (or AC-No) and same Time
        const acNo = srcLog.normalizedAcNo || (srcLog["AC-No"] ? String(srcLog["AC-No"]).replace(/\D/g, "").replace(/^0+/, "") : null);
        const dupFilter = { DTR_ID: targetObjectId, Time: srcLog.Time };
        if (acNo) {
          dupFilter.normalizedAcNo = acNo;
        } else if (srcLog["AC-No"]) {
          dupFilter["AC-No"] = srcLog["AC-No"];
        }

        const existingInTarget = await DTRLog.findOne(dupFilter);

        if (existingInTarget) {
          // Overwrite: update the existing target log with source data
          existingInTarget.State = srcLog.State;
          existingInTarget["New State"] = srcLog["New State"];
          existingInTarget.Name = srcLog.Name;
          existingInTarget.normalizedName = srcLog.normalizedName;
          existingInTarget.Exception = srcLog.Exception;
          await existingInTarget.save();
          // Delete the source log since we merged it
          await DTRLog.findByIdAndDelete(srcLog._id);
          totalOverwritten++;
        } else {
          // Move: re-assign the log to the target record
          await DTRLog.findByIdAndUpdate(srcLog._id, { DTR_ID: targetObjectId });
          totalMoved++;
        }
      }

      // Delete the now-empty source DTR Data record
      await DTRData.findByIdAndDelete(sourceObjectId);
    }

    res.json({
      success: true,
      message: `Merged ${sources.length} record(s) into "${target.DTR_Record_Name}"`,
      totalSourceLogsProcessed,
      totalMoved,
      totalOverwritten,
      deletedSources: sources.length,
    });
  } catch (err) {
    console.error("mergeDTRData error:", err);
    res.status(500).json({ success: false, message: "Server error during merge" });
  }
};

// ── In-memory merge job store ──
const mergeJobs = new Map();

/**
 * POST /dtrdatas/:targetId/merge-preview
 * Returns a dry-run preview of what the merge would do.
 */
export const previewMergeDTRData = async (req, res) => {
  try {
    const { targetId } = req.params;
    const { sourceIds } = req.body;

    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller) return res.status(403).json({ success: false, message: "Forbidden" });
    if (!(caller.userType === "developer" || caller.canManipulateBiometrics))
      return res.status(403).json({ success: false, message: "Forbidden" });

    if (!sourceIds?.length) return res.status(400).json({ success: false, message: "sourceIds required" });

    const target = await DTRData.findById(targetId).lean();
    if (!target) return res.status(404).json({ success: false, message: "Target not found" });

    const sources = await DTRData.find({ _id: { $in: sourceIds } }).lean();
    if (!sources.length) return res.status(404).json({ success: false, message: "No source records found" });

    const targetObjectId = new mongoose.Types.ObjectId(targetId);

    // Get existing target logs - sample for preview
    const existingTargetLogs = await DTRLog.find({ DTR_ID: targetObjectId })
      .sort({ Time: 1 })
      .limit(200)
      .lean();

    const existingCount = await DTRLog.countDocuments({ DTR_ID: targetObjectId });

    // Collect source logs
    let newCount = 0;
    let overwriteCount = 0;
    const sampleNewLogs = [];
    const sampleOverwriteLogs = [];

    for (const source of sources) {
      const sourceObjectId = source._id;
      const sourceLogs = await DTRLog.find({ DTR_ID: sourceObjectId }).lean();

      for (const srcLog of sourceLogs) {
        const acNo = srcLog.normalizedAcNo || (srcLog["AC-No"] ? String(srcLog["AC-No"]).replace(/\D/g, "").replace(/^0+/, "") : null);
        const dupFilter = { DTR_ID: targetObjectId, Time: srcLog.Time };
        if (acNo) dupFilter.normalizedAcNo = acNo;
        else if (srcLog["AC-No"]) dupFilter["AC-No"] = srcLog["AC-No"];

        const exists = await DTRLog.findOne(dupFilter).lean();
        if (exists) {
          overwriteCount++;
          if (sampleOverwriteLogs.length < 50) {
            sampleOverwriteLogs.push({
              acNo: srcLog["AC-No"] || srcLog.normalizedAcNo || "",
              time: srcLog.Time,
              state: srcLog.State || srcLog["New State"] || "",
              name: srcLog.Name || srcLog.normalizedName || "",
              source: source.DTR_Record_Name,
            });
          }
        } else {
          newCount++;
          if (sampleNewLogs.length < 50) {
            sampleNewLogs.push({
              acNo: srcLog["AC-No"] || srcLog.normalizedAcNo || "",
              time: srcLog.Time,
              state: srcLog.State || srcLog["New State"] || "",
              name: srcLog.Name || srcLog.normalizedName || "",
              source: source.DTR_Record_Name,
            });
          }
        }
      }
    }

    res.json({
      success: true,
      preview: {
        targetName: target.DTR_Record_Name,
        existingCount,
        existingLogs: existingTargetLogs.slice(0, 50).map((l) => ({
          acNo: l["AC-No"] || l.normalizedAcNo || "",
          time: l.Time,
          state: l.State || l["New State"] || "",
          name: l.Name || l.normalizedName || "",
        })),
        newCount,
        overwriteCount,
        totalToProcess: newCount + overwriteCount,
        sampleNewLogs,
        sampleOverwriteLogs,
        sources: sources.map((s) => ({ id: s._id, name: s.DTR_Record_Name })),
      },
    });
  } catch (err) {
    console.error("previewMergeDTRData error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /dtrdatas/:targetId/merge-start
 * Starts a background merge job with progress tracking.
 */
export const startMergeDTRData = async (req, res) => {
  try {
    const { targetId } = req.params;
    const { sourceIds } = req.body;

    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller) return res.status(403).json({ success: false, message: "Forbidden" });
    if (!(caller.userType === "developer" || caller.canManipulateBiometrics))
      return res.status(403).json({ success: false, message: "Forbidden" });

    if (!sourceIds?.length) return res.status(400).json({ success: false, message: "sourceIds required" });
    if (sourceIds.includes(targetId)) return res.status(400).json({ success: false, message: "Cannot merge into itself" });

    const target = await DTRData.findById(targetId).lean();
    if (!target) return res.status(404).json({ success: false, message: "Target not found" });

    const sources = await DTRData.find({ _id: { $in: sourceIds } }).lean();
    if (!sources.length) return res.status(404).json({ success: false, message: "No source records found" });

    const jobId = `merge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mergeJobs.set(jobId, {
      status: "running",
      total: 0,
      processed: 0,
      moved: 0,
      overwritten: 0,
      cancelled: false,
      mergedLogs: [],
    });

    // Start background task 
    (async () => {
      try {
        const targetObjectId = new mongoose.Types.ObjectId(targetId);

        // Count total source logs
        let totalSource = 0;
        for (const source of sources) {
          totalSource += await DTRLog.countDocuments({ DTR_ID: source._id });
        }

        const job = mergeJobs.get(jobId);
        job.total = totalSource;
        mergeJobs.set(jobId, { ...job });

        let processed = 0;
        let moved = 0;
        let overwritten = 0;
        const mergedLogs = [];

        for (const source of sources) {
          const sourceObjectId = source._id;
          const sourceLogs = await DTRLog.find({ DTR_ID: sourceObjectId }).lean();

          for (const srcLog of sourceLogs) {
            // Check for cancellation
            const currentJob = mergeJobs.get(jobId);
            if (currentJob?.cancelled) {
              mergeJobs.set(jobId, {
                ...currentJob,
                status: "cancelled",
                processed,
                moved,
                overwritten,
                mergedLogs,
              });
              return;
            }

            const acNo = srcLog.normalizedAcNo || (srcLog["AC-No"] ? String(srcLog["AC-No"]).replace(/\D/g, "").replace(/^0+/, "") : null);
            const dupFilter = { DTR_ID: targetObjectId, Time: srcLog.Time };
            if (acNo) dupFilter.normalizedAcNo = acNo;
            else if (srcLog["AC-No"]) dupFilter["AC-No"] = srcLog["AC-No"];

            const existingInTarget = await DTRLog.findOne(dupFilter);

            const logEntry = {
              acNo: srcLog["AC-No"] || srcLog.normalizedAcNo || "",
              time: srcLog.Time,
              state: srcLog.State || srcLog["New State"] || "",
              name: srcLog.Name || srcLog.normalizedName || "",
              source: source.DTR_Record_Name,
              isNew: !existingInTarget,
            };

            if (existingInTarget) {
              existingInTarget.State = srcLog.State;
              existingInTarget["New State"] = srcLog["New State"];
              existingInTarget.Name = srcLog.Name;
              existingInTarget.normalizedName = srcLog.normalizedName;
              existingInTarget.Exception = srcLog.Exception;
              await existingInTarget.save();
              await DTRLog.findByIdAndDelete(srcLog._id);
              overwritten++;
            } else {
              await DTRLog.findByIdAndUpdate(srcLog._id, { DTR_ID: targetObjectId });
              moved++;
            }

            if (mergedLogs.length < 100) mergedLogs.push(logEntry);
            processed++;
            mergeJobs.set(jobId, {
              ...mergeJobs.get(jobId),
              processed,
              moved,
              overwritten,
              mergedLogs,
            });
          }

          // Delete source record
          const jobCheck = mergeJobs.get(jobId);
          if (!jobCheck?.cancelled) {
            await DTRData.findByIdAndDelete(sourceObjectId);
          }
        }

        mergeJobs.set(jobId, {
          ...mergeJobs.get(jobId),
          status: "done",
          processed,
          moved,
          overwritten,
          mergedLogs,
        });

        // Expire after 10 minutes
        setTimeout(() => mergeJobs.delete(jobId), 10 * 60 * 1000);
      } catch (e) {
        mergeJobs.set(jobId, {
          ...mergeJobs.get(jobId),
          status: "error",
          message: String(e),
        });
        setTimeout(() => mergeJobs.delete(jobId), 10 * 60 * 1000);
      }
    })();

    return res.json({ success: true, jobId });
  } catch (err) {
    console.error("startMergeDTRData error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /dtrdatas/merge-progress/:jobId
 */
export const getMergeProgress = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = mergeJobs.get(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    return res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /dtrdatas/merge-cancel/:jobId
 */
export const cancelMerge = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = mergeJobs.get(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    job.cancelled = true;
    mergeJobs.set(jobId, job);
    return res.json({ success: true, message: "Cancel requested" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /dtrdatas/:targetId/move-logs
 * Move individual DTRLog entries to a target DTR Data record.
 * Body: { logIds: [string] }
 */
export const moveLogsToTarget = async (req, res) => {
  try {
    const { targetId } = req.params;
    const { logIds } = req.body;

    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller) {
      return res.status(403).json({ success: false, message: "Forbidden: user context missing" });
    }
    if (!(caller.userType === "developer" || caller.canManipulateBiometrics)) {
      return res.status(403).json({ success: false, message: "Forbidden: insufficient permissions" });
    }

    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({ success: false, message: "logIds array is required" });
    }

    const target = await DTRData.findById(targetId).lean();
    if (!target) {
      return res.status(404).json({ success: false, message: "Target DTR Data record not found" });
    }

    const targetObjectId = new mongoose.Types.ObjectId(targetId);
    const result = await DTRLog.updateMany(
      { _id: { $in: logIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { $set: { DTR_ID: targetObjectId } }
    );

    res.json({
      success: true,
      message: `Moved ${result.modifiedCount} log(s) to "${target.DTR_Record_Name}"`,
      moved: result.modifiedCount,
    });
  } catch (err) {
    console.error("moveLogsToTarget error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /dtrdatas/container-preview
 * Preview which DTR Data records and logs would be compiled into a container.
 * Body: { containerName, startDate, endDate }
 */
export const previewContainer = async (req, res) => {
  try {
    const { containerName, startDate, endDate } = req.body;
    if (!containerName || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "containerName, startDate, and endDate are required" });
    }

    const start = parseInLocalTz(startDate).startOf("day");
    const end = parseInLocalTz(endDate).endOf("day");
    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({ success: false, message: "Invalid dates" });
    }

    // Find DTR Data records whose cut-off overlaps with the requested range
    const records = await DTRData.find({
      "DTR_Cut_Off.start": { $lte: end.toDate() },
      "DTR_Cut_Off.end": { $gte: start.toDate() },
    }).sort({ "DTR_Cut_Off.start": 1 }).lean();

    // For each record, count its logs
    const recordPreviews = [];
    let totalLogs = 0;
    for (const rec of records) {
      const count = await DTRLog.countDocuments({ DTR_ID: rec._id });
      totalLogs += count;
      recordPreviews.push({
        _id: rec._id,
        DTR_Record_Name: rec.DTR_Record_Name,
        DTR_Cut_Off: rec.DTR_Cut_Off,
        logCount: count,
      });
    }

    // Fetch a sample of logs across these records
    const sampleLogs = await DTRLog.find({
      DTR_ID: { $in: records.map((r) => r._id) },
    })
      .populate("DTR_ID", "DTR_Record_Name")
      .sort({ Time: 1 })
      .limit(50)
      .lean();

    const sampleData = sampleLogs.map((log) => ({
      time: log.Time,
      acNo: log["AC-No"] || "",
      state: log.State || "",
      name: log.Name || "",
      source: log.DTR_ID?.DTR_Record_Name || "",
    }));

    res.json({
      success: true,
      preview: {
        containerName,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        records: recordPreviews,
        totalRecords: records.length,
        totalLogs,
        sampleLogs: sampleData,
      },
    });
  } catch (err) {
    console.error("previewContainer error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// In-memory container job store
const containerJobs = new Map();

/**
 * POST /dtrdatas/container-create
 * Create a DTR Data Container: creates one new DTR Data record spanning the
 * requested period and moves all logs from the selected source records into it.
 * The source records are deleted after successful migration.
 * Body: { containerName, startDate, endDate, sourceIds: [string] }
 */
export const createContainer = async (req, res) => {
  try {
    const { containerName, startDate, endDate, sourceIds, deleteSourceRecords } = req.body;

    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller) {
      return res.status(403).json({ success: false, message: "Forbidden: user context missing" });
    }
    if (!(caller.userType === "developer" || caller.canManipulateBiometrics)) {
      return res.status(403).json({ success: false, message: "Forbidden: insufficient permissions" });
    }

    if (!containerName || !startDate || !endDate || !sourceIds?.length) {
      return res.status(400).json({ success: false, message: "containerName, startDate, endDate, and sourceIds are required" });
    }

    const start = parseInLocalTz(startDate).startOf("day");
    const end = parseInLocalTz(endDate).endOf("day");

    const jobId = `ctn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    containerJobs.set(jobId, { status: "running", total: 0, moved: 0, phase: "creating" });

    // Respond immediately with jobId
    res.json({ success: true, jobId });

    // Background processing
    (async () => {
      try {
        // Fetch source records to preserve their cut-off metadata as child periods
        const sourceObjectIds = sourceIds.map((id) => new mongoose.Types.ObjectId(id));
        const sourceRecords = await DTRData.find({ _id: { $in: sourceObjectIds } })
          .sort({ "DTR_Cut_Off.start": 1 })
          .lean();

        const childPeriods = sourceRecords.map((r) => ({
          name: r.DTR_Record_Name,
          start: r.DTR_Cut_Off?.start,
          end: r.DTR_Cut_Off?.end,
        }));

        // Create the container DTR Data record
        const container = await DTRData.create({
          DTR_Record_Name: containerName,
          DTR_Cut_Off: { start: start.toDate(), end: end.toDate() },
          Uploaded_By: callerId,
          Uploaded_Date: new Date(),
          isContainer: true,
          childPeriods,
        });

        const containerObjectId = container._id;

        // Count total logs to move
        const total = await DTRLog.countDocuments({ DTR_ID: { $in: sourceObjectIds } });
        containerJobs.set(jobId, { status: "running", total, moved: 0, phase: "moving" });

        // Move logs in batches
        const batchSize = 1000;
        let moved = 0;

        while (true) {
          const job = containerJobs.get(jobId);
          if (job?.cancelled) {
            containerJobs.set(jobId, { ...job, status: "cancelled", moved });
            break;
          }

          const batch = await DTRLog.find({ DTR_ID: { $in: sourceObjectIds } })
            .select("_id")
            .limit(batchSize)
            .lean();

          if (!batch.length) break;

          const ids = batch.map((d) => d._id);
          await DTRLog.updateMany(
            { _id: { $in: ids } },
            { $set: { DTR_ID: containerObjectId } }
          );
          moved += batch.length;
          containerJobs.set(jobId, { status: "running", total, moved, phase: "moving" });
        }

        const job = containerJobs.get(jobId);
        if (job?.status === "cancelled") return;

        // Optionally delete the source records
        let deletedSources = 0;
        if (deleteSourceRecords !== false) {
          containerJobs.set(jobId, { status: "running", total, moved, phase: "cleanup" });
          for (const srcId of sourceObjectIds) {
            // Only delete if no logs remain attached
            const remaining = await DTRLog.countDocuments({ DTR_ID: srcId });
            if (remaining === 0) {
              await DTRData.findByIdAndDelete(srcId);
              deletedSources++;
            }
          }
        }

        containerJobs.set(jobId, {
          status: "done",
          total,
          moved,
          deletedSources,
          containerId: containerObjectId.toString(),
          containerName,
          phase: "done",
        });

        setTimeout(() => containerJobs.delete(jobId), 1000 * 60 * 10);
      } catch (e) {
        console.error("createContainer background error:", e);
        containerJobs.set(jobId, { status: "error", message: String(e) });
        setTimeout(() => containerJobs.delete(jobId), 1000 * 60 * 10);
      }
    })();
  } catch (err) {
    console.error("createContainer error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /dtrdatas/container-progress/:jobId
 */
export const getContainerProgress = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = containerJobs.get(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    return res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// In-memory unmerge job store
const unmergeJobs = new Map();

/**
 * POST /dtrdatas/:containerId/unmerge
 * Pull a date range of logs out of a container into a new standalone DTRData record.
 * Body: { startDate, endDate, newRecordName }
 */
export const unmergeChildPeriod = async (req, res) => {
  try {
    const { containerId } = req.params;
    const { startDate, endDate, newRecordName } = req.body;

    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller) {
      return res.status(403).json({ success: false, message: "Forbidden: user context missing" });
    }
    if (!(caller.userType === "developer" || caller.canManipulateBiometrics)) {
      return res.status(403).json({ success: false, message: "Forbidden: insufficient permissions" });
    }

    if (!startDate || !endDate || !newRecordName) {
      return res.status(400).json({ success: false, message: "startDate, endDate, and newRecordName are required" });
    }

    const container = await DTRData.findById(containerId);
    if (!container) {
      return res.status(404).json({ success: false, message: "Container not found" });
    }

    const rangeStart = parseInLocalTz(startDate).startOf("day");
    const rangeEnd = parseInLocalTz(endDate).endOf("day");

    if (!rangeStart.isValid() || !rangeEnd.isValid() || rangeEnd.isBefore(rangeStart)) {
      return res.status(400).json({ success: false, message: "Invalid date range" });
    }

    const jobId = `unmrg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    unmergeJobs.set(jobId, { status: "running", total: 0, moved: 0, phase: "creating" });

    res.json({ success: true, jobId });

    // Background processing
    (async () => {
      try {
        // Create the new standalone DTRData record
        const newRecord = await DTRData.create({
          DTR_Record_Name: newRecordName.trim(),
          DTR_Cut_Off: { start: rangeStart.toDate(), end: rangeEnd.toDate() },
          Uploaded_By: callerId,
          Uploaded_Date: new Date(),
          isContainer: false,
          childPeriods: [],
        });

        // Count logs to move (belonging to container, within date range)
        const dateFilter = {
          DTR_ID: container._id,
          Time: { $gte: rangeStart.toDate(), $lte: rangeEnd.toDate() },
        };
        const total = await DTRLog.countDocuments(dateFilter);
        unmergeJobs.set(jobId, { status: "running", total, moved: 0, phase: "moving" });

        // Move logs in batches
        const batchSize = 1000;
        let moved = 0;

        while (true) {
          const job = unmergeJobs.get(jobId);
          if (job?.cancelled) {
            unmergeJobs.set(jobId, { ...job, status: "cancelled", moved, total, phase: "cancelled" });
            // Clean up: delete the new record and move logs back is not needed
            // since logs not yet moved stay in the container
            // But delete the (possibly partially filled) new record and move back what was moved
            if (moved > 0) {
              await DTRLog.updateMany(
                { DTR_ID: newRecord._id },
                { $set: { DTR_ID: container._id } }
              );
            }
            await DTRData.findByIdAndDelete(newRecord._id);
            unmergeJobs.set(jobId, { status: "cancelled", moved: 0, total, phase: "cancelled", message: "Unmerge cancelled. All records restored." });
            setTimeout(() => unmergeJobs.delete(jobId), 1000 * 60 * 10);
            return;
          }

          const batch = await DTRLog.find(dateFilter)
            .select("_id")
            .limit(batchSize)
            .lean();

          if (!batch.length) break;

          const ids = batch.map((d) => d._id);
          await DTRLog.updateMany(
            { _id: { $in: ids } },
            { $set: { DTR_ID: newRecord._id } }
          );
          moved += batch.length;
          unmergeJobs.set(jobId, { status: "running", total, moved, phase: "moving" });
        }

        // Check cancelled one more time after loop
        const finalCheck = unmergeJobs.get(jobId);
        if (finalCheck?.cancelled) {
          if (moved > 0) {
            await DTRLog.updateMany(
              { DTR_ID: newRecord._id },
              { $set: { DTR_ID: container._id } }
            );
          }
          await DTRData.findByIdAndDelete(newRecord._id);
          unmergeJobs.set(jobId, { status: "cancelled", moved: 0, total, phase: "cancelled", message: "Unmerge cancelled. All records restored." });
          setTimeout(() => unmergeJobs.delete(jobId), 1000 * 60 * 10);
          return;
        }

        // Remove matching childPeriod entry from container (if any)
        if (container.childPeriods?.length > 0) {
          const rStart = rangeStart.valueOf();
          const rEnd = rangeEnd.valueOf();
          container.childPeriods = container.childPeriods.filter((cp) => {
            const cpStart = new Date(cp.start).getTime();
            const cpEnd = new Date(cp.end).getTime();
            // Remove child if it falls within the unmerged range
            return !(cpStart >= rStart && cpEnd <= rEnd);
          });

          if (container.childPeriods.length === 0) {
            container.isContainer = false;
          }
        }

        await container.save();

        unmergeJobs.set(jobId, {
          status: "done",
          total,
          moved,
          newRecordId: newRecord._id.toString(),
          newRecordName: newRecordName.trim(),
          phase: "done",
        });

        setTimeout(() => unmergeJobs.delete(jobId), 1000 * 60 * 10);
      } catch (e) {
        console.error("unmergeChildPeriod background error:", e);
        unmergeJobs.set(jobId, { status: "error", message: String(e) });
        setTimeout(() => unmergeJobs.delete(jobId), 1000 * 60 * 10);
      }
    })();
  } catch (err) {
    console.error("unmergeChildPeriod error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /dtrdatas/unmerge-cancel/:jobId
 */
export const cancelUnmerge = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = unmergeJobs.get(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    job.cancelled = true;
    unmergeJobs.set(jobId, job);
    return res.json({ success: true, message: "Cancel requested" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /dtrdatas/unmerge-progress/:jobId
 */
export const getUnmergeProgress = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = unmergeJobs.get(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    return res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
