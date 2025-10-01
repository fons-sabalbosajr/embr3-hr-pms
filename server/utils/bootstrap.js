import User from "../models/User.js";

export const ensureUserTypes = async () => {
  try {
    // Step 1: Set "guest" for anyone missing userType
    const result = await User.updateMany(
      { userType: { $exists: false } },
      { $set: { userType: "guest" } }
    );

    if (result.modifiedCount > 0) {
      console.log(`Migrated ${result.modifiedCount} users -> userType: "guest"`);
    }

    // Step 2: Check if we already bootstrapped
    const devExists = await User.findOne({ userType: "developer" });
    const adminExists = await User.findOne({ userType: "administrator" });

    if (devExists || adminExists) {
      //console.log("Bootstrap skipped (developer/admin already exists).");
      return;
    }

    // Step 3: Promote the very first registered user to developer
    const oldestUser = await User.findOne().sort({ createdAt: 1 });

    if (oldestUser) {
      oldestUser.userType = "developer";
      await oldestUser.save();
      console.log(`Bootstrap complete: ${oldestUser.username} promoted to "developer"`);
    }
  } catch (error) {
    console.error("Migration error (userType):", error);
  }
};