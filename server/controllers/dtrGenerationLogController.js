// controllers/dtrGenerationLogController.js
import DTRGenerationLog from "../models/DTRGenerationLog.js";
import DTRLog from "../models/DTRLog.js";
import { getSocketInstance } from "../socket.js";
import User from "../models/User.js";

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

// Update generation log (supports toggling 'hidden')
export const updateDTRGenerationLog = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller && req.user && typeof req.user === 'object') caller = req.user;
    if (!caller) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const allowedToManage = !!(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev || caller.userType === 'developer');
    if (!allowedToManage) return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });

    const { id } = req.params;
    const body = req.body || {};
    const allowed = ['hidden'];
    const changes = {};
    Object.keys(body).forEach(k => { if (allowed.includes(k)) changes[k] = body[k]; });
    let updated = await DTRGenerationLog.findByIdAndUpdate(id, { $set: changes }, { new: true });
    if (!updated) {
      // Fallback: maybe this id belongs to the DTRLog collection
      updated = await DTRLog.findByIdAndUpdate(id, { $set: changes }, { new: true });
      if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update generation log' });
  }
};

export const deleteDTRGenerationLog = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    let caller = callerId ? await User.findById(callerId) : null;
    if (!caller && req.user && typeof req.user === 'object') caller = req.user;
    if (!caller || !(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions to delete generation log' });
    }

    const { id } = req.params;
    let deleted = await DTRGenerationLog.findByIdAndDelete(id);
    if (!deleted) {
      // Fallback to DTRLog collection
      deleted = await DTRLog.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete generation log' });
  }
};
