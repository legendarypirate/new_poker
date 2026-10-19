const jwt = require("jsonwebtoken");
const secretKey = process.env.JWT_SECRET || "your_secret_key";

const presence = new Map();

function socketsFor(userId) {
  const key = String(userId);
  if (!presence.has(key)) presence.set(key, new Set());
  return presence.get(key);
}

function identify(ws, userId) {
  remove(ws);
  const id = String(userId);
  ws.socialUserId = id;
  socketsFor(id).add(ws);
}

function remove(ws) {
  const id = ws.socialUserId;
  if (!id) return null;
  const sockets = presence.get(id);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) presence.delete(id);
  }
  ws.socialUserId = null;
  return sockets && sockets.size > 0 ? null : id;
}

function isOnline(userId) {
  const sockets = presence.get(String(userId));
  return !!(sockets && sockets.size > 0);
}

function onlineUserIds() {
  return [...presence.keys()].map((id) => Number(id)).filter((id) => !Number.isNaN(id));
}

function sendToUser(userId, payload) {
  const sockets = presence.get(String(userId));
  if (!sockets) return;
  const data = JSON.stringify(payload);
  for (const socket of sockets) {
    if (socket.readyState === 1) socket.send(data);
  }
}

function broadcastPresence(userId, online) {
  const payload = JSON.stringify({
    type: "presence",
    userId: Number(userId),
    online,
  });
  for (const sockets of presence.values()) {
    for (const socket of sockets) {
      if (socket.readyState === 1) socket.send(payload);
    }
  }
}

function handleSocialMessage(msg, ws) {
  if (msg.type !== "identify") return false;
  const token = msg.token;
  if (!token) {
    ws.send(JSON.stringify({ type: "error", message: "Token is missing" }));
    return true;
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.id;
    identify(ws, userId);
    ws.send(JSON.stringify({
      type: "identified",
      userId,
      onlineUserIds: onlineUserIds(),
    }));
    broadcastPresence(userId, true);
  } catch (_) {
    ws.send(JSON.stringify({ type: "error", message: "Token is invalid" }));
  }
  return true;
}

function removeSocialConnection(ws) {
  const wentOffline = remove(ws);
  if (wentOffline) broadcastPresence(wentOffline, false);
}

module.exports = {
  handleSocialMessage,
  removeSocialConnection,
  isOnline,
  onlineUserIds,
  sendToUser,
};
