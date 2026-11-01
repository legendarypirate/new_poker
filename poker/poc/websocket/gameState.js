const rooms = {};
const roomReadyStatus = new Map();

function serializeRoom(roomId, room) {
  if (!room) return null;
  const players = (room.players || []).map((p) => ({
    playerId: p.playerId,
    userId: p.userId || p.playerId,
    username: p.username || p.displayName || `User ${p.playerId}`,
    connected: !!(p.ws && p.ws.readyState === 1),
    isSpectator: !!p.isSpectator,
  }));
  const spectators = (room.spectators || []).map((s) => ({
    userId: s.userId,
    username: s.username || "Spectator",
    connected: !!(s.ws && s.ws.readyState === 1),
  }));
  return {
    roomId,
    originalRoomId: room.originalRoomId || roomId,
    gameId: room.gameId || null,
    gameType: room.gameType || "mongol_13",
    buyIn: room.buyIn || 0,
    maxPlayers: room.maxPlayers || 4,
    tournamentId: room.tournamentId || null,
    gameStarted: !!room.gameStarted,
    gameFinished: !!room.gameFinished,
    playerCount: players.length,
    spectatorCount: spectators.length,
    currentPlayerIndex: room.currentPlayerIndex ?? 0,
    players,
    spectators,
  };
}

function listLiveRooms() {
  return Object.entries(rooms)
    .map(([roomId, room]) => serializeRoom(roomId, room))
    .filter(Boolean)
    .sort((a, b) => Number(b.gameStarted) - Number(a.gameStarted));
}

function getRoom(roomId) {
  return rooms[roomId] || null;
}

module.exports = {
  rooms,
  roomReadyStatus,
  serializeRoom,
  listLiveRooms,
  getRoom,
};
