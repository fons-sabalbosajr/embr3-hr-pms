import PayslipRequest from "../models/PayslipRequest.js";
import { getSocketInstance } from "../socket.js";
import User from "../models/User.js";

export const createPayslipRequest = async (req, res) => {
  try {
    const { employeeId, period, email } = req.body;

    if (!employeeId || !period || !email) {
      return res.status(400).json({ success: false, message: "employeeId, period, and email are required" });
    }

    const newRequest = await PayslipRequest.create({ employeeId, period, email });

    if (newRequest) {
      const io = getSocketInstance();
      if (io) {
        // Emit document shape with a type field for client consumption
        const payload = { ...newRequest.toObject(), type: "PayslipRequest" };
        io.emit("newNotification", payload);
      }
    }

    res.status(201).json({ success: true, data: newRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create payslip request" });
  }
};

// ✅ New controller for GET
export const getPayslipRequests = async (req, res) => {
  try {
    const requests = await PayslipRequest.find().sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch payslip requests" });
  }
};

export const markAllPayslipRequestsAsRead = async (req, res) => {
  try {
    await PayslipRequest.updateMany({}, { $set: { read: true } });
    res.json({ success: true, message: "All requests marked as read" });
  } catch (error) {
    console.error("Error marking all requests as read:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await PayslipRequest.findById(id);

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    request.read = true;
    await request.save();

    res.json({ success: true, data: request });
  } catch (error) {
    console.error("Error marking request as read:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Update payslip request (supports toggling 'hidden')
export const updatePayslipRequest = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    let caller = null;
    if (callerId) caller = await User.findById(callerId);
    // Fallback: sometimes the token contains user flags directly
    if (!caller && req.user && typeof req.user === 'object') caller = req.user;
    if (!caller) {
      console.warn('updatePayslipRequest: no caller resolved', { callerId, tokenPayload: req.user });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const allowedToManage = !!(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev || caller.userType === 'developer');
    if (!allowedToManage) {
      console.warn('updatePayslipRequest: permission denied', { callerId, caller: { id: caller._id || caller.id, isAdmin: caller.isAdmin, canManageNotifications: caller.canManageNotifications, canAccessNotifications: caller.canAccessNotifications, canSeeDev: caller.canSeeDev, userType: caller.userType } });
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

    const { id } = req.params;
    const body = req.body || {};
    const allowed = ['hidden'];
    const changes = {};
    Object.keys(body).forEach(k => { if (allowed.includes(k)) changes[k] = body[k]; });
    const updated = await PayslipRequest.findByIdAndUpdate(id, { $set: changes }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update payslip request' });
  }
};

export const deletePayslipRequest = async (req, res) => {
  try {
    const callerId = req.user?.id || req.user?._id;
    const caller = callerId ? await User.findById(callerId) : null;
    if (!caller || !(caller.isAdmin || caller.canManageNotifications || caller.canAccessNotifications || caller.canSeeDev)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions to delete payslip request' });
    }

    const { id } = req.params;
    const deleted = await PayslipRequest.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete payslip request' });
  }
};
