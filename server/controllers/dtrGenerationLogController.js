// controllers/dtrGenerationLogController.js
import DTRGenerationLog from "../models/DTRGenerationLog.js";
import { getSocketInstance } from "../socket.js";

// Create
export const createDTRLog = async (req, res) => {
  try {
    const { employeeId, period, generatedBy } = req.body;

    if (!employeeId || !period || !generatedBy) {
      return res
        .status(400)
        .json({
          success: false,
          message: "employeeId, period, and generatedBy are required",
        });
    }

    const newLog = await DTRGenerationLog.create({
      employeeId,
      period,
      generatedBy,
    });

    // 🔔 Broadcast new notification
    const io = getSocketInstance();
    if (io) {
      io.emit("newDTRMessage", {
        type: "DTRGenerationLog",
        data: newLog,
      });
    }

    res.status(201).json({ success: true, data: newLog });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create log" });
  }
};

// Get
export const getDTRLogs = async (req, res) => {
  try {
    const logs = await DTRGenerationLog.find().sort({ createdAt: -1 });
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch logs" });
  }
};

// Mark all as read
export const markAllDTRLogsAsRead = async (req, res) => {
  try {
    const result = await DTRGenerationLog.updateMany(
      {},
      { $set: { read: true } },
      { upsert: false } // won’t insert new docs, just adds field
    );
    res.json({ success: true, message: "All logs marked as read", result });
  } catch (error) {
    console.error("Error marking all logs as read:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Mark single
export const markDTRLogAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await DTRGenerationLog.findById(id);

    if (!log) {
      return res.status(404).json({ success: false, message: "Log not found" });
    }

    log.read = true;
    await log.save();

    res.json({ success: true, data: log });
  } catch (error) {
    console.error("Error marking log as read:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
