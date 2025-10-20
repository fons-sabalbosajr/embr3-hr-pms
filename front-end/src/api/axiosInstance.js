import axios from "axios";
import { message } from "antd";
import { secureRetrieve, secureRemove } from "../../utils/secureStorage";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // e.g. [http://10.14.77.107:5000/api](http://10.14.77.107:5000/api)
  withCredentials: true,
});

// Attach token automatically
axiosInstance.interceptors.request.use(
  (config) => {
    const token = secureRetrieve("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 → auto logout + redirect to auth screen (respecting Vite base path)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token on any 401
      secureRemove("token");

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
        message.error("Session expired. Please log in again.");
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
