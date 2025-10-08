import LocalHoliday from "../models/LocalHoliday.js";

export const list = async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = {};
    if (start && end) {
      query.$or = [
        { date: { $gte: new Date(start), $lte: new Date(end) } },
        { endDate: { $exists: true, $ne: null, $gte: new Date(start) } },
      ];
    }
    const docs = await LocalHoliday.find(query).sort({ date: 1 });
    res.json({ success: true, data: docs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const create = async (req, res) => {
  try {
    const doc = await LocalHoliday.create(req.body);
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await LocalHoliday.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await LocalHoliday.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};
