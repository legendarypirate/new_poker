const db = require("../models");
const User = db.users;
const DirectMessage = db.direct_messages;
const FriendRequest = db.friend_requests;
const { Op } = db.Sequelize;
const { isOnline, sendToUser } = require("../../websocket/socialHandler");
const { fromPublicId, toPublicId } = require("../../utils/ids");

function publicUser(user, me, lastMessage) {
  return {
    id: user.id,
    public_id: toPublicId(user.id),
    username: user.username,
    display_name: user.display_name || user.username,
    avatar_url: user.avatar_url || null,
    playing: user.current_game_id != null,
    online: isOnline(user.id),
    lastMessage: lastMessage ? publicMessage(lastMessage, me) : null,
  };
}

async function acceptedFriendIds(me) {
  const rows = await FriendRequest.findAll({
    where: {
      status: "accepted",
      [Op.or]: [{ from_user_id: me }, { to_user_id: me }],
    },
    attributes: ["from_user_id", "to_user_id"],
  });
  const ids = new Set();
  for (const row of rows) {
    ids.add(row.from_user_id === me ? row.to_user_id : row.from_user_id);
  }
  return ids;
}

async function usersWithLastMessage(me, userRows) {
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
  const data = userRows.map((user) => publicUser(user, me, lastByPeer.get(user.id)));
  data.sort((a, b) => {
    const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    if (at !== bt) return bt - at;
    return String(a.display_name || "").localeCompare(String(b.display_name || ""), "mn");
  });
  return data;
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
    const friendIds = await acceptedFriendIds(me);
    const history = await DirectMessage.findAll({
      where: {
        [Op.or]: [{ from_user_id: me }, { to_user_id: me }],
      },
      attributes: ["from_user_id", "to_user_id"],
    });
    const peerIds = new Set(friendIds);
    for (const message of history) {
      peerIds.add(
        message.from_user_id === me ? message.to_user_id : message.from_user_id,
      );
    }
    peerIds.delete(me);
    if (peerIds.size === 0) {
      return res.json({ success: true, data: [] });
    }
    const users = (await User.findAll({
      where: { id: { [Op.in]: [...peerIds] } },
      attributes: ["id", "username", "display_name", "avatar_url", "current_game_id", "role"],
    })).filter((user) => user.role !== "admin");

    const data = await usersWithLastMessage(me, users);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Could not load contacts",
    });
  }
};

exports.friends = async (req, res) => {
  const me = req.user.id;
  try {
    const friendIds = await acceptedFriendIds(me);
    if (friendIds.size === 0) {
      return res.json({ success: true, data: [] });
    }
    const users = (await User.findAll({
      where: { id: { [Op.in]: [...friendIds] } },
      attributes: ["id", "username", "display_name", "avatar_url", "current_game_id", "role"],
    })).filter((user) => user.role !== "admin");
    const data = await usersWithLastMessage(me, users);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Could not load friends",
    });
  }
};

exports.searchUsers = async (req, res) => {
  const me = req.user.id;
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return res.status(400).json({ success: false, message: "Query too short" });
  }
  try {
    const orClauses = [
      { username: { [Op.like]: `%${q}%` } },
      { display_name: { [Op.like]: `%${q}%` } },
    ];
    const asPublic = fromPublicId(q);
    if (asPublic) orClauses.push({ id: asPublic });
    const asId = Number(q);
    if (Number.isFinite(asId) && asId > 0 && asId !== me) {
      orClauses.push({ id: asId });
    }

    const users = (await User.findAll({
      where: {
        id: { [Op.ne]: me },
        role: { [Op.ne]: "admin" },
        [Op.or]: orClauses,
      },
      attributes: ["id", "username", "display_name", "avatar_url", "current_game_id", "role"],
      limit: 20,
    }));

    const friendIds = await acceptedFriendIds(me);
    const pending = await FriendRequest.findAll({
      where: {
        status: "pending",
        [Op.or]: [
          { from_user_id: me },
          { to_user_id: me },
        ],
      },
    });
    const outgoing = new Set(
      pending.filter((row) => row.from_user_id === me).map((row) => row.to_user_id),
    );
    const incoming = new Set(
      pending.filter((row) => row.to_user_id === me).map((row) => row.from_user_id),
    );

    const data = users.map((user) => ({
      ...publicUser(user, me, null),
      isFriend: friendIds.has(user.id),
      requestOutgoing: outgoing.has(user.id),
      requestIncoming: incoming.has(user.id),
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Search failed",
    });
  }
};

exports.friendRequests = async (req, res) => {
  const me = req.user.id;
  try {
    const rows = await FriendRequest.findAll({
      where: { to_user_id: me, status: "pending" },
      order: [["createdAt", "DESC"]],
      limit: 50,
    });
    const fromIds = rows.map((row) => row.from_user_id);
    const users = fromIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: fromIds } },
          attributes: ["id", "username", "display_name", "avatar_url", "current_game_id", "role"],
        })
      : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    const data = rows
      .map((row) => {
        const user = byId.get(row.from_user_id);
        if (!user || user.role === "admin") return null;
        return publicUser(user, me, null);
      })
      .filter(Boolean);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Could not load friend requests",
    });
  }
};

exports.sendFriendRequest = async (req, res) => {
  const me = req.user.id;
  const toUserId = Number(req.body.toUserId || req.body.to_user_id);
  if (!toUserId || toUserId === me) {
    return res.status(400).json({ success: false, message: "Invalid recipient" });
  }
  try {
    const peer = await User.findByPk(toUserId);
    if (!peer || peer.role === "admin") {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const friendIds = await acceptedFriendIds(me);
    if (friendIds.has(toUserId)) {
      return res.status(409).json({ success: false, message: "Already friends" });
    }
    const reverse = await FriendRequest.findOne({
      where: { from_user_id: toUserId, to_user_id: me, status: "pending" },
    });
    if (reverse) {
      reverse.status = "accepted";
      await reverse.save();
      return res.json({ success: true, accepted: true });
    }
    const existing = await FriendRequest.findOne({
      where: { from_user_id: me, to_user_id: toUserId },
    });
    if (existing) {
      if (existing.status === "pending") {
        return res.json({ success: true, pending: true });
      }
      if (existing.status === "accepted") {
        return res.status(409).json({ success: false, message: "Already friends" });
      }
      existing.status = "pending";
      await existing.save();
      return res.json({ success: true, pending: true });
    }
    await FriendRequest.create({
      from_user_id: me,
      to_user_id: toUserId,
      status: "pending",
    });
    res.json({ success: true, pending: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Could not send request",
    });
  }
};

exports.acceptFriendRequest = async (req, res) => {
  const me = req.user.id;
  const fromUserId = Number(req.params.fromUserId);
  if (!fromUserId) {
    return res.status(400).json({ success: false, message: "Invalid user" });
  }
  try {
    const row = await FriendRequest.findOne({
      where: { from_user_id: fromUserId, to_user_id: me, status: "pending" },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    row.status = "accepted";
    await row.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Could not accept request",
    });
  }
};

exports.declineFriendRequest = async (req, res) => {
  const me = req.user.id;
  const fromUserId = Number(req.params.fromUserId);
  if (!fromUserId) {
    return res.status(400).json({ success: false, message: "Invalid user" });
  }
  try {
    const row = await FriendRequest.findOne({
      where: { from_user_id: fromUserId, to_user_id: me, status: "pending" },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    row.status = "declined";
    await row.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Could not decline request",
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
