import axios from "axios";
import { secureRetrieve, secureRemove } from "../../utils/secureStorage";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

//Attach token to all outgoing requests
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

//Auto logout on 401 (expired or invalid token)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      secureRemove("token");
      message.error("Session expired. Please log in again."); // 👈 Optional
      setTimeout(() => {
        window.location.href = "/auth";
      }, 1000); // allow time for message to show
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
