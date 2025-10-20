import Settings from "../models/Settings.js";
import AuditLog from "../models/AuditLog.js";

// @desc    Get application settings
// @route   GET /api/settings
// @access  Private (Admin)
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSingleton();
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching settings", error });
  }
};

// @desc    Update application settings
// @route   PUT /api/settings
// @access  Private (Admin)
export const updateSettings = async (req, res) => {
  try {
    const oldSettings = await Settings.getSingleton();
    const settings = await Settings.findOneAndUpdate(
      { singleton: "singleton" },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );

    // If maintenance settings changed, create an audit log
    const oldMaint = oldSettings?.maintenance || {};
    const newMaint = req.body?.maintenance || {};
    const changed = JSON.stringify(oldMaint) !== JSON.stringify(newMaint);
    if (changed) {
      await AuditLog.create({
        action: 'maintenance.updated',
        performedBy: req.user?.id || null,
        performedByName: req.user?.name || req.user?.username || null,
        details: { before: oldMaint, after: newMaint },
      });
    }

    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: "Error updating settings", error });
  }
};
