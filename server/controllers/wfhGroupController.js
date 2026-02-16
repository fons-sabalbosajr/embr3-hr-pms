import WfhGroup from "../models/WfhGroup.js";

/* ─── LIST ─────────────────────────────────────────────────────── */
export const listGroups = async (req, res) => {
  try {
    const { start, end, includeInactive } = req.query;
    const query = {};

    if (start || end) {
      query.$or = [
        {
          startDate: {
            ...(start ? { $lte: new Date(end || start) } : {}),
          },
          endDate: {
            ...(end ? { $gte: new Date(start || end) } : {}),
          },
        },
      ];
    }

    if (!includeInactive) query.active = { $ne: false };

    const data = await WfhGroup.find(query).sort({ startDate: -1 }).lean();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ─── PUBLIC LIST (used by DTR / WorkCalendar) ─────────────────── */
export const publicListGroups = async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = { active: { $ne: false } };

    if (start && end) {
      query.startDate = { $lte: new Date(end) };
      query.endDate = { $gte: new Date(start) };
    }

    const data = await WfhGroup.find(query)
      .select("startDate endDate members.empId members.employeeName")
      .lean();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ─── CREATE ───────────────────────────────────────────────────── */
export const createGroup = async (req, res) => {
  try {
    const { name, startDate, endDate, members, notes } = req.body;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ success: false, message: "startDate and endDate are required" });
    }
    if (!Array.isArray(members) || members.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one member is required" });
    }

    const group = await WfhGroup.create({
      name: name || "",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      members,
      notes: notes || "",
      createdBy: req.user?.name || req.user?.email || "",
    });

    res.status(201).json({ success: true, data: group });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ─── UPDATE ───────────────────────────────────────────────────── */
export const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, members, notes, active } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (startDate !== undefined) update.startDate = new Date(startDate);
    if (endDate !== undefined) update.endDate = new Date(endDate);
    if (Array.isArray(members)) update.members = members;
    if (notes !== undefined) update.notes = notes;
    if (active !== undefined) update.active = active;

    const doc = await WfhGroup.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ─── DELETE ───────────────────────────────────────────────────── */
export const removeGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await WfhGroup.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
