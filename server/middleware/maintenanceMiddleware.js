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
