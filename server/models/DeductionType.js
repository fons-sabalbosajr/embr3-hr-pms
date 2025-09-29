import mongoose from 'mongoose';

const DeductionTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  type: {
    type: String,
    enum: ['deduction', 'incentive'],
    required: true,
  },
  calculationType: {
    type: String,
    enum: ['fixed', 'formula'],
    default: 'fixed',
  },
  amount: {
    type: Number,
    default: 0,
  },
  formula: {
    type: String,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
});

export default mongoose.model("DeductionType", DeductionTypeSchema);