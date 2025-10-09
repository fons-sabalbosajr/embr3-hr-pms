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
      secureRemove("token");
      // Avoid spamming message if multiple concurrent 401s
      if (!window.__SESSION_EXPIRED_SHOWN__) {
        window.__SESSION_EXPIRED_SHOWN__ = true;
        message.error("Session expired. Please log in again.");
      }
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      const authPath = `${base}/auth` || "/auth";
      // Prevent redirect loop if we're already on auth page
      if (!window.location.pathname.endsWith("/auth")) {
        setTimeout(() => {
          window.location.replace(authPath);
        }, 500);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
