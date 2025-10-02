import DeductionType from "../models/DeductionType.js";

// @desc    Get all deduction types
// @route   GET /api/deduction-types
// @access  Private
export const getDeductionTypes = async (req, res) => {
  try {
    const deductionTypes = await DeductionType.find();
    res.status(200).json(deductionTypes);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Create a deduction type
// @route   POST /api/deduction-types
// @access  Private
export const createDeductionType = async (req, res) => {
  try {
    const { name, description, type, calculationType, amount, formula } =
      req.body;

    const deductionType = new DeductionType({
      name,
      description,
      type,
      calculationType,
      amount,
      formula,
    });

    await deductionType.save();
    res.status(201).json(deductionType);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Update a deduction type
// @route   PUT /api/deduction-types/:id
// @access  Private
export const updateDeductionType = async (req, res) => {
  try {
    const { name, description, type, calculationType, amount, formula } =
      req.body;
    const deductionType = await DeductionType.findById(req.params.id);

    if (!deductionType) {
      return res.status(404).json({ message: "Deduction type not found" });
    }

    deductionType.name = name;
    deductionType.description = description;
    deductionType.type = type;
    deductionType.calculationType = calculationType;
    deductionType.amount = amount;
    deductionType.formula = formula;

    await deductionType.save();
    res.status(200).json(deductionType);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Delete a deduction type
// @route   DELETE /api/deduction-types/:id
// @access  Private
export const deleteDeductionType = async (req, res) => {
  try {
    const deductionType = await DeductionType.findByIdAndDelete(req.params.id);
    if (!deductionType) {
      return res.status(404).json({ message: "Deduction type not found" });
    }
    res.json({ message: "Deduction type deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
