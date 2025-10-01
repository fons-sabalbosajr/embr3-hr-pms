// scripts/migrateUserTypes.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js"; // adjust path if needed

dotenv.config(); // load .env variables

const MONGO_URI = process.env.MONGO_URI;

const runMigration = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI not found in .env");
    }

    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB...");

    const users = await User.find({});
    for (const user of users) {
      // skip if already has userType
      if (user.userType) {
        console.log(`➡️ ${user.username} already has userType: ${user.userType}`);
        continue;
      }

      // Rule 1: Hardcode you as Developer
      if (user.email === "slayerdark528@gmail.com") {
        user.userType = "developer";
      }
      // Rule 2: Admin + canManageUsers → Administrator
      else if (user.isAdmin && user.canManageUsers) {
        user.userType = "administrator";
      }
      // Rule 3: Admin but no manage users → Co-Admin
      else if (user.isAdmin) {
        user.userType = "co-admin";
      }
      // Rule 4: Default → Guest
      else {
        user.userType = "guest";
      }

      await user.save();
      console.log(`🔄 Updated ${user.username} → ${user.userType}`);
    }

    console.log("🎉 Migration completed.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
