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
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.status(200).json(employees);
  } catch (err) {
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
      return res
        .status(400)
        .json({
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
