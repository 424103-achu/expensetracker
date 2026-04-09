import { io } from "socket.io-client";

let socket = null;

export function getRealtimeSocket(userId) {
  if (!userId) {
    return null;
  }

  if (!socket) {
    const base = import.meta.env.VITE_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}:5001`;
    socket = io(base, {
      transports: ["websocket", "polling"],
      query: { userId: String(userId) }
    });
  }

  return socket;
}

export function closeRealtimeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
