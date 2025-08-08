import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";

export const getMergedDTRLogs = async (req, res) => {
  try {
    const logs = await DTRLog.find().sort({ createdAt: -1 }).lean();
    const employees = await Employee.find().lean();

    const mergedData = logs.map((log, index) => {
      const acNoRaw = log["AC-No"] || "";
      const acNoDigits = String(acNoRaw).replace(/\D/g, "");
      const acNoLast4 = acNoDigits.slice(-4);

      let matchedEmployee = null;

      if (acNoLast4) {
        matchedEmployee = employees.find((emp) => {
          const allIds = [emp.empId, ...(emp.alternateEmpIds || [])].filter(Boolean);

          const allIdsLast4Digits = allIds.map((id) => {
            const digits = String(id).replace(/\D/g, "");
            return digits.slice(-4);
          });

          return allIdsLast4Digits.includes(acNoLast4);
        });
      }

      // Fallback to name match if no ID match found
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
        employeeName: matchedEmployee ? matchedEmployee.name : "Unknown Employee",
        newState: log["New State"],
        newStateEmployeeName: matchedEmployee ? matchedEmployee.name : "Unknown Employee",
      };
    });

    res.json({ success: true, data: mergedData });
  } catch (error) {
    console.error("Error merging DTR logs:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
