import dayjs from 'dayjs';
import { getSettings } from '../utils/settingsCache.js';
import demoActions from '../utils/demoActionsRegistry.js';

// Determine if the request is a write/mutation
const isWriteMethod = (method) => ['POST','PUT','PATCH','DELETE'].includes(String(method || 'GET').toUpperCase());

// Normalize URL path (ensure leading /api for matching)
const normalizePath = (req) => {
  try {
    const base = '/api';
    const url = String(req.originalUrl || req.url || '')
      .replace(/\?.*$/, '') // strip query
      .replace(/#.*$/, '');
    return url.startsWith('/api') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  } catch {
    return String(req.path || '/');
  }
};

// Check if current request matches any disabled action pattern given demo settings
const matchesDisabledAction = (req, disabledKeys) => {
  const method = String(req.method || 'GET').toUpperCase();
  const path = normalizePath(req);
  return demoActions.some((a) => {
    if (!disabledKeys.has(a.key)) return false;
    if (!(a.methods || []).includes(method)) return false;
    const patterns = a.urlPatterns || [];
    return patterns.some((re) => {
      try { return re.test(path); } catch { return false; }
    });
  });
};

// Server-side demo enforcement: for users marked isDemo when demo is active.
// - If an action is in disabled list, block it.
// - Else if allowSubmissions is false and method is write, block it (read-only mode).
// Privileged users are bypassed (developer/admin/canAccessDeveloper/canSeeDev/canManageUsers).
export default async function demoEnforcement(req, res, next) {
  try {
    // Only consider write requests; GET always allowed
    if (!isWriteMethod(req.method)) return next();

    // Always allow bug report submissions, even in demo read-only
    try {
      const p = normalizePath(req);
      if (p.startsWith('/api/bug-report')) return next();
    } catch {}

    // req.user is attached by verifyToken on protected routes; for unprotected, nothing to enforce
    const user = req.user || {};

    // Load demo settings (cached)
    const settings = await getSettings();
    const demo = settings?.demo || {};

    // Is demo globally active (and within date range)?
    const enabled = Boolean(demo.enabled);
    const now = dayjs();
    const inRange = (demo.startDate && demo.endDate)
      ? (now.isAfter(dayjs(demo.startDate)) && now.isBefore(dayjs(demo.endDate).add(1,'second')))
      : true;
    if (!enabled || !inRange) return next();

    // Privileged bypass
    const isPrivileged = Boolean(
      user?.userType === 'developer' ||
      user?.isAdmin ||
      user?.canAccessDeveloper ||
      user?.canSeeDev ||
      user?.canManageUsers
    );

    // Only enforce for demo users and non-privileged
    const isDemoUser = Boolean(user?.isDemo);
    if (!isDemoUser || isPrivileged) return next();

    const disabledKeys = new Set(Array.isArray(demo.allowedActions) ? demo.allowedActions : []);

    // If this request matches a disabled action, block it.
    if (matchesDisabledAction(req, disabledKeys)) {
      return res.status(403).json({ success: false, message: 'This action is disabled in demo mode.' });
    }

    // If submissions not allowed, block all remaining writes
    if (!demo.allowSubmissions) {
      return res.status(403).json({ success: false, message: 'Demo mode is read-only. Submissions are disabled.' });
    }

    // Otherwise, allow
    return next();
  } catch (e) {
    // Fail-open to avoid blocking legitimate requests if middleware errors
    return next();
  }
}
