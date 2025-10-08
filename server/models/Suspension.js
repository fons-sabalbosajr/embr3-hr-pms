import mongoose from "mongoose";

const suspensionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: { type: Date, required: true },
    endDate: { type: Date }, // optional range
    scope: { type: String, enum: ["National", "Regional", "Local"], default: "Local" },
    location: { type: String },
    referenceType: { type: String, enum: ["Memorandum", "Proclamation", "Order", "Other"], default: "Memorandum" },
    referenceNo: { type: String },
    attachmentUrl: { type: String },
    notes: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Suspension", suspensionSchema);
