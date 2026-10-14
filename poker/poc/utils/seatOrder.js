const { toPublicId } = require('./ids');

function shuffleIds(ids) {
  const next = [...ids];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function ensureSeatOrder(room) {
  if (!room) return [];
  const liveIds = (room.players || []).map((p) => p.playerId);
  const live = new Set(liveIds);
  room.seatOrder = Array.isArray(room.seatOrder) ? room.seatOrder.slice() : [];
  if (!room.seatOrderLocked) {
    room.seatOrder = room.seatOrder.filter((id) => live.has(id));
    for (const id of liveIds) {
      if (!room.seatOrder.includes(id)) {
        const at = Math.floor(Math.random() * (room.seatOrder.length + 1));
        room.seatOrder.splice(at, 0, id);
      }
    }
  } else {
    for (const id of liveIds) {
      if (!room.seatOrder.includes(id)) room.seatOrder.push(id);
    }
  }
  return room.seatOrder;
}

function allocateSeatOrder(room, { fresh = false } = {}) {
  if (!room) return [];
  if (fresh) room.seatOrderLocked = false;
  ensureSeatOrder(room);
  if (fresh || !room.seatOrderLocked) {
    if (fresh) room.seatOrder = shuffleIds(room.seatOrder);
    room.seatOrderLocked = true;
  }
  return room.seatOrder;
}

function seatedPlayerInfo(player) {
  return {
    playerId: player.playerId,
    username: player.username,
    displayName: player.displayName || player.username,
    avatarUrl: player.avatarUrl || player.avatar_url || '',
    userId: player.userId,
    publicId: toPublicId(player.userId),
    handCount: player.hand ? player.hand.length : 0,
  };
}

function seatedPlayersMessage(room, extra = {}) {
  const order = ensureSeatOrder(room);
  const byId = new Map((room.players || []).map((p) => [p.playerId, p]));
  const players = order.map((id) => byId.get(id)).filter(Boolean).map(seatedPlayerInfo);
  return {
    type: 'seatedPlayers',
    players,
    seatOrder: order.slice(),
    ...extra,
  };
}

module.exports = {
  shuffleIds,
  ensureSeatOrder,
  allocateSeatOrder,
  seatedPlayersMessage,
};
