import DemoImportLog from "../models/DemoImportLog.js";

export const logDemoImport = async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
    const { userId, uploadedBy, totalRecords, cutOffStart, cutOffEnd, note } = req.body || {};
    const doc = await DemoImportLog.create({
      userId: userId || null,
      uploadedBy,
      totalRecords: Number(totalRecords) || 0,
      cutOffStart: cutOffStart ? new Date(cutOffStart) : undefined,
      cutOffEnd: cutOffEnd ? new Date(cutOffEnd) : undefined,
      note: note || "demo-import",
      ip,
    });
    return res.json({ success: true, data: { _id: doc._id } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || "Failed to log demo import" });
  }
};

export default { logDemoImport };
