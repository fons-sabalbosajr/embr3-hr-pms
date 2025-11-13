import EmployeeDoc from "../models/employeeDocModel.js";
import Employee from "../models/Employee.js";
import { getSocketInstance } from "../socket.js";
import { storageUpload } from "../utils/storageProvider.js";

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
    const { empId, docType, period, dateIssued } = req.body || {};

    if (!empId || !docType) {
      return res.status(400).json({ success: false, message: "empId and docType are required" });
    }

    // Optional: incoming file (uses multer memory storage on the route layer if present)
    let storageMeta = {};
    if (req.file) {
      try {
        const uploaded = await storageUpload({
          buffer: req.file.buffer,
            filename: req.file.originalname,
          mimeType: req.file.mimetype,
          subdir: `employee/${empId}`,
        });
        storageMeta = {
          storageProvider: uploaded.provider,
          fileId: uploaded.id,
          originalFilename: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          reference: uploaded.provider === 'drive' ? uploaded.id : uploaded.localPath || uploaded.name,
        };
      } catch (e) {
        console.error('EmployeeDoc upload failed', e);
        return res.status(500).json({ success: false, message: 'File upload failed' });
      }
    }

    if (docType === "Payslip") {
      if (!period) {
        return res.status(400).json({ success: false, message: "period is required for Payslip" });
      }
      const existingDoc = await EmployeeDoc.findOne({ empId, docType, period });
      if (existingDoc) {
        existingDoc.set({ ...req.body, ...storageMeta });
        const updatedDoc = await existingDoc.save();
        try {
          const io = getSocketInstance();
          io.emit('employeeDoc:created', { ...updatedDoc.toObject(), isNew: false });
        } catch (_) {}
        return res.json({ success: true, data: updatedDoc, isNew: false });
      } else {
        // Determine target year from provided period (preferred), else from dateIssued/current date
        let year;
        if (typeof period === 'string') {
          const parts = period.split(' - ');
          const start = parts && parts.length > 0 ? new Date(parts[0]) : null;
          year = start && !isNaN(start.getTime()) ? start.getFullYear() : undefined;
        }
        const basis = dateIssued ? new Date(dateIssued) : new Date();
        if (!year) year = basis.getFullYear();
        const yearStart = new Date(year, 0, 1);
        const nextYearStart = new Date(year + 1, 0, 1);
        // Prefer counting by period's year to match reporting expectations
        let yearlyCount = 0;
        try {
          const periodRegex = new RegExp(`^${year}-`);
          yearlyCount = await EmployeeDoc.countDocuments({ docType: 'Payslip', period: { $regex: periodRegex } });
        } catch (_) {
          yearlyCount = 0;
        }
        if (!yearlyCount) {
          // Fallback: count by issued/created timestamps
          yearlyCount = await EmployeeDoc.countDocuments({
            docType: "Payslip",
            $or: [
              { dateIssued: { $gte: yearStart, $lt: nextYearStart } },
              { dateIssued: { $exists: false }, createdAt: { $gte: yearStart, $lt: nextYearStart } },
            ],
          });
        }
        const docNo = yearlyCount + 1;
        const newDoc = await EmployeeDoc.create({ ...req.body, ...storageMeta, docNo });
        try {
          const io = getSocketInstance();
          io.emit('employeeDoc:created', { ...newDoc.toObject(), isNew: true });
        } catch (_) {}
        return res.json({ success: true, data: newDoc, isNew: true });
      }
    }

    // Generic creation
    const newDoc = await EmployeeDoc.create({ ...req.body, ...storageMeta });
    try {
      const io = getSocketInstance();
      io.emit('employeeDoc:created', { ...newDoc.toObject(), isNew: true });
    } catch (_) {}
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

    // Determine target year from period (start date) if provided, else current year
    let targetYear;
    if (period && typeof period === 'string') {
      // Expected format: "YYYY-MM-DD - YYYY-MM-DD"
      const startStr = period.split('-')[0]?.trim();
      // When splitting by '-', we get pieces inside the date; safer approach: split by ' - '
      const parts = period.split(' - ');
      const start = parts && parts.length > 0 ? new Date(parts[0]) : null;
      targetYear = start && !isNaN(start.getTime()) ? start.getFullYear() : new Date().getFullYear();
    } else {
      targetYear = new Date().getFullYear();
    }

    const yearStart = new Date(targetYear, 0, 1);
    const nextYearStart = new Date(targetYear + 1, 0, 1);
    // Prefer counting by period year via regex on period string
    let yearlyCount = 0;
    try {
      const periodRegex = new RegExp(`^${targetYear}-`);
      yearlyCount = await EmployeeDoc.countDocuments({ docType: 'Payslip', period: { $regex: periodRegex } });
    } catch (_) {
      yearlyCount = 0;
    }
    if (!yearlyCount) {
      // Fallback: count by issued/created timestamps
      yearlyCount = await EmployeeDoc.countDocuments({
        docType: "Payslip",
        $or: [
          { dateIssued: { $gte: yearStart, $lt: nextYearStart } },
          { dateIssued: { $exists: false }, createdAt: { $gte: yearStart, $lt: nextYearStart } },
        ],
      });
    }
    // NOTE: This simple count + 1 approach can race under heavy concurrent generation.
    // Future improvement: use a separate YearCounter collection with findOneAndUpdate($inc) for atomic increments.
    res.json({ success: true, nextPayslipNumber: yearlyCount + 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch next payslip number" });
  }
};


// ✅ DELETE a doc
export const deleteEmployeeDoc = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await EmployeeDoc.findById(id);

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Try to delete the underlying storage object (best-effort)
    try {
      const { storageProvider, fileId, reference } = doc.toObject();
      if (storageProvider === 'drive' && fileId) {
        const { storageDelete } = await import('../utils/storageProvider.js');
        await storageDelete(fileId);
      } else if (reference) {
        const { storageDelete } = await import('../utils/storageProvider.js');
        await storageDelete(reference);
      }
    } catch (e) {
      // non-fatal: log and continue
      console.warn('Failed to delete underlying file for EmployeeDoc', e?.message || e);
    }

    const deleted = await EmployeeDoc.findByIdAndDelete(id);
    try {
      const io = getSocketInstance();
      if (deleted) io.emit('employeeDoc:deleted', { _id: deleted._id, docType: deleted.docType, empId: deleted.empId });
    } catch (_) {}
    res.status(200).json({ success: true, message: "Document deleted", data: deleted });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete document", error: err.message });
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

// ✅ UPDATE a doc (dev-only via route guard)
export const updateEmployeeDoc = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ["description", "period", "dateIssued", "docNo"]; // whitelist editable fields
    const update = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        update[key] = req.body[key];
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided to update" });
    }

    const updated = await EmployeeDoc.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: false }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    try {
      const io = getSocketInstance();
      io.emit('employeeDoc:updated', { _id: updated._id, docType: updated.docType, empId: updated.empId });
    } catch (_) {}

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Failed to update EmployeeDoc', err);
    return res.status(500).json({ success: false, message: "Failed to update document" });
  }
};
