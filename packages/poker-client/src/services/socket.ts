import { io } from "socket.io-client";

// The socket.io-client connection targets the current origin (Vite dev server)
// and gets proxied to the backend on port 3000 automatically, supporting ws upgrades.
// If VITE_SOCKET_URL is set in production, it will connect directly to that URL.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});
