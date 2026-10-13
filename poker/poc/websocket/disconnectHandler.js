const db = require('../app/models');

// Store disconnect timers: Map<userId_gameId, Timer>
const disconnectTimers = new Map();

// Store room game IDs: Map<roomId, gameId>
const roomGameIds = new Map();

/**
 * Set room's game ID
 */
function setRoomGameId(roomId, gameId) {
  roomGameIds.set(roomId, gameId);
}

/**
 * Get room's game ID
 */
function getRoomGameId(roomId) {
  return roomGameIds.get(roomId);
}

/**
 * Handle player disconnect - mark as disconnected and start 60s timer
 * Only works if game has started (checked in caller)
 */
async function handlePlayerDisconnect(userId, gameId, roomId, rooms, onAutoFold) {
  if (!userId || !gameId) return;

  // Check if game has started - only allow reconnection if game started
  const room = rooms[roomId];
  if (!room || !room.gameStarted) {
    console.log(`⚠️ Cannot start disconnect timer - game not started in room ${roomId}`);
    return;
  }

  const timerKey = `${userId}_${gameId}`;

  try {
    // Update PlayerState in database
    await db.player_states.update(
      {
        is_connected: false,
        disconnect_time: new Date(),
      },
      {
        where: {
          user_id: userId,
          game_id: gameId,
        }
      }
    );

    console.log(`⏱️ Player ${userId} disconnected from game ${gameId}, starting 60s reconnection timer`);

    // Clear any existing timer
    if (disconnectTimers.has(timerKey)) {
      clearTimeout(disconnectTimers.get(timerKey));
    }

    // Start 60 second timer
    const timer = setTimeout(async () => {
      console.log(`⏰ Timer expired for player ${userId} in game ${gameId}, auto-folding`);
      
      // Check if still disconnected
      const playerState = await db.player_states.findOne({
        where: { user_id: userId, game_id: gameId }
      });

      if (playerState && !playerState.is_connected) {
        // Auto-fold the player
        await onAutoFold(userId, gameId, roomId, rooms);
      }

      disconnectTimers.delete(timerKey);
    }, 60000); // 60 seconds

    disconnectTimers.set(timerKey, timer);
  } catch (error) {
    console.error(`Error handling disconnect for player ${userId}:`, error);
  }
}

/**
 * Handle player reconnect - cancel timer and mark as connected
 */
async function handlePlayerReconnect(userId, gameId) {
  if (!userId || !gameId) return;

  const timerKey = `${userId}_${gameId}`;

  try {
    // Clear timer if exists
    if (disconnectTimers.has(timerKey)) {
      clearTimeout(disconnectTimers.get(timerKey));
      disconnectTimers.delete(timerKey);
      console.log(`✅ Player ${userId} reconnected to game ${gameId}, timer cancelled`);
    }

    // Update PlayerState in database
    await db.player_states.update(
      {
        is_connected: true,
        disconnect_time: null,
        last_action_time: new Date(),
      },
      {
        where: {
          user_id: userId,
          game_id: gameId,
        }
      }
    );
  } catch (error) {
    console.error(`Error handling reconnect for player ${userId}:`, error);
  }
}

/**
 * Auto-fold player and resolve game state
 */
async function autoFoldPlayer(userId, gameId, roomId, rooms) {
  const room = rooms[roomId];
  if (!room) {
    console.log(`Room ${roomId} not found for auto-fold`);
    return;
  }

  const player = room.players.find(p => p.userId === userId);
  if (!player) {
    console.log(`Player ${userId} not found in room ${roomId}`);
    return;
  }

  console.log(`🔄 Auto-folding player ${userId} in game ${gameId}`);

  // If it's the player's turn, auto-pass
  if (room.currentPlayerIndex !== undefined && 
      room.players[room.currentPlayerIndex]?.userId === userId) {
    const { autoPass } = require('./gameHandler');
    const { startTurnTimer, clearTurnTimer } = require('./timerUtils');
    
    clearTurnTimer(roomId, rooms);
    
    const totalPlayers = room.players.length;
    room.passCount++;

    let resetLastPlay = false;
    if (room.passCount >= totalPlayers - 1 && room.lastPlay !== null) {
      room.lastPlay = null;
      room.passCount = 0;
      resetLastPlay = true;
    }

    const { broadcastToRoom } = require('./gameHandler');
    broadcastToRoom(roomId, {
      type: "opponentPass",
      player: player.playerId,
      resetLastPlay,
      autoPassed: true,
      disconnected: true
    }, rooms);

    // Move to next player
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % totalPlayers;
    const nextPlayer = room.players[room.currentPlayerIndex];
    
    if (nextPlayer) {
      startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => {
        autoPass(roomId, rooms, broadcastToRoom, (roomId) => {
          startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => {});
        });
      });
      
      broadcastToRoom(roomId, {
        type: "turn",
        player: nextPlayer.playerId,
      }, rooms);
    }
  }

  // Update user's current_game_id to null
  try {
    await db.users.update(
      { current_game_id: null },
      { where: { id: userId } }
    );

    // Remove player state
    await db.player_states.destroy({
      where: { user_id: userId, game_id: gameId }
    });

    console.log(`✅ Cleared current_game_id for user ${userId}`);
  } catch (error) {
    console.error(`Error clearing current_game_id for user ${userId}:`, error);
  }
}

/**
 * Check if user has an active game
 */
async function checkActiveGame(userId) {
  if (!userId) return null;

  try {
    const user = await db.users.findByPk(userId);
    if (!user || !user.current_game_id) {
      return null;
    }

    // Check if game is still active
    const game = await db.games.findByPk(user.current_game_id);
    if (!game || game.status !== 1) { // 1 = active
      // Game is finished, clear current_game_id
      await db.users.update(
        { current_game_id: null },
        { where: { id: userId } }
      );
      return null;
    }

    // Check player state
    const playerState = await db.player_states.findOne({
      where: {
        user_id: userId,
        game_id: user.current_game_id
      }
    });

    return {
      gameId: user.current_game_id,
      game: game,
      playerState: playerState
    };
  } catch (error) {
    console.error(`Error checking active game for user ${userId}:`, error);
    return null;
  }
}

/**
 * Create or update player state when joining game
 */
async function createOrUpdatePlayerState(userId, gameId, isConnected = true) {
  if (!userId || !gameId) return;

  try {
    const [playerState, created] = await db.player_states.findOrCreate({
      where: {
        user_id: userId,
        game_id: gameId
      },
      defaults: {
        user_id: userId,
        game_id: gameId,
        is_connected: isConnected,
        last_action_time: new Date(),
      }
    });

    if (!created) {
      // Update existing state
      await playerState.update({
        is_connected: isConnected,
        disconnect_time: isConnected ? null : new Date(),
        last_action_time: new Date(),
      });
    }

    // Update user's current_game_id
    await db.users.update(
      { current_game_id: gameId },
      { where: { id: userId } }
    );
  } catch (error) {
    console.error(`Error creating/updating player state:`, error);
  }
}

/**
 * Clear player state when game ends
 */
async function clearPlayerState(userId, gameId) {
  if (!userId || !gameId) return;

  try {
    // Clear user's current_game_id
    await db.users.update(
      { current_game_id: null },
      { where: { id: userId } }
    );

    // Remove player state
    await db.player_states.destroy({
      where: { user_id: userId, game_id: gameId }
    });

    // Clear any disconnect timer
    const timerKey = `${userId}_${gameId}`;
    if (disconnectTimers.has(timerKey)) {
      clearTimeout(disconnectTimers.get(timerKey));
      disconnectTimers.delete(timerKey);
    }
  } catch (error) {
    console.error(`Error clearing player state:`, error);
  }
}

module.exports = {
  handlePlayerDisconnect,
  handlePlayerReconnect,
  autoFoldPlayer,
  checkActiveGame,
  createOrUpdatePlayerState,
  clearPlayerState,
  setRoomGameId,
  getRoomGameId,
};

