import mongoose from "mongoose";

const { Schema, model } = mongoose;

const TrainingSchema = new Schema(
  {
    name: { type: String, required: true },
    host: { type: String }, // section/division
    venue: { type: String },
    trainingDate: { type: [Date], required: true }, // can be single date or range
    participants: [
      {
        empId: { type: String },
        empNo: { type: String },
        name: { type: String },
        type: { type: String },
        position: { type: String },
        sectionOrUnit: { type: String },
        division: { type: String },
      },
    ],
    iisTransaction: { type: String },
  },
  { timestamps: true }
);

export default model("Training", TrainingSchema);
