let ioInstance = null;

const userSockets = new Map();

export function setIO(io) {
  ioInstance = io;
}

export function registerSocket(userId, socketId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) return;

  if (!userSockets.has(uid)) {
    userSockets.set(uid, new Set());
  }
  userSockets.get(uid).add(socketId);
}

export function unregisterSocket(socketId) {
  for (const [uid, sockets] of userSockets.entries()) {
    if (sockets.has(socketId)) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        userSockets.delete(uid);
      }
      break;
    }
  }
}

export function emitToUsers(userIds = [], eventName, payload) {
  if (!ioInstance) return;

  const unique = [...new Set(userIds.map((u) => Number(u)).filter((u) => Number.isFinite(u)))];

  for (const uid of unique) {
    const sockets = userSockets.get(uid);
    if (!sockets) continue;

    for (const socketId of sockets) {
      ioInstance.to(socketId).emit(eventName, payload);
    }
  }
}
