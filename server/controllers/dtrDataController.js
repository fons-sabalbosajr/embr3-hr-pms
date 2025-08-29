import DTRData from "../models/DTRData.js";

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
