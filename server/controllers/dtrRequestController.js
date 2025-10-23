import DTRRequest from "../models/DTRRequest.js";
import { getSocketInstance } from "../socket.js";
import User from "../models/User.js";

export const createDTRRequest = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, email } = req.body || {};
    if (!employeeId || !startDate || !endDate || !email) {
      return res.status(400).json({ success: false, message: "employeeId, startDate, endDate and email are required" });
    }

    const doc = await DTRRequest.create({ employeeId, startDate, endDate, email });

    const io = getSocketInstance();
    if (io) {
      // Emit normalized notification payload
      io.emit("newNotification", {
        type: "DTRRequest",
        id: String(doc._id),
        employeeId: doc.employeeId,
        createdAt: doc.createdAt,
        read: !!doc.read,
        hidden: !!doc.hidden,
        title: `DTR Request - ${doc.employeeId}`,
        body: `${new Date(doc.startDate).toLocaleDateString()} - ${new Date(doc.endDate).toLocaleDateString()}`,
      });
    }

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create DTR request" });
  }
};

export const getDTRRequests = async (_req, res) => {
  try {
    const rows = await DTRRequest.find().sort({ createdAt: -1 });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch DTR requests" });
  }
};

export const markDTRRequestAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await DTRRequest.findById(id);
    if (!row) return res.status(404).json({ success: false, message: "Request not found" });
    row.read = true;
    await row.save();
    res.json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
};

export const markAllDTRRequestsAsRead = async (_req, res) => {
  try {
    await DTRRequest.updateMany({}, { $set: { read: true } });
    res.json({ success: true, message: "All dtr requests marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
};

export const updateDTRRequest = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    let caller = null;
    if (callerId) caller = await User.findById(callerId);
    if (!caller && req.user && typeof req.user === 'object') caller = req.user;
    if (!caller) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const allowed = !!(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev || caller.userType === 'developer');
    if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { id } = req.params;
    const body = req.body || {};
    const whitelist = ['hidden'];
    const changes = {};
    Object.keys(body).forEach(k => { if (whitelist.includes(k)) changes[k] = body[k]; });
    const updated = await DTRRequest.findByIdAndUpdate(id, { $set: changes }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update DTR request' });
  }
};

export const deleteDTRRequest = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller || !(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { id } = req.params;
    const deleted = await DTRRequest.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete DTR request' });
  }
};
