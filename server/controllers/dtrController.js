import DTRData from "../models/DTRData.js";
import DTRLog from "../models/DTRLog.js";

export const uploadDTR = async (req, res) => {
  try {
    const { recordName, cutOffStart, cutOffEnd, userId, uploadedBy, logs } =
      req.body;

    // Create DTRData header
    const header = await DTRData.create({
      DTR_Record_Name: recordName,
      DTR_Cut_Off: {
        start: new Date(cutOffStart),
        end: new Date(cutOffEnd),
      },
      Uploaded_By: userId,
      Uploaded_By_Name: uploadedBy,
      Uploaded_Date: new Date(),
    });

    // Prepare logs: convert Time strings to Date and add DTR_ID
    const logDocs = logs.map((log) => ({
      ...log,
      Time: log.Time ? new Date(log.Time) : null,
      DTR_ID: header._id,
    }));

    // Bulk insert with ordered:false to skip duplicates (requires unique index on Name+Time)
    await DTRLog.insertMany(logDocs, { ordered: false });

    res.status(200).json({ message: "DTR and logs uploaded successfully" });
  } catch (error) {
    // Handle duplicate errors gracefully if possible
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(409)
        .json({ message: "Duplicate entries detected and skipped." });
    }
    console.error(error);
    res
      .status(500)
      .json({ message: "Failed to upload DTR", error: error.message });
  }
};
