import DTRGenerationLog from "../models/DTRGenerationLog.js";
import { getSocketInstance } from "../socket.js";

export const createDTRLog = async (req, res) => {
  try {
    const { employeeId, period, generatedBy } = req.body;

    if (!employeeId || !period || !generatedBy) {
      return res.status(400).json({ success: false, message: "employeeId, period, and generatedBy are required" });
    }

    const newLog = await DTRGenerationLog.create({ employeeId, period, generatedBy });

    if (newLog) {
      const io = getSocketInstance();
      if (io) {
        io.emit("newDTRLog", {
          type: "DTRGenerationLog",
          data: newLog,
        });
      }
    }

    res.status(201).json({ success: true, data: newLog });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create DTR log" });
  }
};

// ✅ New controller for GET
export const getDTRLogs = async (req, res) => {
  try {
    const logs = await DTRGenerationLog.find().sort({ createdAt: -1 });
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch DTR logs" });
  }
};
