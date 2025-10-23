import Employee from "../models/Employee.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import UploadLog from "../models/UploadLog.js";
import DTRLog from "../models/DTRLog.js"; // Import DTRLog model
import Settings from "../models/Settings.js";
import { getSocketInstance } from "../socket.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import EmployeeDoc from "../models/employeeDocModel.js";
import EmployeeSalary from "../models/EmployeeSalary.js";
import PayslipRequest from "../models/PayslipRequest.js";
import DTRGenerationLog from "../models/DTRGenerationLog.js";
import Training from "../models/Training.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const LOCAL_TZ = "Asia/Manila";

export const uploadEmployees = async (req, res) => {
  try {
    const { employees } = req.body;

    if (!Array.isArray(employees) || !employees.length) {
      return res.status(400).json({ message: "Invalid or empty data." });
    }

    const normalized = employees.map((row) => ({
      empNo: row["Emp_No"]?.toString().trim() || "",
      empId: row["Emp_ID"]?.toString().trim() || "", // always use provided empId, no generation
      alternateEmpIds: row["Alternate_Emp_IDs"]
        ? row["Alternate_Emp_IDs"].split(",").map((id) => id.trim())
        : [],
      empType: row["Emp_Type"]?.toString().trim() || "",
      name: row["Name"]?.toString().trim() || "",
      position: row["Position"]?.toString().trim() || "",
      sectionOrUnit: row["Unit/Section"]?.toString().trim() || "",
      division: row["Division"]?.toString().trim() || "",
    }));

    const bulkOps = normalized.map((emp) => ({
      updateOne: {
        filter: { empId: emp.empId },
        update: { $set: emp },
        upsert: true,
      },
    }));

    await Employee.bulkWrite(bulkOps);

    const uploadLog = await UploadLog.create({
      uploadedBy: req.headers["x-uploaded-by"] || "Anonymous",
      totalRecords: normalized.length,
      fileType: "excel-or-csv",
    });

    const io = getSocketInstance();
    io.emit("employeeUploadSuccess", {
      message: `Uploaded ${normalized.length} employees`,
      count: normalized.length,
      uploadedBy: uploadLog.uploadedBy,
      timestamp: uploadLog.createdAt,
    });

    res.status(200).json({ message: "Employees uploaded successfully." });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

export const getEmployees = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '0', 10), 0); // 0-based for backward compat
    const pageSizeParam = parseInt(req.query.pageSize || '0', 10);
    const includeAttendance = String(req.query.includeAttendance || 'false').toLowerCase() === 'true';
    const pageSize = pageSizeParam > 0 ? Math.min(pageSizeParam, 200) : 0; // cap to avoid huge pages

    // Default: exclude resigned employees unless developer/admin explicitly asks
    let canSeeResigned = false;
    try {
      const callerId = req.user?.id || req.user?._id;
      if (callerId) {
        const caller = await User.findById(callerId).lean();
        if (caller) {
          canSeeResigned = Boolean(
            caller.userType === 'developer' ||
            caller.isAdmin ||
            caller.canAccessDeveloper ||
            caller.canSeeDev
          );
        }
      }
    } catch (_) {}
    const includeResigned = String(req.query.includeResigned || 'false').toLowerCase() === 'true';
    const baseQuery = includeResigned && canSeeResigned ? {} : { isResigned: { $ne: true } };
    const cursor = Employee.find(baseQuery).sort({ createdAt: -1 });
    if (pageSize > 0) {
      cursor.skip(page * pageSize).limit(pageSize);
    }
    const employees = await cursor.lean();

    // Check settings for developer override
    const settings = await Settings.getSingleton();
    let startOfCutoff;
    let endOfCutoff;

    if (settings?.dtr?.overrideCutoff?.enabled && settings.dtr.overrideCutoff.startDate && settings.dtr.overrideCutoff.endDate) {
      startOfCutoff = settings.dtr.overrideCutoff.startDate;
      endOfCutoff = settings.dtr.overrideCutoff.endDate;
    } else {
      const now = dayjs().tz(LOCAL_TZ);

      if (now.date() <= 15) {
        // Previous cut-off was 16th to end of last month
        const lastMonth = now.subtract(1, "month");
        startOfCutoff = lastMonth.date(16).startOf("day").toDate();
        endOfCutoff = lastMonth.endOf("month").toDate();
      } else {
        // Previous cut-off was 1st to 15th of this month
        startOfCutoff = now.date(1).startOf("day").toDate();
        endOfCutoff = now.date(15).endOf("day").toDate();
      }
    }

    const timeFilter = { Time: { $gte: startOfCutoff, $lte: endOfCutoff } };

    let matchedCount = 0;
    let noMatchCount = 0;

    const employeesWithAttendance = includeAttendance
      ? await Promise.all(
      employees.map(async (employee) => {
        // 🔹 Candidate IDs (normalized)
        const candidateIds = [];
        if (employee.empId) {
          candidateIds.push(
            employee.empId.replace(/\D/g, "").replace(/^0+/, "")
          );
        }
        if (employee.alternateEmpIds?.length > 0) {
          employee.alternateEmpIds.forEach((altId) => {
            if (altId) {
              candidateIds.push(altId.replace(/\D/g, "").replace(/^0+/, ""));
            }
          });
        }
        const cleanCandidates = candidateIds.filter(Boolean);

        // 🔹 Attendance structure
        let attendance = {
          date: null,
          timeIn: null,
          breakOut: null,
          breakIn: null,
          timeOut: null,
          acNo: null,
        };

        let latestLog = null;

        // 1️⃣ Try AC-No match
        if (cleanCandidates.length > 0) {
          latestLog = await DTRLog.findOne({
            normalizedAcNo: { $in: cleanCandidates },
            ...timeFilter,
          })
            .sort({ Time: -1 })
            .lean();
        }

        // 2️⃣ If no AC-No match → try name match
        if (!latestLog && employee.normalizedName) {
          latestLog = await DTRLog.findOne({
            normalizedName: employee.normalizedName,
            ...timeFilter,
          })
            .sort({ Time: -1 })
            .lean();
        }

        // 3️⃣ If match found → build attendance
        if (latestLog) {
          matchedCount++;

          const latestDate = dayjs(latestLog.Time).tz(LOCAL_TZ);
          const startOfDay = latestDate.startOf("day").toDate();
          const endOfDay = latestDate.endOf("day").toDate();

          const dailyLogsQuery = {
            Time: { $gte: startOfDay, $lte: endOfDay },
          };

          if (latestLog.normalizedAcNo) {
            dailyLogsQuery.normalizedAcNo = latestLog.normalizedAcNo;
          }

          const dailyLogs = await DTRLog.find(dailyLogsQuery)
            .sort({ Time: 1 })
            .lean();

          attendance.date = latestDate.format("MM/DD/YYYY");
          if (dailyLogs.length > 0) {
            attendance.acNo = dailyLogs[0]["AC-No"];
          }

          const timeInLog = dailyLogs.find(log => dayjs(log.Time).tz(LOCAL_TZ).hour() < 12);
          if (timeInLog) attendance.timeIn = dayjs(timeInLog.Time).tz(LOCAL_TZ).format("hh:mm A");

          const breakOutLog = dailyLogs.find(log => {
              const hour = dayjs(log.Time).tz(LOCAL_TZ).hour();
              return hour >= 12 && hour < 14;
          });
          if (breakOutLog) attendance.breakOut = dayjs(breakOutLog.Time).tz(LOCAL_TZ).format("hh:mm A");

          const breakInLog = dailyLogs.find(log => {
              const logTime = dayjs(log.Time).tz(LOCAL_TZ);
              const hour = logTime.hour();
              const minute = logTime.minute();
              return (hour > 12 || (hour === 12 && minute > 0)) && hour < 15 && logTime.format("hh:mm A") !== attendance.breakOut;
          });
          if (breakInLog) attendance.breakIn = dayjs(breakInLog.Time).tz(LOCAL_TZ).format("hh:mm A");

          const timeOutLogs = dailyLogs.filter(log => dayjs(log.Time).tz(LOCAL_TZ).hour() >= 13);
          if (timeOutLogs.length > 0) {
              attendance.timeOut = dayjs(timeOutLogs[timeOutLogs.length - 1].Time).tz(LOCAL_TZ).format("hh:mm A");
          }

          // Auto-fill blank values (use 24-hour style for consistency)
          if (attendance.timeIn && !attendance.breakOut) {
            attendance.breakOut = "12:00";
          }
          if (attendance.timeOut && !attendance.breakIn) {
            attendance.breakIn = "1:00";
          }
        } else {
          noMatchCount++;
        }

        return { ...employee, attendance };
      })
    )
      : employees;

    // ✅ Totals
    // console.log("=====================================");
    // console.log(
    //   `✅ Total employees with AC-No match or Name match: ${matchedCount}`
    // );
    // console.log(`❌ Total employees with no match: ${noMatchCount}`);
    // console.log("=====================================");

    // If paginated, also include total for the client
    if (pageSize > 0) {
      const total = await Employee.countDocuments(baseQuery);
      return res.status(200).json({ data: employeesWithAttendance, page, pageSize, total });
    }
    res.status(200).json(employeesWithAttendance);
  } catch (err) {
    console.error("Error in getEmployees:", err);
    res.status(500).json({ error: err.message });
  }
};
// Add this new controller function:
export const checkEmpIdUnique = async (req, res) => {
  try {
    const { empId, excludeId } = req.query;
    if (!empId) {
      return res.status(400).json({ message: "empId query param is required" });
    }

    const existing = await Employee.findOne({
      empId,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });

    res.json({ isUnique: !existing });
  } catch (error) {
    console.error("Error checking empId uniqueness:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Modify updateEmployeeById to catch duplicate key error specifically
export const updateEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = req.body;

    if (typeof updateData.emails === "string") {
      updateData.emails = updateData.emails
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
    }

    const updated = await Employee.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Employee update failed:", error);

    // Handle Mongo duplicate key error on empId
    if (
      error.name === "MongoServerError" &&
      error.code === 11000 &&
      error.keyPattern?.empId
    ) {
      return res.status(400).json({
        message: `Employee ID "${error.keyValue.empId}" already exists.`,
      });
    }

    res.status(500).json({ message: "Server error" });
  }
};

export const addEmployee = async (req, res) => {
  try {
    let data = req.body;

    if (typeof data.emails === "string") {
      data.emails = data.emails
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
    }

    if (typeof data.alternateEmpIds === "string") {
      data.alternateEmpIds = data.alternateEmpIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    }

    // Auto-generate empNo based on empType
    if (data.empType) {
      const prefix = data.empType === "Regular" ? "R3-REG" : "R3-COS";

      const employees = await Employee.find({ empType: data.empType }).lean();

      let maxNum = 0;
      employees.forEach((emp) => {
        if (emp.empNo && emp.empNo.startsWith(prefix)) {
          const match = emp.empNo.match(/\d+$/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      });

      const newNum = maxNum + 1;
      data.empNo = `${prefix}${String(newNum).padStart(3, "0")}`;
    }

    // IMPORTANT: do NOT auto-generate or overwrite empId here.
    // Use the empId as sent from frontend (HR input).

    const newEmployee = await Employee.create(data);

    const io = getSocketInstance();
    io.emit("employeeAdded", {
      message: `Added new employee: ${newEmployee.name}`,
      employee: newEmployee,
      timestamp: newEmployee.createdAt,
    });

    res.status(201).json({
      success: true,
      message: "Employee added successfully",
      data: newEmployee,
    });
  } catch (error) {
    console.error("Error adding employee:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getLatestEmpNo = async (req, res) => {
  try {
    const { type } = req.params;
    const prefix = type === "Regular" ? "R3-REG" : "R3-COS";

    // Get all employees of the selected type
    const employees = await Employee.find({ empType: type }).lean();

    // Extract the numeric suffix and find the max
    let maxNum = 0;
    employees.forEach((emp) => {
      if (emp.empNo && emp.empNo.startsWith(prefix)) {
        const match = emp.empNo.match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
    });

    // Generate the next number
    const newNum = maxNum + 1;
    const empNo = `${prefix}${String(newNum).padStart(3, "0")}`; // pad to 3 digits

    res.json({ empNo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching latest empNo" });
  }
};

export const getSignatoryEmployees = async (req, res) => {
  try {
    const signatories = await Employee.find({ isSignatory: true }).sort({ name: 1 });
    res.json(signatories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUniqueSectionOrUnits = async (req, res) => {
  try {
    const uniqueSectionOrUnits = await Employee.distinct("sectionOrUnit");
    const uniqueDivisions = await Employee.distinct("division");
    const combined = [...new Set([...uniqueDivisions, ...uniqueSectionOrUnits])];
    res.json(combined.filter(Boolean)); // Filter out null/empty strings
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeByEmpId = async (req, res) => {
  try {
    const { empId } = req.params;
    const raw = decodeURIComponent(empId || "");
    const digits = (raw.match(/\d+/g) || []).join("").replace(/^0+/, "");
    // Build a regex that matches the same sequence of digits while ignoring non-digits and leading zeros
    // e.g., raw `03-579` or `03579` -> digits `3579` -> regex /^0*3\D*5\D*7\D*9$/i
    const regex = digits
      ? new RegExp(`^0*${digits.split("").join("\\D*")}$`, "i")
      : null;

    // Try multiple matching strategies: exact empId, normalizedEmpId, alternateEmpIds (both raw and digits)
    const employee = await Employee.findOne({
      $or: [
        { empId: raw },
        ...(regex ? [{ empId: { $regex: regex } }] : []),
        { alternateEmpIds: raw },
        ...(regex ? [{ alternateEmpIds: { $regex: regex } }] : []),
      ],
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    // Hide resigned employees from non-privileged callers
    if (employee.isResigned) {
      let canSee = false;
      try {
        const callerId = req.user?.id || req.user?._id;
        if (callerId) {
          const caller = await User.findById(callerId).lean();
          canSee = Boolean(
            caller && (
              caller.userType === 'developer' ||
              caller.isAdmin ||
              caller.canAccessDeveloper ||
              caller.canSeeDev ||
              caller.canAccessNotifications ||
              caller.canManageNotifications ||
              caller.canViewNotifications
            )
          );
        }
      } catch (_) {}
      if (!canSee) {
        return res.status(404).json({ success: false, message: "Employee not found" });
      }
    }
    res.json({ success: true, data: employee });
  } catch (err) {
    console.error("Error in getEmployeeByEmpId:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Mark an employee as resigned (developer/admin only)
export const resignEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, resignedAt } = req.body || {};

    // Permission check
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId).lean() : null;
    if (!caller || !(
      caller.userType === 'developer' || caller.isAdmin || caller.canAccessDeveloper || caller.canSeeDev
    )) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const update = {
      isResigned: true,
      resignedAt: resignedAt ? new Date(resignedAt) : new Date(),
      resignedReason: reason || undefined,
    };
  const employee = await Employee.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Graylist trainings: mark participant as resigned
    try {
      const empId = employee.empId;
      if (empId) {
        const Training = (await import('../models/Training.js')).default;
        await Training.updateMany(
          { 'participants.empId': empId },
          { $set: { 'participants.$[elem].resigned': true } },
          { arrayFilters: [{ 'elem.empId': empId }] }
        );
      }
    } catch (e) {
      console.error('Failed to graylist trainings for resigned employee', e);
    }

    // Audit log
    try {
      await AuditLog.create({
        action: 'employee:resign',
        performedBy: caller?._id,
        performedByName: caller?.name || caller?.email,
        details: {
          employeeId: employee._id,
          empId: employee.empId,
          name: employee.name,
          resignedAt: employee.resignedAt,
          reason: employee.resignedReason,
        },
      });
    } catch (e) { /* non-fatal */ }

    res.json({ success: true, data: employee });
  } catch (err) {
    console.error('resignEmployee error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Undo resign (developer/admin only)
export const undoResignEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId).lean() : null;
    if (!caller || !(
      caller.userType === 'developer' || caller.isAdmin || caller.canAccessDeveloper || caller.canSeeDev
    )) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const employee = await Employee.findByIdAndUpdate(
      id,
      { $set: { isResigned: false }, $unset: { resignedAt: '', resignedReason: '' } },
      { new: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Remove graylist flag on trainings participants
    try {
      const empId = employee.empId;
      if (empId) {
        const Training = (await import('../models/Training.js')).default;
        await Training.updateMany(
          { 'participants.empId': empId },
          { $unset: { 'participants.$[elem].resigned': '' } },
          { arrayFilters: [{ 'elem.empId': empId }] }
        );
      }
    } catch (e) {
      console.error('Failed to un-graylist trainings for employee', e);
    }

    // Audit log
    try {
      await AuditLog.create({
        action: 'employee:undo-resign',
        performedBy: caller?._id,
        performedByName: caller?.name || caller?.email,
        details: {
          employeeId: employee._id,
          empId: employee.empId,
          name: employee.name,
        },
      });
    } catch (e) { /* non-fatal */ }

    res.json({ success: true, data: employee });
  } catch (err) {
    console.error('undoResignEmployee error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Aggregate all records tied to an employee (developer/admin only)
export const getEmployeeRecords = async (req, res) => {
  try {
    const { id } = req.params; // Employee _id
    // Permission check
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId).lean() : null;
    if (!caller || !(
      caller.userType === 'developer' || caller.isAdmin || caller.canAccessDeveloper || caller.canSeeDev
    )) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const employee = await Employee.findById(id).lean();
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const empId = employee.empId;
    const employeeObjectId = employee._id;

    const [docs, payslipRequests, genLogs, salary, trainings] = await Promise.all([
      empId ? EmployeeDoc.find({ empId }).sort({ createdAt: -1 }).lean() : [],
      empId ? PayslipRequest.find({ employeeId: empId }).sort({ createdAt: -1 }).lean() : [],
      empId ? DTRGenerationLog.find({ employeeId: empId }).sort({ createdAt: -1 }).lean() : [],
      EmployeeSalary.findOne({ employeeId: employeeObjectId }).lean(),
      empId ? Training.find({ 'participants.empId': empId }).sort({ trainingDate: -1 }).lean() : [],
    ]);

    res.json({
      success: true,
      data: {
        employee,
        docs: docs || [],
        payslipRequests: payslipRequests || [],
        dtrGenerationLogs: genLogs || [],
        salary: salary || null,
        trainings: trainings || [],
      }
    });
  } catch (err) {
    console.error('getEmployeeRecords error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete an employee and cascade delete related records (developer/admin only)
export const deleteEmployeeCascade = async (req, res) => {
  try {
    const { id } = req.params; // Employee _id

    // Permission check
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId).lean() : null;
    if (!caller || !(
      caller.userType === 'developer' || caller.isAdmin || caller.canAccessDeveloper || caller.canSeeDev
    )) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const employee = await Employee.findById(id).lean();
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const empId = employee.empId;

    // Perform deletions/removals
    const deletions = [];
    if (empId) {
      deletions.push(EmployeeDoc.deleteMany({ empId }));
      deletions.push(PayslipRequest.deleteMany({ employeeId: empId }));
      deletions.push(DTRGenerationLog.deleteMany({ employeeId: empId }));
      deletions.push(Training.updateMany(
        { 'participants.empId': empId },
        { $pull: { participants: { empId } } }
      ));
    }
    deletions.push(EmployeeSalary.deleteOne({ employeeId: employee._id }));

    await Promise.all(deletions);

    // Finally delete the employee
    await Employee.findByIdAndDelete(id);

    try {
      await AuditLog.create({
        action: 'employee:delete',
        performedBy: caller?._id,
        performedByName: caller?.name || caller?.email,
        details: { employeeId: id, empId, name: employee.name },
      });
    } catch (_) {}

    res.json({ success: true, message: 'Employee and related records deleted' });
  } catch (err) {
    console.error('deleteEmployeeCascade error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
