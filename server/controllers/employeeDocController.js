import EmployeeDoc from "../models/employeeDocModel.js";
import Employee from "../models/Employee.js";

// ✅ GET all docs by employee
export const getEmployeeDocs = async (req, res) => {
  try {
    const { empId } = req.params;
    const docs = await EmployeeDoc.find({ empId }).sort({ createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch documents" });
  }
};

// ✅ CREATE new doc (just link + info)
export const createEmployeeDoc = async (req, res) => {
  try {
    const { empId, docType, reference, period, dateIssued, description, createdBy } = req.body;

    if (!empId || !docType) {
      return res.status(400).json({ success: false, message: "empId and docType are required" });
    }

    if (docType === "Payslip") {
        if(!period) {
            return res.status(400).json({ success: false, message: "period is required for Payslip" });
        }
        
        const existingDoc = await EmployeeDoc.findOne({ empId, docType, period });

        if (existingDoc) {
            existingDoc.set(req.body);
            const updatedDoc = await existingDoc.save();
            return res.json({ success: true, data: updatedDoc, isNew: false });
        } else {
            const payslipCount = await EmployeeDoc.countDocuments({ docType: "Payslip" });
            const docNo = payslipCount + 1;
            const newDoc = await EmployeeDoc.create({ ...req.body, docNo });
            return res.json({ success: true, data: newDoc, isNew: true });
        }
    }

    // For other docTypes, just create
    const newDoc = await EmployeeDoc.create(req.body);
    res.json({ success: true, data: newDoc, isNew: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create or update document" });
  }
};


// ✅ GET next payslip number
export const getNextPayslipNumber = async (req, res) => {
  try {
    const { empId } = req.params;
    const { period } = req.query;

    if (period) {
      const existingDoc = await EmployeeDoc.findOne({ empId, docType: "Payslip", period });
      if (existingDoc) {
        return res.json({ success: true, nextPayslipNumber: existingDoc.docNo });
      }
    }

    const payslipCount = await EmployeeDoc.countDocuments({ docType: "Payslip" });
    res.json({ success: true, nextPayslipNumber: payslipCount + 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch next payslip number" });
  }
};


// ✅ DELETE a doc
export const deleteEmployeeDoc = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await EmployeeDoc.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Document not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Document deleted", data: deleted });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete document", error: err.message });
  }
};

export const getAllEmployeeDocs = async (req, res) => {
  try {
    const docs = await EmployeeDoc.find().sort({ createdAt: -1 });
    const empIds = [...new Set(docs.map((doc) => doc.empId))];
    const employees = await Employee.find({ empId: { $in: empIds } });
    const employeeMap = employees.reduce((acc, emp) => {
      acc[emp.empId] = emp;
      return acc;
    }, {});

    const populatedDocs = docs.map((doc) => ({
      ...doc.toObject(),
      employee: employeeMap[doc.empId],
    }));

    res.json({ success: true, data: populatedDocs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch documents" });
  }
};
