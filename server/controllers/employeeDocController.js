import EmployeeDoc from "../models/employeeDocModel.js";

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

    const newDoc = await EmployeeDoc.create({
      empId,
      docType,
      reference,
      period,
      dateIssued,
      description,
      createdBy,
    });

    res.json({ success: true, data: newDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create document" });
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
