// controllers/dtrWorkCalendarController.js
import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";

export const getWorkCalendar = async (req, res) => {
  try {
    const { employeeId } = req.query; // only need employeeId now

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Missing required query parameters",
      });
    }

    //console.log("Incoming request for employeeId:", employeeId);

    // Find employee
    const employee = await Employee.findOne({ empId: employeeId });
    if (!employee) {
      console.warn(`No employee found for empId: ${employeeId}`);
    } else {
      //console.log("Employee found:", employee.empId, employee.name);
    }

    // Normalize to pure digits and match via normalizedAcNo to be robust across formats
    const normalizeDigits = (v) => (v ? String(v).replace(/\D/g, "").replace(/^0+/, "") : "");
    const mappedACNo = normalizeDigits(employeeId);
    const logs = await DTRLog.find({ normalizedAcNo: mappedACNo }).sort({ Time: 1 });

    //console.log(`Found ${logs.length} logs for AC-No ${mappedACNo}`);

    const formattedLogs = logs.map((log) => ({
      id: log._id,
      time: log.Time,
      state: log.State,
      ACNo: log["AC-No"],
      Name: log.Name,
    }));

    //console.log("Formatted logs to return:", formattedLogs);

    res.json({ success: true, data: formattedLogs });
  } catch (error) {
    console.error("getWorkCalendar error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching work calendar logs",
    });
  }
};
