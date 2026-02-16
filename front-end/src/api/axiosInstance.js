import axios from "axios";
import { swalError } from "../utils/swalHelper";
import { secureRetrieve, secureRemove, secureStore, secureGet, secureSessionGet, secureSessionRemove, secureClearAll } from "../../utils/secureStorage";
import demoActions from "../utils/demoActionsRegistry";

// Prefer explicit API base via VITE_API_URL; fall back to Vite dev proxy path '/api' for local dev
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api", // e.g. http://<server>:5000/api (prod) or '/api' (dev proxy)
  withCredentials: true,
});

// Attach token automatically
axiosInstance.interceptors.request.use(
  (config) => {
    // Prefer per-tab session token; fall back to legacy local if present
    const token = secureSessionGet("token") || secureRetrieve("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Client-side demo enforcement: deny-list (disabled actions) + optional global read-only
    try {
      const user = secureSessionGet('user') || secureGet('user');
      const app = secureSessionGet('appSettings') || secureGet('appSettings');
      const method = String(config.method || 'get').toUpperCase();
      const isWrite = ['POST','PUT','PATCH','DELETE'].includes(method);
      if (isWrite && user?.isDemo) {
        const demo = app?.demo || {};
        const now = new Date();
        const inRange = demo?.startDate && demo?.endDate ? (now >= new Date(demo.startDate) && now <= new Date(demo.endDate)) : true;
        // Privileged users (developer/admin/dev-access) are exempt from client-side demo blocking
        const isPrivileged = Boolean(
          user?.userType === 'developer' ||
          user?.isAdmin ||
          user?.canAccessDeveloper ||
          user?.canSeeDev ||
          user?.canManageUsers
        );
        if (demo?.enabled && inRange && !isPrivileged) {
          const disabled = new Set(demo?.allowedActions || []); // treated as disabled actions in demo
          // Normalize request path to include base '/api'
          const rawUrl = String(config.url || '');
          const base = String(config.baseURL || '').replace(/\/$/, '');
          const path = rawUrl.startsWith('/api') ? rawUrl : `${base}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
          // If a write matches any disabled action, block immediately
          const matchesDisabled = demoActions.some(a =>
            disabled.has(a.key) &&
            a.methods?.includes(method) &&
            (a.urlPatterns || []).some((re) => {
              try { return re.test(path); } catch { return false; }
            })
          );
          if (matchesDisabled) {
            const err = new Error('This action is disabled in demo mode.');
            err.isDemoBlocked = true;
            return Promise.reject(err);
          }
          // If global submissions are OFF, block all remaining writes (read-only)
          if (!demo?.allowSubmissions) {
            const err = new Error('Demo mode is read-only. Submissions are disabled.');
            err.isDemoBlocked = true;
            return Promise.reject(err);
          }
        }
      }
    } catch(_) { /* ignore */ }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 → auto logout + redirect to auth screen (respecting Vite base path)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 403) {
      // Permission revoked or insufficient access
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      const currentPath = (window.location.pathname || "").replace(base, "") || "/";
      const isPublicRoute = (
        currentPath === "/" ||
        currentPath === "/auth" ||
        currentPath === "/requests" ||
        currentPath === "/payslip" ||
        currentPath === "/dtr-employee-request" ||
        currentPath.startsWith("/verify/") ||
        currentPath.startsWith("/reset-password")
      );

      if (!window.__FORBIDDEN_SHOWN__) {
        window.__FORBIDDEN_SHOWN__ = true;
        swalError("You don't have permission to access this.");
        setTimeout(() => {
          window.__FORBIDDEN_SHOWN__ = false;
        }, 3000);
      }

      const unauthorizedPath = `${base}/unauthorized` || "/unauthorized";
      const alreadyOnUnauthorized = window.location.pathname.endsWith("/unauthorized");

      if (!isPublicRoute && !alreadyOnUnauthorized) {
        setTimeout(() => {
          window.location.replace(unauthorizedPath);
        }, 200);
      }
    }
    if (error.response && error.response.status === 401) {
      // Only force-logout when the server says the token itself is invalid/expired.
      // Avoid logging out on 401s that are just permission/auth issues on specific endpoints.
      const msg = (error.response.data?.message || "").toLowerCase();
      const isTokenIssue =
        msg.includes("expired") ||
        msg.includes("invalid") ||
        msg.includes("no token") ||
        msg.includes("unauthorized") ||
        msg.includes("jwt");

      if (!isTokenIssue) {
        // Not a token problem — just reject without clearing session
        return Promise.reject(error);
      }

      // Clear ALL encrypted/obfuscated keys from localStorage & sessionStorage (same as manual logout)
      try { secureClearAll(); } catch {}

      // Determine if current location is a public route that should not force redirect
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      const currentPath = (window.location.pathname || "").replace(base, "") || "/";
      const isPublicRoute = (
        currentPath === "/" ||
        currentPath === "/auth" ||
        currentPath === "/requests" ||
        currentPath === "/payslip" ||
        currentPath === "/dtr-employee-request" ||
        currentPath.startsWith("/verify/") ||
        currentPath.startsWith("/reset-password")
      );

      // Avoid spamming message if multiple concurrent 401s
      if (!window.__SESSION_EXPIRED_SHOWN__) {
        window.__SESSION_EXPIRED_SHOWN__ = true;
        swalError("Session expired. Please log in again.");
      }

      const authPath = `${base}/auth` || "/auth";

      // If not on a public page, redirect to /auth. On public pages, just clear token and stay.
      const alreadyOnAuth = window.location.pathname.endsWith("/auth");
      if (!isPublicRoute && !alreadyOnAuth) {
        setTimeout(() => {
          window.location.replace(authPath);
        }, 500);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
