import DTRData from "../models/DTRData.js";
import dayjs from "dayjs";

export const getDTRDataList = async (req, res) => {
  try {
    const records = await DTRData.find({}, "DTR_Record_Name DTR_Cut_Off")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Error fetching DTRData list:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const checkDTRData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate and endDate are required" });
    }

    const start = dayjs(startDate).startOf("day");
    const end = dayjs(endDate).endOf("day");

    const record = await DTRData.findOne({
      "DTR_Cut_Off.start": { $lte: start.toDate() },
      "DTR_Cut_Off.end": { $gte: end.toDate() },
    });

    if (record) {
      res.json({ success: true, data: { available: true, record } });
    } else {
      res.json({ success: true, data: { available: false } });
    }
  } catch (error) {
    console.error("Error checking DTRData:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};