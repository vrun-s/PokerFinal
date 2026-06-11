import { io } from "socket.io-client";

// The socket.io-client connection targets the current origin (Vite dev server)
// and gets proxied to the backend on port 3000 automatically, supporting ws upgrades.
export const socket = io({
  autoConnect: false,
});
