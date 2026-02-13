import { io } from "socket.io-client";

// Prefer explicit socket URL, fall back to server URL, or derive from API URL by stripping /api.
// In dev mode the Vite proxy already forwards /socket.io → server, so let the
// browser use its own origin (the Vite dev-server) to go through that proxy.
// This avoids issues where VITE_SERVER_URL is localhost (unreachable from LAN).
const deriveSocketUrl = () => {
  const explicit = import.meta.env.VITE_SOCKET_URL;
  if (explicit) return explicit;
  if (import.meta.env.DEV) return window.location.origin;
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
  // No cookies are used for Socket.IO; disable credentials for simpler CORS
  withCredentials: false,
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
