import AuditLog from '../models/AuditLog.js';

/**
 * Helper to record an audit log entry. Never throws — failures are logged to console only.
 * @param {string} action - e.g. "auth:login", "employee:created"
 * @param {object} req - Express request (used for performedBy/performedByName)
 * @param {object} [details] - Additional info to store
 */
export const recordAudit = async (action, req, details = {}) => {
  try {
    const userId = req?.user?._id || req?.user?.id || null;
    const userName = req?.user?.name || req?.user?.email || req?.user?.username || 'system';
    await AuditLog.create({
      action,
      performedBy: userId,
      performedByName: userName,
      details,
    });
  } catch (e) {
    console.error('Audit log failed:', action, e.message);
  }
};
