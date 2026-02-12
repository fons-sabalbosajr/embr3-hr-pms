import DTRLog from "../models/DTRLog.js";
import Employee from "../models/Employee.js";
import DTRData from "../models/DTRData.js";
import dayjs from "dayjs";
import { resolveTimePunches } from "../utils/resolveTimePunches.js";

export const getGroupedEmployeeDTR = async (req, res) => {
  try {
    const { recordName, acNo } = req.query;

    const filter = {};

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

    if (acNo) {
      const acNoList = acNo.split(",").map((x) => x.trim());
      filter["AC-No"] = { $in: acNoList };
    }

    const logs = await DTRLog.find(filter).sort({ Time: 1 }).lean();

    const employees = await Employee.find().lean();

    const empMap = new Map();
    employees.forEach((emp) => {
      const allIds = [emp.empId, ...(emp.alternateEmpIds || [])].filter(
        Boolean
      );
      const last4Ids = allIds.map((id) =>
        String(id).replace(/\D/g, "").slice(-4)
      );
      last4Ids.forEach((id) => {
        empMap.set(id, emp);
      });
    });

    const grouped = {};

    logs.forEach((log) => {
      const acNoRaw = log["AC-No"] || "";
      const acNoDigits = String(acNoRaw).replace(/\D/g, "");
      const acNoLast4 = acNoDigits.slice(-4);

      const emp = empMap.get(acNoLast4);
      if (!emp) return;

      const empKey = emp.empId;
      const dateKey = dayjs(log.Time).format("YYYY-MM-DD");

      if (!grouped[empKey]) grouped[empKey] = { employee: emp, dateRawLogs: {} };
      if (!grouped[empKey].dateRawLogs[dateKey]) grouped[empKey].dateRawLogs[dateKey] = [];
      grouped[empKey].dateRawLogs[dateKey].push(log);
    });

    const result = Object.values(grouped).map(({ employee, dateRawLogs }) => ({
      empId: employee.empId,
      empNo: employee.empNo,
      name: employee.name,
      empType: employee.empType,
      position: employee.position,
      division: employee.division,
      sectionOrUnit: employee.sectionOrUnit,
      dtrByDate: Object.entries(dateRawLogs).map(([date, dayLogs]) => {
        const resolved = resolveTimePunches(dayLogs);
        return {
          date,
          timeIn: resolved.timeIn,
          breakOut: resolved.breakOut,
          breakIn: resolved.breakIn,
          timeOut: resolved.timeOut,
        };
      }),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error grouping DTR logs:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
