import Training from "../models/Training.js";
import User from "../models/User.js";

// ---------- Controllers ----------

// GET all trainings
export const getAllTrainings = async (req, res) => {
  try {
    const trainings = await Training.find().sort({ trainingDate: -1 });
    // Role detection
    let isDev = false;
    try {
      const callerId = req.user?.id || req.user?._id;
      if (callerId) {
        const caller = await User.findById(callerId).lean();
        if (caller) {
          isDev = Boolean(caller.userType === 'developer' || caller.isAdmin || caller.canAccessDeveloper || caller.canSeeDev);
        }
      }
    } catch (_) {}

    // Graylist or hide resigned participants depending on role
    try {
      const Employee = (await import('../models/Employee.js')).default;
      const empIds = new Set();
      trainings.forEach(t => (t.participants || []).forEach(p => { if (p.empId) empIds.add(p.empId); }));
      if (empIds.size) {
        const resigned = await Employee.find({ empId: { $in: Array.from(empIds) }, isResigned: true }).select('empId').lean();
        const resignedSet = new Set(resigned.map(r => r.empId));
        trainings.forEach(t => {
          const parts = Array.isArray(t.participants) ? t.participants : [];
          if (isDev) {
            parts.forEach(p => { if (p.empId && resignedSet.has(p.empId)) p.resigned = true; });
          } else {
            t.participants = parts.filter(p => !resignedSet.has(p.empId));
          }
        });
      }
    } catch (_) {}
    res.json(trainings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch trainings" });
  }
};

// GET a single training by ID
export const getTrainingById = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training)
      return res.status(404).json({ message: "Training not found" });
    res.json(training);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch training" });
  }
};

// CREATE a new training
export const createTraining = async (req, res) => {
  try {
    const participants = req.body.participants || [];

    const training = new Training({
      name: req.body.name,
      host: req.body.host,
      venue: req.body.venue,
      trainingDate: req.body.trainingDate,
      participants,
      iisTransaction: req.body.iisTransaction, // Special Order No. or IIS Transaction No.
    });

    await training.save();
    res.status(201).json(training);
  } catch (err) {
    console.error("Failed to create training:", err);
    res.status(500).json({ message: "Failed to create training" });
  }
};

// UPDATE a training
export const updateTraining = async (req, res) => {
  try {
    const participants = req.body.participants || [];

    const updateData = {
      name: req.body.name,
      host: req.body.host,
      venue: req.body.venue,
      trainingDate: req.body.trainingDate,
      participants,
      iisTransaction: req.body.iisTransaction,
    };

    const updated = await Training.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!updated)
      return res.status(404).json({ message: "Training not found" });
    res.json(updated);
  } catch (err) {
    console.error("Failed to update training:", err);
    res.status(500).json({ message: "Failed to update training" });
  }
};

// DELETE a training
export const deleteTraining = async (req, res) => {
  try {
    const deleted = await Training.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Training not found" });
    res.json({ message: "Training deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete training" });
  }
};


// GET trainings by employeeId
export const getTrainingsByEmployee = async (req, res) => {
  try {
    const { empId } = req.params;
    if (!empId) return res.status(400).json({ message: "empId is required" });

    const trainings = await Training.find({ "participants.empId": empId });
    // Role detection
    let isDev = false;
    try {
      const callerId = req.user?.id || req.user?._id;
      if (callerId) {
        const caller = await User.findById(callerId).lean();
        if (caller) {
          isDev = Boolean(caller.userType === 'developer' || caller.isAdmin || caller.canAccessDeveloper || caller.canSeeDev);
        }
      }
    } catch (_) {}

    // Mark/Filter participant if applicable
    try {
      const Employee = (await import('../models/Employee.js')).default;
      const emp = await Employee.findOne({ empId }).select('isResigned').lean();
      if (emp?.isResigned) {
        if (isDev) {
          trainings.forEach(t => {
            (t.participants || []).forEach(p => { if (p.empId === empId) p.resigned = true; });
          });
        } else {
          // HR cannot view resigned employee trainings
          return res.json({ data: [] });
        }
      }
    } catch (_) {}

    res.json({ data: trainings });
  } catch (err) {
    console.error("Failed to fetch trainings by employee:", err);
    res.status(500).json({ message: "Failed to fetch trainings" });
  }
};

// Public: GET trainings by employeeId (limited fields, no auth required)
export const getTrainingsByEmployeePublic = async (req, res) => {
  try {
    const { empId } = req.params;
    if (!empId) return res.status(400).json({ message: "empId is required" });

    // Return only fields needed by public DTR preview
    const trainings = await Training.find({ "participants.empId": empId })
      .select("name trainingDate iisTransaction")
      .lean();

    return res.json({ data: trainings || [] });
  } catch (err) {
    console.error("Failed to fetch trainings by employee (public):", err);
    return res.status(500).json({ message: "Failed to fetch trainings" });
  }
};
