const db = require("../models");
const User = db.users;
const DirectMessage = db.direct_messages;
const { Op } = db.Sequelize;
const { isOnline, sendToUser } = require("../../websocket/socialHandler");

function publicUser(user, me, lastMessage) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    playing: user.current_game_id != null,
    online: isOnline(user.id),
    lastMessage: lastMessage ? publicMessage(lastMessage, me) : null,
  };
}

function publicMessage(message, me) {
  return {
    id: String(message.id),
    fromUserId: message.from_user_id,
    toUserId: message.to_user_id,
    text: message.text,
    mine: message.from_user_id === me,
    createdAt: message.createdAt,
    roomCode: message.room_code || null,
    roomMode: message.room_mode || null,
  };
}

function parseRoom(body) {
  const roomCode = String(body.roomCode || body.room_code || "").trim();
  const roomMode = String(body.roomMode || body.room_mode || "").trim();
  if (!roomCode) return { room_code: null, room_mode: null };
  return {
    room_code: roomCode.slice(0, 32),
    room_mode: roomMode || "muushig",
  };
}

exports.contacts = async (req, res) => {
  const me = req.user.id;
  try {
    const users = (await User.findAll({
      where: { id: { [Op.ne]: me } },
      attributes: ["id", "username", "display_name", "current_game_id", "role"],
      limit: 300,
    })).filter((user) => user.role !== "admin");

    const history = await DirectMessage.findAll({
      where: {
        [Op.or]: [{ from_user_id: me }, { to_user_id: me }],
      },
      order: [["createdAt", "DESC"]],
    });

    const lastByPeer = new Map();
    for (const message of history) {
      const peer = message.from_user_id === me ? message.to_user_id : message.from_user_id;
      if (!lastByPeer.has(peer)) lastByPeer.set(peer, message);
    }

    const data = users.map((user) => publicUser(user, me, lastByPeer.get(user.id)));
    data.sort((a, b) => {
      const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (at !== bt) return bt - at;
      return String(a.display_name || "").localeCompare(String(b.display_name || ""), "mn");
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Could not load contacts",
    });
  }
};

exports.messages = async (req, res) => {
  const me = req.user.id;
  const peer = Number(req.params.userId);
  if (!peer) {
    return res.status(400).json({ success: false, message: "Invalid user" });
  }
  try {
    const rows = await DirectMessage.findAll({
      where: {
        [Op.or]: [
          { from_user_id: me, to_user_id: peer },
          { from_user_id: peer, to_user_id: me },
        ],
      },
      order: [["createdAt", "ASC"]],
      limit: 200,
    });
    res.json({ success: true, data: rows.map((row) => publicMessage(row, me)) });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Could not load messages",
    });
  }
};

exports.send = async (req, res) => {
  const me = req.user.id;
  const toUserId = Number(req.body.toUserId || req.body.to_user_id);
  const text = String(req.body.text || "").trim();
  if (!toUserId || toUserId === me) {
    return res.status(400).json({ success: false, message: "Invalid recipient" });
  }
  if (!text || text.length > 1000) {
    return res.status(400).json({ success: false, message: "Message is required" });
  }
  try {
    const peer = await User.findByPk(toUserId);
    if (!peer) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const room = parseRoom(req.body);
    const saved = await DirectMessage.create({
      from_user_id: me,
      to_user_id: toUserId,
      text,
      room_code: room.room_code,
      room_mode: room.room_mode,
    });
    const payload = {
      type: "directMessage",
      ...publicMessage(saved, me),
    };
    sendToUser(toUserId, { ...payload, mine: false });
    sendToUser(me, { ...payload, mine: true });
    res.json({ success: true, data: publicMessage(saved, me) });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Could not send message",
    });
  }
};
