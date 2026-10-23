const { toPublicId } = require('./ids');

function maxSeatsFor(room) {
  if (!room) return 4;
  if (room.maxPlayers) return room.maxPlayers;
  return room.gameType === 'muushig' ? 5 : 4;
}

function shuffleIds(ids) {
  const next = [...ids];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function ensureSeatSlots(room) {
  const max = maxSeatsFor(room);
  if (!room) return [];
  if (!Array.isArray(room.seatSlots) || room.seatSlots.length !== max) {
    const next = Array(max).fill(null);
    if (Array.isArray(room.seatSlots)) {
      for (let i = 0; i < Math.min(room.seatSlots.length, max); i++) {
        next[i] = room.seatSlots[i];
      }
    } else if (Array.isArray(room.seatOrder) && room.seatOrder.length > 0) {
      for (let i = 0; i < Math.min(room.seatOrder.length, max); i++) {
        next[i] = room.seatOrder[i];
      }
    }
    room.seatSlots = next;
  }
  return room.seatSlots;
}

function clearPlayerSeat(room, playerId) {
  if (!room || playerId == null) return;
  ensureSeatSlots(room);
  for (let i = 0; i < room.seatSlots.length; i++) {
    if (room.seatSlots[i] === playerId) {
      room.seatSlots[i] = null;
    }
  }
}

function playerSeatIndex(room, playerId) {
  if (!room || playerId == null) return -1;
  ensureSeatSlots(room);
  return room.seatSlots.indexOf(playerId);
}

function isPlayerSeated(room, playerId) {
  return playerSeatIndex(room, playerId) >= 0;
}

function seatedPlayerIds(room) {
  ensureSeatSlots(room);
  return room.seatSlots.filter((id) => id != null);
}

function ensureSeatOrder(room) {
  if (!room) return [];
  ensureSeatSlots(room);
  const liveIds = new Set((room.players || []).map((p) => p.playerId));
  for (let i = 0; i < room.seatSlots.length; i++) {
    const id = room.seatSlots[i];
    if (id != null && !liveIds.has(id)) {
      room.seatSlots[i] = null;
    }
  }
  room.seatOrder = Array.isArray(room.seatOrder) ? room.seatOrder.slice() : [];
  if (!room.seatOrderLocked) {
    room.seatOrder = seatedPlayerIds(room);
  } else {
    room.seatOrder = room.seatOrder.filter((id) => liveIds.has(id));
    for (const id of seatedPlayerIds(room)) {
      if (!room.seatOrder.includes(id)) room.seatOrder.push(id);
    }
  }
  return room.seatOrder;
}

function syncPlayersToSeatOrder(room) {
  const order = ensureSeatOrder(room);
  if (!room || !Array.isArray(room.players) || order.length === 0) return order;
  const currentId = room.players[room.currentPlayerIndex]?.playerId;
  const dealerId = room.muushig != null
    ? room.players[room.muushig.dealerIndex]?.playerId
    : undefined;
  const byId = new Map(room.players.map((player) => [player.playerId, player]));
  const ordered = [];
  for (const id of order) {
    const player = byId.get(id);
    if (player) {
      ordered.push(player);
      byId.delete(id);
    }
  }
  for (const player of byId.values()) ordered.push(player);
  room.players = ordered;
  if (currentId != null) {
    const index = room.players.findIndex((player) => player.playerId === currentId);
    if (index >= 0) room.currentPlayerIndex = index;
  }
  if (room.muushig && dealerId != null) {
    const index = room.players.findIndex((player) => player.playerId === dealerId);
    if (index >= 0) room.muushig.dealerIndex = index;
  }
  return order;
}

function allocateSeatOrder(room, { fresh = false } = {}) {
  if (!room) return [];
  if (fresh) room.seatOrderLocked = false;
  ensureSeatOrder(room);
  if (fresh || !room.seatOrderLocked) {
    if (fresh) {
      const ids = seatedPlayerIds(room);
      room.seatOrder = shuffleIds(ids);
    }
    room.seatOrderLocked = true;
  }
  syncPlayersToSeatOrder(room);
  return room.seatOrder;
}

function seatedPlayerInfo(player) {
  const autoPlay = !player.ws || player.ws.readyState !== 1;
  return {
    playerId: player.playerId,
    username: player.username,
    displayName: player.displayName || player.username,
    avatarUrl: player.avatarUrl || player.avatar_url || '',
    userId: player.userId,
    publicId: toPublicId(player.userId),
    handCount: player.hand ? player.hand.length : 0,
    autoPlay,
  };
}

function seatedPlayersMessage(room, extra = {}) {
  const order = ensureSeatOrder(room);
  const slots = ensureSeatSlots(room).slice();
  const maxSeats = slots.length;
  const byId = new Map((room.players || []).map((p) => [p.playerId, p]));
  const players = order.map((id) => byId.get(id)).filter(Boolean).map(seatedPlayerInfo);
  const dealerId = room.muushig != null
    ? room.players[room.muushig.dealerIndex]?.playerId
    : undefined;
  return {
    type: 'seatedPlayers',
    players,
    seatOrder: order.slice(),
    seatSlots: slots,
    maxSeats,
    ...(dealerId != null ? { dealer: dealerId } : {}),
    ...extra,
  };
}

function chooseSeat(room, player, seatIndex) {
  if (!room || !player) return { ok: false, error: 'Invalid room' };
  if (room.gameStarted && !room.gameFinished) {
    return { ok: false, error: 'Game already started' };
  }
  ensureSeatSlots(room);
  const max = room.seatSlots.length;
  const index = Number(seatIndex);
  if (!Number.isInteger(index) || index < 0 || index >= max) {
    return { ok: false, error: 'Invalid seat' };
  }
  if (room.seatSlots[index] != null && room.seatSlots[index] !== player.playerId) {
    return { ok: false, error: 'Seat is taken' };
  }
  clearPlayerSeat(room, player.playerId);
  room.seatSlots[index] = player.playerId;
  room.seatOrderLocked = false;
  ensureSeatOrder(room);
  return { ok: true, seatIndex: index };
}

module.exports = {
  maxSeatsFor,
  shuffleIds,
  ensureSeatSlots,
  clearPlayerSeat,
  playerSeatIndex,
  isPlayerSeated,
  seatedPlayerIds,
  ensureSeatOrder,
  allocateSeatOrder,
  syncPlayersToSeatOrder,
  seatedPlayersMessage,
  chooseSeat,
};
