import LocalHoliday from "../models/LocalHoliday.js";
import { recordAudit } from '../utils/auditHelper.js';

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
    recordAudit('holiday:created', req, { id: String(doc._id), name: doc.name, date: doc.date });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ["name","date","endDate","location","notes"]; // controlled update fields
    const payload = {};
    Object.entries(req.body || {}).forEach(([k,v])=>{ if (allowed.includes(k)) payload[k]=v; });
    const doc = await LocalHoliday.findByIdAndUpdate(id, payload, { new: true });
    recordAudit('holiday:updated', req, { id, changes: payload });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await LocalHoliday.findByIdAndDelete(id);
    recordAudit('holiday:deleted', req, { id });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};
