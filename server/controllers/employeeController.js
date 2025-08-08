import Employee from "../models/Employee.js";
import UploadLog from "../models/UploadLog.js";
import { getSocketInstance } from "../socket.js";

export const uploadEmployees = async (req, res) => {
  try {
    const { employees } = req.body;

    if (!Array.isArray(employees) || !employees.length) {
      return res.status(400).json({ message: "Invalid or empty data." });
    }

    const normalized = employees.map((row) => ({
      empNo: row["Emp_No"]?.toString().trim() || "",
      empId: row["Emp_ID"]?.toString().trim() || "",
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

    // Log upload
    const uploadLog = await UploadLog.create({
      uploadedBy: req.headers["x-uploaded-by"] || "Anonymous",
      totalRecords: normalized.length,
      fileType: "excel-or-csv",
    });

    // Emit event
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
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.status(200).json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

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
    res.status(500).json({ message: "Server error" });
  }
};