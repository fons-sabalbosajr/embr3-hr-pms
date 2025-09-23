import Settings from "../models/Settings.js";

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
    const settings = await Settings.findOneAndUpdate(
      { singleton: "singleton" },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: "Error updating settings", error });
  }
};
