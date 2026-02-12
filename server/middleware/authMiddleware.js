import jwt from "jsonwebtoken";

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer "))
      return res.status(401).json({ message: "Unauthorized: No token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // For richer context (name/email) look up user once and cache minimal fields
    // Only if id exists; fallback to decoded for legacy tokens.
    if (decoded?.id) {
      try {
        const { default: User } = await import("../models/User.js");
        const u = await User.findById(decoded.id)
          .select(
            [
              "name",
              "email",
              "username",
              "userType",
              "isAdmin",
              "isDemo",
              "avatarUrl",
              "theme",
              "showSalaryAmounts",
              "canManipulateBiometrics",
              "canManageUsers",
              "canViewDashboard",
              "canViewEmployees",
              "canEditEmployees",
              "canViewDTR",
              "canProcessDTR",
              "canViewPayroll",
              "canProcessPayroll",
              "canViewTrainings",
              "canEditTrainings",
              "canAccessSettings",
              "canChangeDeductions",
              "canPerformBackup",
              "canAccessNotifications",
              "canManageNotifications",
              "canViewNotifications",
              "canViewMessages",
              "canManageMessages",
              "canAccessConfigSettings",
              "canAccessDeveloper",
              "canSeeDev",
            ].join(" ")
          )
          .lean();
        if (u) {
          req.user = { ...decoded, ...u };
        } else {
          req.user = decoded;
        }
      } catch (e) {
        req.user = decoded;
      }
    } else {
      req.user = decoded;
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default verifyToken;
