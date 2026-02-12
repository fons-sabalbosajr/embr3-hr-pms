const normalizePermissions = (permissions) => {
  if (!permissions) return [];
  return Array.isArray(permissions) ? permissions : [permissions];
};

const forbidden = (res) =>
  res.status(403).json({ success: false, message: "Forbidden" });

export const requirePermissions = (permissions, options = {}) => {
  const required = normalizePermissions(permissions);
  const { any = false, allowAdmin = true, allowDeveloper = true } = options;

  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Treat developer accounts as privileged (similar to admin)
    if (allowDeveloper && user.userType === "developer") return next();

    if (allowAdmin && user.isAdmin) return next();

    if (required.length === 0) return next();

    const hasPermission = (key) => Boolean(user?.[key]);
    const ok = any
      ? required.some(hasPermission)
      : required.every(hasPermission);

    if (!ok) return forbidden(res);

    return next();
  };
};

export const requireAnyPermission = (permissions, options = {}) =>
  requirePermissions(permissions, { ...options, any: true });
