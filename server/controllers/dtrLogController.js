import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import DTRData from "../models/DTRData.js";
import dayjs from "dayjs";

export const getMergedDTRLogs = async (req, res) => {
  try {
    const { recordName, acNo, startDate, endDate } = req.query;

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

    // Filter by AC-No list if provided (comma-separated)
    if (acNo) {
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
      const acNoLast4 = acNoDigits.slice(-4);

      let matchedEmployee = null;

      if (acNoLast4) {
        matchedEmployee = employees.find((emp) => {
          // Get last 4 digits of empId and alternateEmpIds
          const allIds = [emp.empId, ...(emp.alternateEmpIds || [])].filter(
            Boolean
          );
          const allIdsLast4Digits = allIds.map((id) => {
            const digits = String(id).replace(/\D/g, "");
            return digits.slice(-4);
          });
          // Compare last 4 digits of AC-No and empId
          return allIdsLast4Digits.includes(acNoLast4);
        });
      }

      if (!matchedEmployee) {
        const logName = log.Name?.trim().toLowerCase() || "";
        if (logName) {
          matchedEmployee = employees.find((emp) => {
            const empName = emp.name?.toLowerCase() || "";
            return empName.includes(logName) || logName.includes(empName);
          });
        }
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
