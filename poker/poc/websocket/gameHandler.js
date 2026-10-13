const { evaluateHand, canPlayCards } = require('../utils/handEvaluator');
const { removeCardsFromHand } = require('../utils/cardUtils');
const { dealCards, checkRoundOver } = require('../utils/gameLogic');
const { startTurnTimer, clearTurnTimer, startAutoStartCountdown, cancelAutoStart, resetSinglePlayerWinnerTimer, clearSinglePlayerWinnerTimer } = require('./timerUtils');
const { getUserChat } = require('./adminHandler');
const {
  handlePlayerDisconnect: handleDisconnectTimer,
  handlePlayerReconnect,
  autoFoldPlayer,
  checkActiveGame,
  createOrUpdatePlayerState,
  clearPlayerState,
  setRoomGameId,
  getRoomGameId
} = require('./disconnectHandler');
const db = require('../app/models');

function broadcastToRoom(roomId, message, rooms) {
  const room = rooms[roomId];
  if (!room) return;

  room.players.forEach((p) => {
    if (p.ws && p.ws.readyState === 1) { // WebSocket.OPEN
      p.ws.send(JSON.stringify(message));
    }
  });

  // Also broadcast to spectators
  if (room.spectators) {
    room.spectators.forEach((s) => {
      if (s.ws && s.ws.readyState === 1) { // WebSocket.OPEN
        s.ws.send(JSON.stringify(message));
      }
    });
  }
}

function broadcastPlayerCount(roomId, rooms, wss = null) {
  const room = rooms[roomId];
  if (!room) return;
  const count = room.players.length;

  // Use original room ID for client display
  const displayRoomId = room.originalRoomId || roomId.replace(/_\d+k$/, '');

  const message = {
    type: "playerCount",
    roomId: displayRoomId, // Send original room ID to client
    players: count,
    maxPlayers: 4,
  };

  // Broadcast to players in the room
  broadcastToRoom(roomId, message, rooms);

  // Also broadcast to all connected clients (for room selection screens)
  // This ensures room count updates are visible even when not in the room
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(JSON.stringify(message));
        } catch (e) {
          console.error('Error broadcasting player count:', e);
        }
      }
    });
  }
}

function autoPass(roomId, rooms, broadcastToRoom, startTurnTimerFn) {
  const { clearTurnTimer } = require('./timerUtils');
  const room = rooms[roomId];
  if (!room || room.players.length === 0) {
    console.log(`⚠️ Room ${roomId} not found or empty during auto-pass`);
    clearTurnTimer(roomId, rooms);
    return;
  }

  // Check if currentPlayerIndex is valid
  if (room.currentPlayerIndex === undefined || room.currentPlayerIndex >= room.players.length) {
    console.log(`⚠️ Invalid currentPlayerIndex in room ${roomId}, resetting to 0`);
    room.currentPlayerIndex = 0;
  }

  const currentPlayer = room.players[room.currentPlayerIndex];

  // Double-check that currentPlayer exists
  if (!currentPlayer) {
    console.log(`❌ Current player is undefined in room ${roomId}, cannot auto-pass`);
    clearTurnTimer(roomId, rooms);
    return;
  }

  console.log(`⏰ Auto-pass for player ${currentPlayer.playerId} in room ${roomId}`);

  room.passCount++;

  let resetLastPlay = false;

  if (room.passCount >= room.players.length - 1 && room.lastPlay !== null) {
    console.log(`🔄 Round reset in room ${roomId}`);
    room.lastPlay = null;
    room.passCount = 0;
    resetLastPlay = true;
  }

  broadcastToRoom(roomId, {
    type: "opponentPass",
    player: currentPlayer.playerId,
    resetLastPlay,
    autoPassed: true
  }, rooms);

  // Move to next player with bounds checking
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;

  // Verify the next player exists before starting timer
  const nextPlayer = room.players[room.currentPlayerIndex];
  if (nextPlayer) {
    // Verify rooms still exists before calling startTurnTimerFn
    if (rooms && rooms[roomId]) {
      // startTurnTimerFn expects (roomId) but we need to pass all required params
      // The function is already bound with rooms, broadcastToRoom, and autoPassFn
      startTurnTimerFn(roomId);

      broadcastToRoom(roomId, {
        type: "turn",
        player: nextPlayer.playerId,
      }, rooms);
    } else {
      console.log(`⚠️ Room ${roomId} no longer exists, cannot continue turn`);
      clearTurnTimer(roomId, rooms);
    }
  } else {
    console.log(`❌ Next player is undefined in room ${roomId}, cannot continue turn`);
    clearTurnTimer(roomId, rooms);
  }
}

async function startGame(roomId, rooms, roomReadyStatus, broadcastToRoomFn, startTurnTimerFn) {
  const { cancelAutoStart } = require('./timerUtils');
  const { dealCards } = require('../utils/gameLogic');
  const room = rooms[roomId];
  if (!room) {
    console.error(`❌ Room ${roomId} not found when starting game`);
    return;
  }

  const isTexas = room.gameType === 'texas';
  const numPlayers = room.players.length;

  if (isTexas && numPlayers < 2) {
    console.error(`❌ Texas Hold'em requires at least 2 players`);
    return;
  }

  console.log(`🎮 Starting ${isTexas ? 'Texas Hold\'em' : 'game'} in room ${roomId} with ${numPlayers} players`);

  if (roomReadyStatus.has(roomId)) {
    roomReadyStatus.delete(roomId);
  }

  // Create game record in database
  try {
    const originalRoomId = room.originalRoomId || roomId.replace(/_\d+k$/, '');
    const roomNumber = isTexas ? 0 : (parseInt(originalRoomId.replace(/\D/g, '')) || parseInt(originalRoomId.replace('room_', '')) || 1);
    const playerUserIds = room.players.map(p => p.userId).filter(Boolean);

    console.log(`💾 Creating game record: roomNumber=${roomNumber}, buyIn=${room.buyIn}, players=${playerUserIds.length}, gameType=${room.gameType}`);

    const gameRecord = await db.games.create({
      room_id: roomNumber,
      status: 1, // active
      players: playerUserIds,
      buy_in: room.buyIn || null,
      game_type: room.gameType || 'mongol_13',
      start_time: new Date(),
      room_key: roomId || null, // websocket room id for admin spectate
    });

    room.gameId = gameRecord.game_id;
    setRoomGameId(roomId, gameRecord.game_id);

    for (let player of room.players) {
      if (player.userId) {
        await createOrUpdatePlayerState(player.userId, gameRecord.game_id, true);
      }
    }

    console.log(`✅ Created game record ${gameRecord.game_id} for room ${roomId}`);
  } catch (error) {
    console.error(`❌ Error creating game record:`, error);
  }

  room.playerPoints = {};
  for (let player of room.players) {
    room.playerPoints[player.playerId] = 0;
  }

  room.gameStarted = true;
  room.gameFinished = false;
  room.allPlayersLeft = false;

  cancelAutoStart(roomId, rooms);

  if (isTexas) {
    const { initTexasHand } = require('../utils/texasHoldemLogic');
    const texasState = initTexasHand(room);
    if (!texasState) {
      console.error(`❌ Failed to init Texas hand in room ${roomId}`);
      return;
    }
    const t = room.texas;
    // Send each player their hole cards privately
    room.players.forEach((p) => {
      if (p.ws && p.ws.readyState === 1 && t.holeCards[p.playerId]) {
        p.ws.send(JSON.stringify({
          type: 'texasHoleCards',
          hand: t.holeCards[p.playerId],
          playerId: p.playerId,
        }));
      }
    });
    // Broadcast hand start (no hole cards)
    broadcastToRoomFn(roomId, {
      type: 'texasHandStart',
      communityCards: [],
      pot: t.pot,
      currentBet: t.currentBet,
      dealer: t.playersOrder[t.dealerIndex],
      smallBlind: t.playersOrder[t.sbIndex],
      bigBlind: t.playersOrder[t.bbIndex],
      actingPlayer: t.playersOrder[t.actingIndex],
      stacks: t.stacks,
      bets: t.bets,
      phase: 'preflop',
    }, rooms);
    broadcastToRoomFn(roomId, {
      type: 'texasTurn',
      actingPlayer: t.playersOrder[t.actingIndex],
      pot: t.pot,
      currentBet: t.currentBet,
    }, rooms);
    broadcastToRoomFn(roomId, { type: 'gameStart' }, rooms);
    console.log(`🚀 Texas Hold'em hand started in room ${roomId}`);
    return;
  }

  const { resetSinglePlayerWinnerTimer } = require('./timerUtils');
  resetSinglePlayerWinnerTimer(roomId, rooms, (roomId, winnerPlayer) => {
    handleSinglePlayerWinner(roomId, winnerPlayer, rooms, broadcastToRoomFn);
  });

  dealCards(roomId, rooms, startTurnTimerFn, broadcastToRoomFn);

  const starter = room.players[room.currentPlayerIndex];
  broadcastToRoomFn(roomId, {
    type: "gameStart",
    firstPlayer: starter ? starter.playerId : null,
    points: room.playerPoints || {},
    loseAt: 30,
  });

  console.log(`🚀 Game started in room ${roomId}`);
}

/**
 * Handle single player winner (only one player left for 60 seconds)
 * This function is called by the timer, so it needs to access rooms and broadcastToRoom
 */
async function handleSinglePlayerWinner(roomId, winnerPlayer, rooms, broadcastToRoom) {
  const room = rooms[roomId];
  if (!room || !room.gameStarted || room.gameFinished) return;

  console.log(`🏆 Declaring ${winnerPlayer.playerId} (${winnerPlayer.username}) as winner - only player left for 60 seconds`);

  // Mark game as finished
  room.gameFinished = true;

  // Convert playerId to userId for winner
  const winnerUserId = winnerPlayer.userId;
  const winnerPlayerId = winnerPlayer.playerId;

  // Handle game finish (this will reduce balance unless all players left)
  const { handleGameFinish } = require('../utils/gameLogic');
  await handleGameFinish(roomId, room, winnerUserId, winnerPlayerId).catch(err => {
    console.error("Error handling single player winner:", err);
  });

  // Clear player states for all players
  const { clearPlayerState } = require('./disconnectHandler');
  const gameId = room.gameId || getRoomGameId(roomId);
  if (gameId) {
    for (const player of room.players) {
      if (player.userId) {
        await clearPlayerState(player.userId, gameId).catch(err => {
          console.error(`Error clearing player state for user ${player.userId}:`, err);
        });
      }
    }
  }

  // Broadcast game over
  broadcastToRoom(roomId, {
    type: 'gameOver',
    winner: winnerPlayerId,
    points: room.playerPoints || {},
    eliminatedPlayers: [],
    singlePlayerWinner: true
  }, rooms);

  console.log(`✅ Single player winner declared for room ${roomId}`);
}

function handleGameMessage(msg, ws, player, roomId, rooms, roomReadyStatus, broadcastToRoom) {
  // Handle messages that don't require being in a room
  if (msg.type === 'getRoomStatuses') {
    const roomStatuses = {};
    const requestedBuyIn = msg.buyIn ? Number(msg.buyIn) : null;

    // If buy-in is specified, only show rooms matching that buy-in
    // Otherwise, aggregate by original room ID
    for (const [id, room] of Object.entries(rooms)) {
      // Skip if buy-in filter is specified and doesn't match
      if (requestedBuyIn !== null && room.buyIn !== requestedBuyIn) {
        continue;
      }

      const originalRoomId = room.originalRoomId || id.replace(/_\d+k$/, ''); // Remove _20k suffix
      if (!roomStatuses[originalRoomId]) {
        roomStatuses[originalRoomId] = 0;
      }
      roomStatuses[originalRoomId] += room.players.length;
    }
    ws.send(JSON.stringify({
      type: "initialRoomData",
      rooms: roomStatuses
    }));
    return true;
  }


  if (msg.type === 'ping') {
    ws.send(JSON.stringify({ type: "pong" }));
    return true;
  }

  if (!roomId || !rooms[roomId]) {
    return false;
  }

  const room = rooms[roomId];

  // Texas Hold'em action (fold, call, raise, check, allin)
  if (room.gameType === 'texas' && msg.type === 'texasAction') {
    const { processTexasAction } = require('../utils/texasHoldemLogic');
    const { handleGameFinish } = require('../utils/gameLogic');
    const result = processTexasAction(roomId, rooms, player.playerId, msg.action, msg.amount, broadcastToRoom);
    if (!result.ok) {
      ws.send(JSON.stringify({ type: 'error', message: result.error || 'Invalid action' }));
      return true;
    }
    if (result.gameOver && result.winner != null) {
      const winnerPlayer = room.players.find(p => p.playerId === result.winner);
      room.gameFinished = true;
      handleGameFinish(roomId, room, result.winnerUserId || (winnerPlayer && winnerPlayer.userId), result.winner).catch(err => {
        console.error('Error handling Texas game finish:', err);
      });
      const { saveUserStatistics } = require('../utils/gameLogic');
      saveUserStatistics(room, result.winner, rooms).catch(err => console.error('Error saving Texas stats:', err));
      const { clearPlayerState } = require('./disconnectHandler');
      if (room.gameId) {
        room.players.forEach(p => {
          if (p.userId) clearPlayerState(p.userId, room.gameId).catch(() => {});
        });
      }
      broadcastToRoom(roomId, { type: 'gameOver', winner: result.winner, isTexas: true }, rooms);
    }
    return true;
  }

  const currentPlayer = room.players[room.currentPlayerIndex];

  switch (msg.type) {
    case "getSeatedPlayers": {
      if (!roomId || !rooms[roomId]) {
        ws.send(JSON.stringify({
          type: "error",
          message: "Not in a room"
        }));
        return true;
      }

      const room = rooms[roomId];
      ws.send(JSON.stringify({
        type: "seatedPlayers",
        players: room.players.map((p) => ({
          playerId: p.playerId,
          username: p.username,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl || p.avatar_url,
          userId: p.userId
        })),
      }));
      return true;
    }

    case "playerReady": {
      const { ready } = msg;

      if (!roomReadyStatus.has(roomId)) {
        roomReadyStatus.set(roomId, new Map());
      }

      const readyStatus = roomReadyStatus.get(roomId);
      readyStatus.set(player.playerId, !!ready);

      const currentIds = new Set(room.players.map((p) => p.playerId));
      for (const id of Array.from(readyStatus.keys())) {
        if (!currentIds.has(id)) readyStatus.delete(id);
      }

      broadcastToRoom(roomId, {
        type: "playerReadyStatus",
        status: Object.fromEntries(readyStatus)
      }, rooms);

      const totalPlayers = room.players.length;
      const readyPlayers = room.players.filter((p) => readyStatus.get(p.playerId)).length;

      console.log(`✅ Player ${player.playerId} ready: ${ready} (${readyPlayers}/${totalPlayers} ready)`);

      // Only start countdown when ALL seated players are ready
      if (readyPlayers === totalPlayers && totalPlayers >= 2) {
        console.log(`🚀 All ${totalPlayers} players ready, starting countdown in room ${roomId}`);
        const { startAutoStartCountdown } = require('./timerUtils');
        const { startTurnTimer } = require('./timerUtils');
        startAutoStartCountdown(roomId, rooms, broadcastToRoom, (roomId) => {
          startGame(roomId, rooms, roomReadyStatus, broadcastToRoom, (roomId) => {
            const boundStartTurnTimer = (roomId) => {
              startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
            };
            boundStartTurnTimer(roomId);
          });
        });
      } else {
        // Cancel countdown if not all players are ready
        const { cancelAutoStart } = require('./timerUtils');
        cancelAutoStart(roomId, rooms);
      }
      return true;
    }

    case "startGame": {
      const readyStatus = roomReadyStatus.get(roomId);
      const totalPlayers = room.players.length;
      const readyPlayers = readyStatus
        ? room.players.filter((p) => readyStatus.get(p.playerId)).length
        : 0;

      // Require ALL seated players to be ready before starting
      if (readyPlayers === totalPlayers && totalPlayers >= 2) {
        console.log(`🎮 Manual game start in room ${roomId} (all ${totalPlayers} players ready)`);
        const { cancelAutoStart, startTurnTimer } = require('./timerUtils');
        cancelAutoStart(roomId, rooms);
        startGame(roomId, rooms, roomReadyStatus, broadcastToRoom, (roomId) => {
          const boundStartTurnTimer = (roomId) => {
            startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
          };
          boundStartTurnTimer(roomId);
        });

        broadcastToRoom(roomId, {
          type: "gameStart"
        }, rooms);
      } else {
        ws.send(JSON.stringify({
          type: "error",
          message: `Need all ${totalPlayers} players to be ready to start`
        }));
      }
      return true;
    }

    case "autoStartGame": {
      console.log(`⏰ Auto-start triggered for room ${roomId}`);
      const { startTurnTimer } = require('./timerUtils');
      startGame(roomId, rooms, roomReadyStatus, broadcastToRoom, (roomId) => {
        const boundStartTurnTimer = (roomId) => {
          startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
        };
        boundStartTurnTimer(roomId);
      });

      broadcastToRoom(roomId, {
        type: "gameStart"
      }, rooms);
      return true;
    }

    case "gameOver": {
      const room = rooms[roomId];
      if (room) {
        room.lastPlay = null;
        room.passCount = 0;
        room.currentPlayerIndex = 0;
        room.gameFinished = true; // Mark game as finished so players can be removed when they disconnect
        console.log(`🎯 Final game over processed for room ${roomId}`);
      }
      return true;
    }

    case "getReadyStatus": {
      const readyStatus = roomReadyStatus.get(roomId) || new Map();
      ws.send(JSON.stringify({
        type: "playerReadyStatus",
        status: Object.fromEntries(readyStatus)
      }));
      return true;
    }

    case "move": {
      if (!player || player.playerId !== currentPlayer.playerId) {
        ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
        return true;
      }

      if (!msg.cards || !Array.isArray(msg.cards)) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid cards" }));
        return true;
      }

      // Validate card combination
      const handEvaluation = evaluateHand(msg.cards);
      if (handEvaluation.rank === 'Invalid') {
        ws.send(JSON.stringify({ type: "error", message: "Invalid card combination" }));
        return true;
      }

      // Check if play is valid against last play
      if (!canPlayCards(msg.cards, room.lastPlay)) {
        ws.send(JSON.stringify({ type: "error", message: "Cannot play these cards against current play" }));
        return true;
      }

      clearTurnTimer(roomId, rooms);

      // Update player's last_action_time to show they're active
      if (player.userId && room.gameId) {
        const { createOrUpdatePlayerState } = require('./disconnectHandler');
        createOrUpdatePlayerState(player.userId, room.gameId, true).catch(err => {
          console.error(`Error updating player state for move:`, err);
        });
      }

      room.lastPlay = { cards: msg.cards, evaluation: handEvaluation, player: player.playerId };
      room.passCount = 0;

      player.hand = removeCardsFromHand(player.hand, msg.cards);

      // Broadcast move with updated card counts for all players
      const { getPlayerCardCounts } = require('../utils/gameLogic');
      const cardCounts = getPlayerCardCounts(room);

      // Debug: Log card counts to ensure they're correct
      console.log(`📊 Card counts after move by player ${player.playerId}:`, cardCounts);
      console.log(`📊 Player ${player.playerId} hand length: ${player.hand.length}`);

      broadcastToRoom(roomId, {
        type: "opponentMove",
        player: player.playerId,
        cards: msg.cards,
        cardCounts: cardCounts, // Include card counts in the message - includes ALL players
      }, rooms);

      // Check if this move ended the round (player has no cards left)
      let roundEnded = false;
      if (player.hand.length === 0) {
        console.log(`🔍 Player ${player.playerId} played last card, checking round end`);
        roundEnded = checkRoundOver(roomId, rooms, (roomId) => clearTurnTimer(roomId, rooms), (roomId, message) => broadcastToRoom(roomId, message, rooms));
      }

      // Only continue to next player if round didn't end
      if (!roundEnded) {
        const { startTurnTimer } = require('./timerUtils');
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
        const boundStartTurnTimer = (roomId) => {
          startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
        };
        boundStartTurnTimer(roomId);

        broadcastToRoom(roomId, {
          type: "turn",
          player: room.players[room.currentPlayerIndex].playerId,
        }, rooms);
      }
      return true;
    }

    case "pass": {
      if (!player || player.playerId !== currentPlayer.playerId) {
        ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
        return true;
      }

      clearTurnTimer(roomId, rooms);

      // Update player's last_action_time to show they're active
      if (player.userId && room.gameId) {
        const { createOrUpdatePlayerState } = require('./disconnectHandler');
        createOrUpdatePlayerState(player.userId, room.gameId, true).catch(err => {
          console.error(`Error updating player state for pass:`, err);
        });
      }

      const totalPlayers = room.players.length;
      room.passCount++;

      let resetLastPlay = false;

      if (room.passCount >= totalPlayers - 1 && room.lastPlay !== null) {
        console.log(`🔄 Round reset in room ${roomId}`);
        room.lastPlay = null;
        room.passCount = 0;
        resetLastPlay = true;
      }

      broadcastToRoom(roomId, {
        type: "opponentPass",
        player: player.playerId,
        resetLastPlay,
      }, rooms);

      const { startTurnTimer } = require('./timerUtils');
      room.currentPlayerIndex = (room.currentPlayerIndex + 1) % totalPlayers;
      const boundStartTurnTimer = (roomId) => {
        startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
      };
      boundStartTurnTimer(roomId);

      broadcastToRoom(roomId, {
        type: "turn",
        player: room.players[room.currentPlayerIndex].playerId,
      }, rooms);
      return true;
    }

    case "restart": {
      if (room.players.length >= 2) {
        const { dealCards } = require('../utils/gameLogic');
        const { startTurnTimer } = require('./timerUtils');
        // Reset for new game completely
        room.playerPoints = {};
        for (let player of room.players) {
          room.playerPoints[player.playerId] = 0;
        }
        room.lastPlay = null;
        room.passCount = 0;
        room.currentPlayerIndex = 0;

        const boundStartTurnTimer = (roomId) => {
          startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
        };
        dealCards(roomId, rooms, boundStartTurnTimer, broadcastToRoom);

        broadcastToRoom(roomId, {
          type: "gameRestarted"
        }, rooms);
      } else {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Need at least 2 players to start",
          })
        );
      }
      return true;
    }

    case "chat": {
      if (!player || !msg.message || typeof msg.message !== 'string') {
        ws.send(JSON.stringify({ type: "error", message: "Invalid chat message" }));
        return true;
      }

      // Broadcast chat message to all players in the room
      const room = rooms[roomId];
      if (room) {
        broadcastToRoom(roomId, {
          type: "chatMessage",
          playerId: player.playerId,
          username: player.username || `Player ${player.playerId}`,
          message: msg.message,
          timestamp: Date.now(),
        }, rooms);
      }
      return true;
    }

    default:
      return false;
  }
}

async function handleJoinRoom(msg, ws, rooms, roomReadyStatus, broadcastToRoom, broadcastPlayerCount) {
  // Normalize roomId: trim whitespace, convert to lowercase, ensure consistent format
  let requestedRoomId = (msg.roomId || '').toString().trim().toLowerCase();
  const username = msg.username;
  const userId = msg.userId || msg.user_id; // Support both formats
  const displayName = msg.displayName || msg.display_name || username;
  const avatarUrl = msg.avatarUrl || msg.avatar_url || '';
  // Normalize buyIn: ensure it's a number
  const buyIn = msg.buyIn !== undefined ? Number(msg.buyIn) : (msg.buy_in !== undefined ? Number(msg.buy_in) : null);
  const gameType = msg.gameType || msg.game_type || 'mongol_13'; // Default game type

  // Texas Hold'em: single table per buy-in, no room selection — join "texas_20k" etc.
  const isTexas = gameType === 'texas';
  if (isTexas) {
    if (!buyIn) {
      ws.send(JSON.stringify({ type: "error", message: "Buy-in is required for Texas Hold'em" }));
      return null;
    }
    requestedRoomId = 'texas';
  }

  // Cash Game (mongol_13): no room selection — matchmaking by buy-in. Join existing table with 1–3 players (game not started) or create new table.
  const isCash = gameType === 'mongol_13' && (requestedRoomId === 'cash' || requestedRoomId === '');
  if (isCash) {
    if (!buyIn) {
      ws.send(JSON.stringify({ type: "error", message: "Buy-in is required for Cash Game" }));
      return null;
    }
    const actualBuyInNum = Number(buyIn);
    const base = `cash_${actualBuyInNum}k`;
    const joinable = Object.entries(rooms).find(([id, r]) => {
      const sameBuyIn = r.buyIn === actualBuyInNum;
      const sameType = (r.gameType || 'mongol_13') === 'mongol_13';
      const notStarted = !r.gameStarted;
      const hasSpace = r.players && r.players.length < 4;
      return sameBuyIn && sameType && notStarted && hasSpace;
    });
    if (joinable) {
      requestedRoomId = joinable[0];
      console.log(`🎯 Cash matchmaking: joining existing table ${requestedRoomId} (${joinable[1].players.length}/4 players)`);
    } else {
      const taken = Object.keys(rooms).filter(k => k === base || k.startsWith(base + '_'));
      let id = base;
      let n = 1;
      while (taken.includes(id)) {
        id = `${base}_${n}`;
        n++;
      }
      requestedRoomId = id;
      console.log(`🆕 Cash matchmaking: creating new table ${requestedRoomId}`);
    }
  }

  // Create composite room key that includes buy-in to ensure proper separation
  let actualBuyIn = buyIn;
  let compositeRoomId = buyIn ? `${requestedRoomId}_${buyIn}k` : requestedRoomId;

  // For cash we already set requestedRoomId to the actual table id (cash_20k or cash_20k_1), so compositeRoomId should be that id, not cash_20k_20k
  if (isCash && buyIn) {
    compositeRoomId = requestedRoomId;
  }

  // If buyIn is not provided (non-Texas, non-Cash only), try to find existing room with same base roomId
  if (!buyIn && !isTexas && !isCash) {
    // Look for existing room with same base roomId (could be with any buyIn)
    const existingRoomKey = Object.keys(rooms).find(key => {
      const baseKey = key.replace(/_\d+k$/, '');
      return baseKey === requestedRoomId;
    });

    if (existingRoomKey) {
      const existingRoom = rooms[existingRoomKey];
      if (existingRoom && existingRoom.buyIn) {
        actualBuyIn = existingRoom.buyIn;
        compositeRoomId = existingRoomKey;
        console.log(`🔄 No buyIn provided, using existing room's buyIn: ${actualBuyIn} (room: ${compositeRoomId})`);
      }
    }
  }

  console.log(`🎮 Join room request: originalRoomId="${msg.roomId}", normalizedRoomId="${requestedRoomId}", buyIn=${buyIn}, actualBuyIn=${actualBuyIn}, compositeRoomId="${compositeRoomId}"`);

  // Use composite room ID to ensure proper separation by buy-in
  const actualRoomId = compositeRoomId;

  if (!username) {
    ws.send(JSON.stringify({ type: "error", message: "Username is required" }));
    return null;
  }

  // Check if user has an active game (if userId is provided)
  if (userId) {
    const activeGame = await checkActiveGame(userId);
    if (activeGame && activeGame.gameId) {
      // User has an active game
      const gameId = activeGame.gameId;
      const playerState = activeGame.playerState;

      // Check if player is trying to rejoin the same room
      const roomNumber = parseInt(requestedRoomId.replace(/\D/g, '')) || null;
      const activeGameRecord = activeGame.game;

      if (activeGameRecord && activeGameRecord.room_id === roomNumber && activeGameRecord.buy_in === buyIn) {
        // Trying to rejoin the same game - allow it (will be handled by existing player check)
        console.log(`🔄 User ${userId} attempting to rejoin game ${gameId}`);
      } else {
        // Check if the active game still has connected players
        // If all players left, the game should be finished
        try {
          const activeGameRecord = activeGame.game;
          if (activeGameRecord) {
            // Check if game is still active in database
            const currentGame = await db.games.findByPk(gameId);
            if (!currentGame || currentGame.status !== 1) {
              // Game is already finished, allow joining
              console.log(`✅ Game ${gameId} is already finished, allowing user ${userId} to join new room`);
            } else {
              // Check player states to see if any players are still connected
              const playerStates = await db.player_states.findAll({
                where: { game_id: gameId }
              });

              const hasConnectedPlayers = playerStates.some(ps => ps.is_connected === true);

              if (!hasConnectedPlayers) {
                // All players disconnected - finish the game
                console.log(`🏁 All players disconnected from game ${gameId}, finishing game`);
                await db.games.update(
                  { status: 2, end_time: new Date() },
                  { where: { game_id: gameId } }
                );

                // Clear all player states
                await db.player_states.destroy({
                  where: { game_id: gameId }
                });

                // Clear current_game_id for all users in this game
                await db.users.update(
                  { current_game_id: null },
                  { where: { current_game_id: gameId } }
                );

                console.log(`✅ Game ${gameId} finished due to all players disconnecting`);
                // Allow user to join new room
              } else {
                // User has an active game but is joining again (e.g. page refresh). Clear their state
                // so they can re-join; treat as "left the previous game".
                console.log(`🔄 User ${userId} re-joining (e.g. refresh); clearing state for game ${gameId} so they can join`);
                await clearPlayerState(userId, gameId);
                // Allow join to continue
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error checking active game status:`, error);
          // On error, allow joining to prevent blocking
        }
      }
    }
  }

  // Validate balance if buy-in is 20k (value 20)
  if (buyIn === 20) {
    if (!userId) {
      ws.send(JSON.stringify({
        type: "error",
        message: "User ID is required to play in 20k games. Please log in again."
      }));
      return null;
    }

    try {
      const user = await db.users.findByPk(userId);
      if (!user) {
        ws.send(JSON.stringify({ type: "error", message: "User not found" }));
        return null;
      }

      const accountBalance = parseFloat(user.account_balance) || 0;
      if (accountBalance < 20000) {
        ws.send(JSON.stringify({
          type: "error",
          message: "Insufficient balance. You need at least 20,000 to play in 20k games. Please deposit funds to continue."
        }));
        return null;
      }
    } catch (error) {
      console.error("Error checking user balance:", error);
      ws.send(JSON.stringify({ type: "error", message: "Error validating balance" }));
      return null;
    }
  }

  const tournamentId = msg.tournamentId || null;

  if (!rooms[actualRoomId]) {
    console.log(`🆕 Creating new room: ${actualRoomId} with buyIn=${actualBuyIn}`);
    rooms[actualRoomId] = {
      players: [],
      currentPlayerIndex: 0,
      lastPlay: null,
      passCount: 0,
      playerPoints: {},
      buyIn: actualBuyIn || null,
      gameType: gameType,
      tournamentId: tournamentId || null,
      originalRoomId: requestedRoomId, // Keep original for display purposes
      spectators: [], // Initialize spectators array
      maxPlayers: isTexas ? 9 : 4
    };
  } else {
    const existingRoom = rooms[actualRoomId];
    console.log(`✅ Room exists: ${actualRoomId} with ${existingRoom.players.length} players`);
    if (isTexas && existingRoom.players.length >= 9) {
      ws.send(JSON.stringify({ type: "error", message: "Texas Hold'em table is full (max 9 players)" }));
      return null;
    }
    if (tournamentId) {
      existingRoom.tournamentId = tournamentId;
    }
  }

  const room = rooms[actualRoomId];

  // Validate buy-in matches (should always match due to composite key, but double-check)
  if (room.buyIn && actualBuyIn && room.buyIn !== actualBuyIn) {
    console.error(`❌ Buy-in mismatch: room has ${room.buyIn}, player sent ${actualBuyIn}`);
    ws.send(JSON.stringify({
      type: "error",
      message: `This room is for ${room.buyIn}k buy-in. Please select the correct buy-in.`
    }));
    return null;
  }

  // Set buy-in and game type if not already set (use actualBuyIn which may have been inferred)
  if (!room.buyIn && actualBuyIn) {
    room.buyIn = actualBuyIn;
  }
  if (!room.gameType) {
    room.gameType = gameType;
  }

  // Check if username already exists in the room (reconnection)
  // Only allow reconnection if game has started (60 second window)
  const existingPlayer = room.players.find((p) => p.username === username || (userId && p.userId === userId));
  if (existingPlayer) {
    // Check if reconnection is allowed (only if game started)
    if (room.gameStarted && !room.gameFinished) {
      existingPlayer.ws = ws;
      const player = existingPlayer;
      const roomId = actualRoomId;

      // Handle reconnection - mark as connected (only if game started)
      if (userId && room.gameId) {
        await handlePlayerReconnect(userId, room.gameId);
      }

      // Reset single player winner timer since player reconnected
      if (room.gameStarted && !room.gameFinished) {
        const { resetSinglePlayerWinnerTimer } = require('./timerUtils');
        resetSinglePlayerWinnerTimer(roomId, rooms, (roomId, winnerPlayer) => {
          handleSinglePlayerWinner(roomId, winnerPlayer, rooms, broadcastToRoom);
        });
      }

      ws.send(
        JSON.stringify({
          type: "roomJoined",
          roomId: requestedRoomId, // Send original roomId to client
          playerId: player.playerId,
          reconnected: true,
          gameType: room.gameType || 'mongol_13',
        })
      );

      ws.send(
        JSON.stringify({
          type: "seatedPlayers",
          players: room.players.map((p) => ({
            playerId: p.playerId,
            username: p.username,
            displayName: p.displayName || p.username,
            avatarUrl: p.avatarUrl || p.avatar_url || '',
            userId: p.userId
          })),
        })
      );

      // Send current points if available
      if (room.playerPoints && Object.keys(room.playerPoints).length > 0) {
        ws.send(JSON.stringify({
          type: "gameState",
          points: room.playerPoints,
          gameEnded: false
        }));
      }

      if (roomReadyStatus.has(roomId)) {
        const readyStatus = roomReadyStatus.get(roomId);
        ws.send(JSON.stringify({
          type: "playerReadyStatus",
          status: Object.fromEntries(readyStatus)
        }));
      }

      if (player.hand && player.hand.length > 0) {
        ws.send(JSON.stringify({
          type: "hand",
          hand: player.hand,
          player: player.playerId,
        }));
      }

      const turnPlayer = (room.gameType === 'texas' && room.texas?.playersOrder && room.texas.actingIndex != null)
        ? room.texas.playersOrder[room.texas.actingIndex]
        : room.currentPlayerIndex !== undefined ? room.players[room.currentPlayerIndex]?.playerId : undefined;
      if (turnPlayer !== undefined) {
        ws.send(JSON.stringify({ type: "turn", player: turnPlayer }));
      }

      if (room.lastPlay) {
        ws.send(JSON.stringify({
          type: "opponentMove",
          player: room.lastPlay.player,
          cards: room.lastPlay.cards,
          isInitialState: true
        }));
      }

      // Broadcast to other players that this player has reconnected
      broadcastToRoom(roomId, {
        type: "playerReconnected",
        player: player.playerId,
        username: player.username,
      }, rooms);

      console.log(`🔄 Player ${player.playerId} reconnected to room ${roomId} (${username})`);
      return { player, roomId };
    } else {
      // Game hasn't started or is finished - treat as new join
      // Remove old player entry and add as new
      room.players = room.players.filter((p) => p.playerId !== existingPlayer.playerId);
      console.log(`🔄 Player ${existingPlayer.playerId} rejoining room ${actualRoomId} (game not started or finished, treating as new join)`);
      // Continue to create new player below
    }
  }

  if (room.players.length >= 4 && !msg.isSpectator) {
    ws.send(JSON.stringify({ type: "error", message: "Room is full" }));
    return null;
  }

  // Handle Spectator Join
  if (msg.isSpectator) {
    const spectator = {
      ws,
      username: username + " (Spectator)",
      isSpectator: true,
      userId: userId || null
    };

    if (!room.spectators) room.spectators = [];
    room.spectators.push(spectator);

    console.log(`👁️ Spectator ${username} joined room ${actualRoomId}. Total spectators: ${room.spectators.length}`);

    ws.send(
      JSON.stringify({
        type: "roomJoined",
        roomId: requestedRoomId,
        isSpectator: true,
        actualRoomId: actualRoomId,
      })
    );

    // Send current game state to spectator
    ws.send(JSON.stringify({
      type: "seatedPlayers",
      players: room.players.map((p) => ({
        playerId: p.playerId,
        username: p.username,
        displayName: p.displayName || p.username,
        avatarUrl: p.avatarUrl || p.avatar_url || '',
        userId: p.userId,
        handCount: p.hand ? p.hand.length : 0
      })),
    }));

    if (roomReadyStatus.has(actualRoomId)) {
      ws.send(JSON.stringify({
        type: "playerReadyStatus",
        status: Object.fromEntries(roomReadyStatus.get(actualRoomId))
      }));
    }

    // Send all players' hands to spectator
    room.players.forEach(p => {
      if (p.hand && p.hand.length > 0) {
        ws.send(JSON.stringify({
          type: "hand",
          hand: p.hand,
          player: p.playerId,
          isSpectatorView: true
        }));
      }
    });

    if (room.lastPlay) {
      ws.send(JSON.stringify({
        type: "opponentMove",
        player: room.lastPlay.player, // We might need to store player in lastPlay
        cards: room.lastPlay.cards,
        isInitialState: true
      }));
    }

    const spectatorTurnPlayer = (room.gameType === 'texas' && room.texas?.playersOrder && room.texas.actingIndex != null)
      ? room.texas.playersOrder[room.texas.actingIndex]
      : room.currentPlayerIndex !== undefined && room.players[room.currentPlayerIndex] ? room.players[room.currentPlayerIndex].playerId : undefined;
    if (spectatorTurnPlayer !== undefined) {
      ws.send(JSON.stringify({ type: "turn", player: spectatorTurnPlayer }));
    }

    return { spectator, roomId: actualRoomId };
  }

  // Assign playerId based on join order (sequential, no gap filling)
  // This ensures players are seated in the order they joined
  const playerId = room.players.length + 1;

  const player = {
    ws,
    playerId,
    username,
    displayName: displayName || username,
    avatarUrl: avatarUrl || '',
    hand: [],
    userId: userId || null
  };
  room.players.push(player);
  const roomId = actualRoomId;

  console.log(`👤 Player ${playerId} (${username}) joined room ${roomId}. Total players: ${room.players.length}`);

  // If game has already started, create/update player state
  if (userId && room.gameId) {
    await createOrUpdatePlayerState(userId, room.gameId, true);
  }

  // Initialize user chat when player joins
  // For admin chat room, use userId if available, otherwise use playerId
  const chatUserId = (requestedRoomId === 'admin_chat_room' && userId) ? userId.toString() : playerId.toString();
  getUserChat(chatUserId, {
    userId: chatUserId,
    username: username,
    roomId: roomId
  });

  // Initialize player points
  if (!room.playerPoints) room.playerPoints = {};
  room.playerPoints[playerId] = 0;

  if (!roomReadyStatus.has(roomId)) {
    roomReadyStatus.set(roomId, new Map());
  }
  const readyStatus = roomReadyStatus.get(roomId);
  readyStatus.set(playerId, false);
  if (!room.gameStarted) {
    cancelAutoStart(roomId, rooms);
  }

      ws.send(
        JSON.stringify({
          type: "roomJoined",
          roomId: requestedRoomId, // Send original roomId to client for display
          playerId,
          actualRoomId: roomId, // Include actual roomId for debugging
          gameType: room.gameType || 'mongol_13',
        })
      );

  // Send current room state to the newly joined player immediately
  ws.send(JSON.stringify({
    type: "seatedPlayers",
    players: room.players.map((p) => ({
      playerId: p.playerId,
      username: p.username,
      displayName: p.displayName || p.username,
      avatarUrl: p.avatarUrl || p.avatar_url || '',
      userId: p.userId
    })),
  }));

  ws.send(JSON.stringify({
    type: "playerReadyStatus",
    status: Object.fromEntries(readyStatus)
  }));

  // Also broadcast to all players (including the new one) for consistency
  // Force broadcast to ensure all clients see the updated player list
  const seatedPlayersMessage = {
    type: "seatedPlayers",
    players: room.players.map((p) => ({
      playerId: p.playerId,
      username: p.username,
      displayName: p.displayName || p.username,
      avatarUrl: p.avatarUrl || p.avatar_url || '',
      userId: p.userId
    })),
  };

  const readyStatusMessage = {
    type: "playerReadyStatus",
    status: Object.fromEntries(readyStatus)
  };

  // Broadcast to all players in the room
  broadcastToRoom(roomId, seatedPlayersMessage, rooms);
  broadcastToRoom(roomId, readyStatusMessage, rooms);

  // Also send individual messages to ensure delivery (sometimes broadcast might miss)
  room.players.forEach((p) => {
    if (p.ws && p.ws.readyState === 1) { // WebSocket.OPEN
      try {
        p.ws.send(JSON.stringify(seatedPlayersMessage));
        p.ws.send(JSON.stringify(readyStatusMessage));
      } catch (e) {
        console.error(`❌ Error sending player list to player ${p.playerId}:`, e);
      }
    }
  });

  console.log(`📢 Broadcasted player list to ${room.players.length} players in room ${roomId}`);

  // broadcastPlayerCount is a bound function that includes wss, so call with just roomId
  broadcastPlayerCount(roomId);

  console.log(`🎮 Player ${playerId} joined room ${roomId} (${username}). Room now has ${room.players.length}/4 players.`);

  return { player, roomId: actualRoomId };
}

async function finishGameWhenAllPlayersLeft(roomId, room, gameId) {
  if (!gameId || !room.gameStarted) return;

  console.log(`🏁 Finishing game ${gameId} in room ${roomId} - all players disconnected`);

  try {
    // Mark that all players left (don't reduce balance)
    room.allPlayersLeft = true;

    // Update game status to finished
    const { updateGameStatusToFinished } = require('../utils/gameLogic');
    await updateGameStatusToFinished(roomId, gameId);

    // Clear player states for all players
    const { clearPlayerState } = require('./disconnectHandler');
    for (const player of room.players) {
      if (player.userId) {
        await clearPlayerState(player.userId, gameId);
      }
    }

    console.log(`✅ Game ${gameId} finished and player states cleared (all players left - no balance reduction)`);
  } catch (error) {
    console.error(`❌ Error finishing game ${gameId}:`, error);
  }
}

async function handlePlayerDisconnect(roomId, player, rooms, roomReadyStatus, broadcastToRoom, broadcastPlayerCount, clearTurnTimer, cancelAutoStart, startTurnTimer) {
  if (!roomId || !rooms[roomId] || !player) return;

  const room = rooms[roomId];
  const gameId = room.gameId || getRoomGameId(roomId);

  // If game has started and player has userId, handle disconnect timer
  if (gameId && player.userId && room.gameStarted) {
    await handleDisconnectTimer(
      player.userId,
      gameId,
      roomId,
      rooms,
      (userId, gameId, roomId, rooms) => autoFoldPlayer(userId, gameId, roomId, rooms)
    );
  }

  if (roomReadyStatus.has(roomId)) {
    const readyStatus = roomReadyStatus.get(roomId);
    readyStatus.delete(player.playerId);

    cancelAutoStart(roomId, rooms);

    broadcastToRoom(roomId, {
      type: "playerReadyStatus",
      status: Object.fromEntries(readyStatus)
    }, rooms);
  }

  if (room.currentPlayerIndex !== undefined &&
    room.players[room.currentPlayerIndex]?.playerId === player.playerId) {
    clearTurnTimer(roomId, rooms);
  }

  // Remove player from room if game hasn't started, or if game has finished
  // Only keep players in room if game is actively in progress (for reconnection)
  if (!room.gameStarted || room.gameFinished) {
    room.players = room.players.filter((p) => p.ws !== player.ws);
    console.log(`🗑️ Removed player ${player.playerId} from room ${roomId} (gameStarted: ${room.gameStarted}, gameFinished: ${room.gameFinished || false})`);
  } else {
    // Just mark websocket as null but keep player in room for reconnection during active game
    const playerIndex = room.players.findIndex(p => p.playerId === player.playerId);
    if (playerIndex !== -1) {
      room.players[playerIndex].ws = null;
    }
  }

  // Check if all players have disconnected from a started game
  const connectedPlayers = room.players.filter(p => p.ws && p.ws.readyState === 1);
  if (room.gameStarted && connectedPlayers.length === 0 && room.players.length > 0) {
    // All players disconnected - finish the game (don't reduce balance)
    await finishGameWhenAllPlayersLeft(roomId, room, gameId);

    // Broadcast player count before cleaning up (0 players)
    // broadcastPlayerCount is a bound function that includes wss, so call with just roomId
    broadcastPlayerCount(roomId);

    // Clean up room
    clearSinglePlayerWinnerTimer(roomId, rooms);
    delete rooms[roomId];
    roomReadyStatus.delete(roomId);
    cancelAutoStart(roomId, rooms);
    clearTurnTimer(roomId, rooms);
    console.log(`🧹 Cleaned up room ${roomId} after all players disconnected`);
    return;
  }

  if (room.players.length === 0 || (!room.gameStarted && connectedPlayers.length === 0)) {
    // Broadcast player count before deleting room (0 players)
    // broadcastPlayerCount is a bound function that includes wss, so call with just roomId
    broadcastPlayerCount(roomId);

    clearSinglePlayerWinnerTimer(roomId, rooms);
    delete rooms[roomId];
    roomReadyStatus.delete(roomId);
    cancelAutoStart(roomId, rooms);
    clearTurnTimer(roomId, rooms);
  } else {
    broadcastToRoom(roomId, {
      type: "playerLeft",
      player: player.playerId,
      username: player.username,
      disconnected: room.gameStarted, // true if game started, false if just left
    }, rooms);

    // broadcastPlayerCount is a bound function that includes wss, so call with just roomId
    broadcastPlayerCount(roomId);

    // Check for single player winner timer (only if game started)
    if (room.gameStarted && !room.gameFinished) {
      resetSinglePlayerWinnerTimer(roomId, rooms, (roomId, winnerPlayer) => {
        handleSinglePlayerWinner(roomId, winnerPlayer, rooms, broadcastToRoom);
      });
    }

    // Only continue game if there are connected players
    if (room.currentPlayerIndex !== undefined && connectedPlayers.length > 1 && room.gameStarted) {
      // Find next connected player
      let nextIndex = (room.currentPlayerIndex + 1) % room.players.length;
      let attempts = 0;
      while (attempts < room.players.length && (!room.players[nextIndex] || !room.players[nextIndex].ws || room.players[nextIndex].ws.readyState !== 1)) {
        nextIndex = (nextIndex + 1) % room.players.length;
        attempts++;
      }

      if (room.players[nextIndex] && room.players[nextIndex].ws && room.players[nextIndex].ws.readyState === 1) {
        room.currentPlayerIndex = nextIndex;
        startTurnTimer(roomId, rooms, broadcastToRoom, () => { });

        broadcastToRoom(roomId, {
          type: "turn",
          player: room.players[room.currentPlayerIndex].playerId,
        }, rooms);
      }
    }
  }

  console.log(`❌ Player ${player.playerId} disconnected from room ${roomId}`);
}

module.exports = {
  handleGameMessage,
  handleJoinRoom,
  handlePlayerDisconnect,
  broadcastToRoom,
  broadcastPlayerCount,
  startGame,
  autoPass,
  handleSinglePlayerWinner
};

