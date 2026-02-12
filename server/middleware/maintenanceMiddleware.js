import Settings from '../models/Settings.js';

// Middleware to block non-developer users when maintenance mode is enabled
export default async function maintenanceMiddleware(req, res, next) {
  try {
    const settings = await Settings.getSingleton();
    const maintenance = settings?.maintenance;
    if (!maintenance || !maintenance.enabled) return next();

    // If user is authenticated and has developer role, allow through
    if (req.user && req.user.userType === 'developer') return next();

    // If date-range is set, only apply within the range
    if (maintenance.startDate && maintenance.endDate) {
      const now = new Date();
      if (now < new Date(maintenance.startDate) || now > new Date(maintenance.endDate)) {
        return next();
      }
    }

    // Otherwise return 503 with a maintenance message
    return res.status(503).json({
      message: maintenance.message || 'The system is under maintenance. Please try again later.',
      maintenance: {
        startDate: maintenance.startDate,
        endDate: maintenance.endDate,
      },
    });
  } catch (err) {
    console.error('Maintenance middleware error:', err);
    return next();
  }
}

/**
 * Returns the flat feature-maintenance map for the front-end.
 * Developers see everything — this is only for non-dev users.
 */
export async function getFeatureMaintenanceStatus(req, res) {
  try {
    const settings = await Settings.getSingleton();
    const fm = settings?.featureMaintenance;
    const obj = {};
    if (fm && typeof fm.forEach === 'function') {
      fm.forEach((val, key) => {
        obj[key] = { enabled: val.enabled, message: val.message, hidden: val.hidden };
      });
    }
    // Developers bypass
    const isDev = req.user && req.user.userType === 'developer';
    return res.json({ features: obj, isDeveloper: isDev });
  } catch (err) {
    console.error('Feature maintenance status error:', err);
    return res.json({ features: {}, isDeveloper: false });
  }
}
