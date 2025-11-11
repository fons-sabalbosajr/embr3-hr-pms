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
      // Even if developers/admins exist, ensure their elevated flags are set correctly
      try {
        const devFlags = {
          isAdmin: true,
          canManageUsers: true,
          canViewDashboard: true,
          canViewEmployees: true,
          canEditEmployees: true,
          canViewDTR: true,
          canProcessDTR: true,
          canViewPayroll: true,
          canProcessPayroll: true,
          canViewTrainings: true,
          canEditTrainings: true,
          canAccessSettings: true,
          canChangeDeductions: true,
          canPerformBackup: true,
          canAccessNotifications: true,
          canManageNotifications: true,
          canViewNotifications: true,
          canViewMessages: true,
          canManageMessages: true,
          canAccessConfigSettings: true,
          canAccessDeveloper: true,
          canSeeDev: true,
          canManipulateBiometrics: true,
          showSalaryAmounts: true,
        };

        // Use updateMany with $set to avoid full document validation (some legacy users may be missing required fields like name)
        const updateResult = await User.updateMany(
          { $or: [{ userType: "developer" }, { isAdmin: true }] },
          { $set: devFlags },
          { runValidators: false }
        );
        if (updateResult.modifiedCount > 0) {
          console.log(`Ensured developer/admin flags on ${updateResult.modifiedCount} user(s)`);
        }
      } catch (e) {
        console.error("Failed to ensure developer flags during bootstrap", e);
      }
      return;
    }

    // Step 3: Promote the very first registered user to developer
    const oldestUser = await User.findOne().sort({ createdAt: 1 });

    if (oldestUser) {
      // Update via updateOne to avoid triggering validation on potentially legacy, partial documents
      await User.updateOne(
        { _id: oldestUser._id },
        { $set: { userType: "developer" } },
        { runValidators: false }
      );
      console.log(`Bootstrap complete: ${oldestUser.username} promoted to "developer"`);
    }
  } catch (error) {
    console.error("Migration error (userType):", error);
  }
};