import PayslipRequest from "../models/PayslipRequest.js";
import { getSocketInstance } from "../socket.js";

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
        io.emit("newNotification", {
          type: "PayslipRequest",
          data: newRequest,
        });
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
