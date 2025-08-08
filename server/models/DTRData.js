import mongoose from "mongoose";

const dtrDataSchema = new mongoose.Schema(
  {
    DTR_Record_Name: { type: String, required: true },
    
    // Date range: start and end
    DTR_Cut_Off: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },

    Uploaded_By: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    Uploaded_Date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("DTRData", dtrDataSchema);
