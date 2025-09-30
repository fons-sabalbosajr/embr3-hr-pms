import Employee from "../models/Employee.js";
import UploadLog from "../models/UploadLog.js";
import DTRLog from "../models/DTRLog.js"; // Import DTRLog model
import { getSocketInstance } from "../socket.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

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
    const employees = await Employee.find().sort({ createdAt: -1 }).lean();

    const now = dayjs().tz(LOCAL_TZ);
    let startOfCutoff, endOfCutoff;

    if (now.date() <= 15) {
      // Previous cut-off was 16th to end of last month
      const lastMonth = now.subtract(1, 'month');
      startOfCutoff = lastMonth.date(16).startOf('day').toDate();
      endOfCutoff = lastMonth.endOf('month').toDate();
    } else {
      // Previous cut-off was 1st to 15th of this month
      startOfCutoff = now.date(1).startOf('day').toDate();
      endOfCutoff = now.date(15).endOf('day').toDate();
    }

    const timeFilter = { Time: { $gte: startOfCutoff, $lte: endOfCutoff } };

    let matchedCount = 0;
    let noMatchCount = 0;

    const employeesWithAttendance = await Promise.all(
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

          // Auto-fill blank values
          if (attendance.timeIn && !attendance.breakOut) {
            attendance.breakOut = "12:00 PM";
          }
          if (attendance.timeOut && !attendance.breakIn) {
            attendance.breakIn = "01:00 PM";
          }
        } else {
          noMatchCount++;
        }

        return { ...employee, attendance };
      })
    );

    // ✅ Totals
    // console.log("=====================================");
    // console.log(
    //   `✅ Total employees with AC-No match or Name match: ${matchedCount}`
    // );
    // console.log(`❌ Total employees with no match: ${noMatchCount}`);
    // console.log("=====================================");

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
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    res.json({ success: true, data: employee });
  } catch (err) {
    console.error("Error in getEmployeeByEmpId:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
