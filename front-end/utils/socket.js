import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_API_URL, {
  path: "/socket.io/",
  autoConnect: false, // We will connect manually after login
  withCredentials: true,
});

export default socket;
