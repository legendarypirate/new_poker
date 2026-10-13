function startTurnTimer(roomId, rooms, broadcastToRoom, autoPassFn) {
  if (!rooms || !rooms[roomId]) {
    console.log(`⚠️ Rooms object or room ${roomId} not found in startTurnTimer`);
    return;
  }
  
  const room = rooms[roomId];
  if (!room || room.players.length === 0) return;

  const currentPlayer = room.players[room.currentPlayerIndex];
  if (!currentPlayer) {
    console.log(`⚠️ Current player not found in room ${roomId}`);
    return;
  }
  
  // Check if player is disconnected (no websocket or websocket not open)
  // If disconnected, immediately auto-pass instead of starting timer
  const isDisconnected = !currentPlayer.ws || currentPlayer.ws.readyState !== 1;
  if (isDisconnected) {
    console.log(`🤖 Player ${currentPlayer.playerId} is disconnected, auto-passing immediately`);
    if (autoPassFn) {
      autoPassFn(roomId);
    }
    return;
  }
  
  broadcastToRoom(roomId, {
    type: "timerUpdate",
    player: currentPlayer.playerId,
    remainingTime: 15,
    totalTime: 15
  }, rooms);

  let timeLeft = 15;
  
  const timerInterval = setInterval(() => {
    // Check if room still exists before each update
    if (!rooms || !rooms[roomId] || !rooms[roomId].players || rooms[roomId].players.length === 0) {
      clearInterval(timerInterval);
      return;
    }
    
    timeLeft--;
    
    broadcastToRoom(roomId, {
      type: "timerUpdate",
      player: currentPlayer.playerId,
      remainingTime: timeLeft,
      totalTime: 15
    }, rooms);

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (rooms[roomId]) {
        rooms[roomId].turnTimer = null;
      }
      if (autoPassFn) {
        autoPassFn(roomId);
      }
    }
  }, 1000);

  room.turnTimer = timerInterval;
}

function clearTurnTimer(roomId, rooms) {
  const room = rooms[roomId];
  if (room && room.turnTimer) {
    clearInterval(room.turnTimer);
    room.turnTimer = null;
  }
}

function startAutoStartCountdown(roomId, rooms, broadcastToRoom, startGame) {
  const room = rooms[roomId];
  if (!room) return;
  
  if (room.autoStartTimer) {
    clearTimeout(room.autoStartTimer);
  }

  // Start countdown from 3, then 2, then 1, then start game
  let countdown = 3;
  
  // Broadcast initial countdown
  broadcastToRoom(roomId, {
    type: "autoStartCountdown",
    remainingTime: countdown,
    countdownNumber: countdown
  });
  
  const countdownInterval = setInterval(() => {
    countdown--;
    
    if (countdown > 0) {
      // Broadcast countdown number (3, 2, 1)
      broadcastToRoom(roomId, {
        type: "autoStartCountdown",
        remainingTime: countdown,
        countdownNumber: countdown
      });
    } else {
      // Countdown finished, start the game
      clearInterval(countdownInterval);
      room.autoStartTimer = null;
      startGame(roomId);
    }
  }, 1000);

  room.autoStartTimer = countdownInterval;
}

function cancelAutoStart(roomId, rooms) {
  const room = rooms[roomId];
  if (room && room.autoStartTimer) {
    clearTimeout(room.autoStartTimer);
    room.autoStartTimer = null;
  }
}

/**
 * Start timer to check if only one player remains (60 seconds = winner)
 */
function startSinglePlayerWinnerTimer(roomId, rooms, onSinglePlayerWinner) {
  const room = rooms[roomId];
  if (!room) return;
  
  // Clear any existing timer
  if (room.singlePlayerTimer) {
    clearTimeout(room.singlePlayerTimer);
  }

  // Start 60 second timer
  room.singlePlayerTimer = setTimeout(() => {
    if (!rooms[roomId]) return;
    
    const connectedPlayers = room.players.filter(p => p.ws && p.ws.readyState === 1);
    
    if (connectedPlayers.length === 1 && room.gameStarted && !room.gameFinished) {
      console.log(`🏆 Only one player left in room ${roomId} for 60 seconds - declaring winner`);
      onSinglePlayerWinner(roomId, connectedPlayers[0]);
    }
    
    room.singlePlayerTimer = null;
  }, 60000); // 60 seconds
}

/**
 * Clear single player winner timer
 */
function clearSinglePlayerWinnerTimer(roomId, rooms) {
  const room = rooms[roomId];
  if (room && room.singlePlayerTimer) {
    clearTimeout(room.singlePlayerTimer);
    room.singlePlayerTimer = null;
  }
}

/**
 * Reset single player winner timer (call when player count changes)
 */
function resetSinglePlayerWinnerTimer(roomId, rooms, onSinglePlayerWinner) {
  const room = rooms[roomId];
  if (!room || !room.gameStarted || room.gameFinished) {
    clearSinglePlayerWinnerTimer(roomId, rooms);
    return;
  }
  
  const connectedPlayers = room.players.filter(p => p.ws && p.ws.readyState === 1);
  
  if (connectedPlayers.length === 1) {
    // Only one player connected, start timer
    startSinglePlayerWinnerTimer(roomId, rooms, onSinglePlayerWinner);
  } else {
    // More than one player, clear timer
    clearSinglePlayerWinnerTimer(roomId, rooms);
  }
}

module.exports = {
  startTurnTimer,
  clearTurnTimer,
  startAutoStartCountdown,
  cancelAutoStart,
  startSinglePlayerWinnerTimer,
  clearSinglePlayerWinnerTimer,
  resetSinglePlayerWinnerTimer
};

