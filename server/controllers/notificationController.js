import { sendNoTimeRecordReminderEmail, sendNoTimeRecordBulkEmail } from "../utils/email.js";
import Employee from "../models/Employee.js";

export const sendNoTimeRecordReminder = async (req, res) => {
  try {
    const { employeeId, email, date, name, remarks, missing } = req.body || {};
    if (!employeeId || !date) {
      return res.status(400).json({ success: false, message: "employeeId and date are required" });
    }

    // Resolve employee and get email/name if not provided
    let finalEmail = email;
    let finalName = name;
    if (!finalEmail || !finalName) {
      const emp = await Employee.findOne({ empId: employeeId });
      if (emp) {
        finalEmail = finalEmail || emp.email || emp.workEmail || emp.personalEmail || (Array.isArray(emp.emails) ? emp.emails.find(Boolean) : null);
        finalName = finalName || emp.name || emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
      }
    }

    if (!finalEmail) {
      return res.status(400).json({ success: false, message: "Employee has no email on record" });
    }

    await sendNoTimeRecordReminderEmail({ to: finalEmail, name: finalName, empId: employeeId, date, remarks, missing });
    return res.json({ success: true, message: "Reminder sent" });
  } catch (err) {
    console.error("sendNoTimeRecordReminder error:", err);
    return res.status(500).json({ success: false, message: "Failed to send reminder" });
  }
};

export const sendNoTimeRecordBulk = async (req, res) => {
  try {
    const { employeeId, email, name, dates, periodLabel, remarks } = req.body || {};
    if (!employeeId || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ success: false, message: "employeeId and non-empty dates[] are required" });
    }

    // Resolve employee info if missing
    let finalEmail = email;
    let finalName = name;
    const emp = await Employee.findOne({ empId: employeeId });
    if (emp) {
      finalEmail = finalEmail || emp.email || emp.workEmail || emp.personalEmail || (Array.isArray(emp.emails) ? emp.emails.find(Boolean) : null);
      finalName = finalName || emp.name || emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    }

    if (!finalEmail) {
      return res.status(400).json({ success: false, message: "Employee has no email on record" });
    }

    await sendNoTimeRecordBulkEmail({ to: finalEmail, name: finalName, empId: employeeId, dates, periodLabel, remarks });
    return res.json({ success: true, message: "Bulk reminder sent" });
  } catch (err) {
    console.error("sendNoTimeRecordBulk error:", err);
    return res.status(500).json({ success: false, message: "Failed to send bulk reminder" });
  }
};
