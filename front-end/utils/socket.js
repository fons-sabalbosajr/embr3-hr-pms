import { io } from "socket.io-client";

// Prefer explicit socket URL, fall back to server URL, or derive from API URL by stripping /api
const deriveSocketUrl = () => {
  const explicit = import.meta.env.VITE_SOCKET_URL;
  if (explicit) return explicit;
  const serverUrl = import.meta.env.VITE_SERVER_URL;
  if (serverUrl) return serverUrl;
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) return apiUrl.replace(/\/?api\/?$/, "");
  return window.location.origin; // last resort
};

const SOCKET_BASE_URL = deriveSocketUrl();

const socket = io(SOCKET_BASE_URL, {
  path: "/socket.io",
  autoConnect: false, // Connect manually after auth
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  // Force long-polling to avoid WebSocket upgrade failures behind proxies/firewalls
  transports: ["polling"],
  upgrade: false,
});

export default socket;
