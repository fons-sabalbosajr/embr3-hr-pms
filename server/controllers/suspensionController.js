import Suspension from "../models/Suspension.js";
import { recordAudit } from '../utils/auditHelper.js';

export const list = async (req, res) => {
  try {
    const { start, end, includeInactive } = req.query;
    const query = {};
    if (start && end) {
      query.$or = [
        { date: { $gte: new Date(start), $lte: new Date(end) } },
        { endDate: { $exists: true, $ne: null, $gte: new Date(start) } },
      ];
    }
    // By default exclude inactive unless explicitly requested
    if (!includeInactive || includeInactive === "false") {
      query.active = { $ne: false };
    }
    const docs = await Suspension.find(query).sort({ date: 1 });
    res.json({ success: true, data: docs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const create = async (req, res) => {
  try {
    const doc = await Suspension.create(req.body);
    recordAudit('suspension:created', req, { id: String(doc._id), title: doc.title, date: doc.date });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "title",
      "date",
      "endDate",
      "scope",
      "location",
      "referenceType",
      "referenceNo",
      "attachmentUrl",
      "notes",
      "active",
    ];
    const payload = {};
    Object.entries(req.body || {}).forEach(([k, v]) => {
      if (allowed.includes(k)) payload[k] = v;
    });
    const doc = await Suspension.findByIdAndUpdate(id, payload, { new: true });
    recordAudit('suspension:updated', req, { id, changes: payload });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await Suspension.findByIdAndDelete(id);
    recordAudit('suspension:deleted', req, { id });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};
