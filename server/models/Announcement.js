import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },

    // "announcement" | "app-update" | "maintenance" | "general"
    type: { type: String, default: "announcement", enum: ["announcement", "app-update", "maintenance", "general"] },

    // Priority controls pop-up ordering: "critical" always shows first
    priority: { type: String, default: "normal", enum: ["low", "normal", "high", "critical"] },

    // Visibility
    active: { type: Boolean, default: true },
    // Pop-up in-app announcement (shown once per user)
    showPopup: { type: Boolean, default: true },
    // Email blast tracking
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    emailRecipientCount: { type: Number, default: 0 },
    // Store actual recipient emails for audit / display
    emailRecipients: { type: [String], default: [] },
    // Target audience: "all" | "division" | "section" | "specific"
    emailTargetMode: { type: String, default: "all", enum: ["all", "division", "section", "specific"] },
    // Filter values when mode is division/section
    emailTargetValues: { type: [String], default: [] },

    // Optional scheduling
    publishAt: { type: Date },
    expiresAt: { type: Date },

    // Who created / last edited
    createdBy: { type: String },
    updatedBy: { type: String },

    // Track which users have dismissed the pop-up
    dismissedBy: [{ type: String }],
  },
  { timestamps: true }
);

// Index for fast active-announcement queries
announcementSchema.index({ active: 1, publishAt: 1, expiresAt: 1 });

export default mongoose.model("Announcement", announcementSchema);
