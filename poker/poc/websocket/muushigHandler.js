const { removeCardsFromHand } = require('../utils/cardUtils');
const { getPlayerCardCounts } = require('../utils/gameLogic');
const { clearTurnTimer } = require('./timerUtils');
const muushig = require('../utils/muushigLogic');

function sendHands(room, extra = {}) {
  const counts = getPlayerCardCounts(room);
  const state = muushig.publicState(room);
  for (const player of room.players) {
    if (player.ws && player.ws.readyState === 1) {
      player.ws.send(JSON.stringify({
        type: 'hand',
        hand: player.hand,
        player: player.playerId,
        cardCounts: counts,
        ...state,
        ...extra,
      }));
    }
  }
}

function broadcastTurn(roomId, rooms, broadcastToRoom) {
  const room = rooms[roomId];
  const current = room.players[room.currentPlayerIndex];
  broadcastToRoom(roomId, {
    type: 'turn',
    player: current ? current.playerId : null,
    cardCounts: getPlayerCardCounts(room),
    points: room.playerPoints || {},
    loseAt: muushig.WIN_AT,
    startPoints: muushig.START_POINTS,
    remainingTime: 20,
    totalTime: 20,
    ...muushig.publicState(room),
  }, rooms);
}

function startTurnClock(roomId, rooms, broadcastToRoom, startTurnTimerFn) {
  clearTurnTimer(roomId, rooms);
  if (typeof startTurnTimerFn === 'function') {
    startTurnTimerFn(roomId);
  }
  broadcastTurn(roomId, rooms, broadcastToRoom);
}

function finishByWinner(roomId, rooms, broadcastToRoom, winnerPlayer, extra = {}) {
  const room = rooms[roomId];
  room.gameFinished = true;
  room.gameStarted = true;
  clearTurnTimer(roomId, rooms);

  const { handleGameFinish, saveUserStatistics } = require('../utils/gameLogic');
  handleGameFinish(roomId, room, winnerPlayer.userId, winnerPlayer.playerId).catch((err) => {
    console.error('Error finishing muushig game:', err);
  });
  saveUserStatistics(room, winnerPlayer.playerId, rooms).catch((err) => {
    console.error('Error saving muushig stats:', err);
  });

  const { clearPlayerState } = require('./disconnectHandler');
  for (const player of room.players) {
    if (player.userId && room.gameId) {
      clearPlayerState(player.userId, room.gameId).catch(() => {});
    }
  }

  broadcastToRoom(roomId, {
    type: 'gameOver',
    winner: winnerPlayer.playerId,
    points: room.playerPoints || {},
    gameType: 'muushig',
    ...extra,
  }, rooms);
}

function maybeInstantWin(roomId, rooms, broadcastToRoom) {
  const room = rooms[roomId];
  const winner = muushig.findFourAcesWinner(room);
  if (!winner) return false;
  for (const player of room.players) {
    room.playerPoints[player.playerId] = player.playerId === winner.playerId ? 0 : 15;
  }
  finishByWinner(roomId, rooms, broadcastToRoom, winner, { fourAces: true });
  return true;
}

function beginRound(roomId, rooms, broadcastToRoom, startTurnTimerFn, { restarted = false } = {}) {
  const room = rooms[roomId];
  muushig.ensureMuushigPoints(room);
  muushig.dealMuushigRound(room);
  room.gameStarted = true;
  room.gameFinished = false;

  sendHands(room);
  broadcastToRoom(roomId, {
    type: restarted ? 'gameRestarted' : 'gameStart',
    firstPlayer: room.players[room.currentPlayerIndex]?.playerId,
    cardCounts: getPlayerCardCounts(room),
    points: room.playerPoints,
    loseAt: muushig.WIN_AT,
    startPoints: muushig.START_POINTS,
    ...muushig.publicState(room),
  }, rooms);

  if (maybeInstantWin(roomId, rooms, broadcastToRoom)) return;
  startTurnClock(roomId, rooms, broadcastToRoom, startTurnTimerFn);
}

function startMuushigGame(roomId, rooms, broadcastToRoom, startTurnTimerFn) {
  const room = rooms[roomId];
  muushig.resetMuushigPoints(room);
  beginRound(roomId, rooms, broadcastToRoom, startTurnTimerFn);
}

function completeEnterIfNeeded(roomId, rooms, broadcastToRoom, startTurnTimerFn) {
  const room = rooms[roomId];
  if (!muushig.allDecided(room)) return false;
  muushig.startExchangePhase(room);
  broadcastToRoom(roomId, {
    type: 'muushigState',
    ...muushig.publicState(room),
    points: room.playerPoints,
    cardCounts: getPlayerCardCounts(room),
  }, rooms);
  startTurnClock(roomId, rooms, broadcastToRoom, startTurnTimerFn);
  return true;
}

function completeExchangeIfNeeded(roomId, rooms, broadcastToRoom, startTurnTimerFn) {
  const room = rooms[roomId];
  if (!muushig.allExchanged(room)) return false;
  if (maybeInstantWin(roomId, rooms, broadcastToRoom)) return true;
  muushig.startPlayPhase(room);
  sendHands(room);
  broadcastToRoom(roomId, {
    type: 'muushigState',
    ...muushig.publicState(room),
    points: room.playerPoints,
    cardCounts: getPlayerCardCounts(room),
  }, rooms);
  startTurnClock(roomId, rooms, broadcastToRoom, startTurnTimerFn);
  return true;
}

function finishTrickThenContinue(roomId, rooms, broadcastToRoom, startTurnTimerFn) {
  const room = rooms[roomId];
  const state = room.muushig;
  const winnerId = muushig.trickWinner(state.trick, state.trumpSuit);
  state.tricksWon[winnerId] = (state.tricksWon[winnerId] || 0) + 1;
  const trickCards = state.trick.map((play) => play.card);
  broadcastToRoom(roomId, {
    type: 'trickOver',
    winner: winnerId,
    cards: trickCards,
    tricksWon: state.tricksWon,
    cardCounts: getPlayerCardCounts(room),
    ...muushig.publicState(room),
  }, rooms);

  const active = muushig.enteredPlayers(room);
  const handsEmpty = active.every((player) => player.hand.length === 0);
  if (handsEmpty) {
    const deltas = muushig.applyRoundScores(room);
    const winners = muushig.finishedWinners(room);
    broadcastToRoom(roomId, {
      type: 'playerWonRound',
      winner: winnerId,
      points: deltas,
      totalPoints: room.playerPoints,
      tricksWon: state.tricksWon,
    }, rooms);
    broadcastToRoom(roomId, {
      type: 'roundOver',
      winner: winnerId,
      points: deltas,
      totalPoints: room.playerPoints,
      loseAt: muushig.WIN_AT,
      gameEnded: winners.length > 0,
    }, rooms);

    if (winners.length > 0) {
      const winnerPlayer = room.players.find((p) => p.playerId === winners[0]);
      finishByWinner(roomId, rooms, broadcastToRoom, winnerPlayer);
      return;
    }

    setTimeout(() => {
      if (!rooms[roomId] || rooms[roomId].gameFinished) return;
      broadcastToRoom(roomId, { type: 'newRoundStart' }, rooms);
      beginRound(roomId, rooms, broadcastToRoom, startTurnTimerFn);
    }, 2200);
    return;
  }

  const winnerIndex = room.players.findIndex((player) => player.playerId === winnerId);
  room.currentPlayerIndex = winnerIndex >= 0 ? winnerIndex : muushig.nextEnteredIndex(room, state.dealerIndex);
  state.trick = [];
  room.lastPlay = null;
  setTimeout(() => {
    if (!rooms[roomId] || rooms[roomId].gameFinished) return;
    startTurnClock(roomId, rooms, broadcastToRoom, startTurnTimerFn);
  }, 800);
}

function playCard(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, card) {
  const room = rooms[roomId];
  const state = room.muushig;
  if (!state.entered[player.playerId]) {
    return { ok: false, error: 'Sat out this round' };
  }
  if (!muushig.cardsOwned(player.hand, [card])) {
    return { ok: false, error: 'Cards not in hand' };
  }
  if (!muushig.isLegalPlay(player.hand, card, state.trick, state.trumpSuit)) {
    return { ok: false, error: 'Must follow suit or play khozer' };
  }

  const played = muushig.normalizeCard(card);
  player.hand = removeCardsFromHand(player.hand, [played]);
  state.trick.push({ playerId: player.playerId, card: played });
  room.lastPlay = { cards: [played], player: player.playerId };

  broadcastToRoom(roomId, {
    type: 'opponentMove',
    player: player.playerId,
    cards: [played],
    cardCounts: getPlayerCardCounts(room),
    tricksWon: state.tricksWon,
    ...muushig.publicState(room),
  }, rooms);

  if (state.trick.length >= muushig.enteredPlayers(room).length) {
    finishTrickThenContinue(roomId, rooms, broadcastToRoom, startTurnTimerFn);
    return { ok: true, trickComplete: true };
  }

  room.currentPlayerIndex = muushig.nextEnteredIndex(room, room.currentPlayerIndex);
  startTurnClock(roomId, rooms, broadcastToRoom, startTurnTimerFn);
  return { ok: true };
}

function handleKhozerDecision(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, navshih) {
  const room = rooms[roomId];
  if (room.muushig?.phase !== 'khozer') {
    return { ok: false, error: 'Not khozer phase' };
  }
  if (navshih) {
    const result = muushig.navshihKhozer(room, player);
    if (!result.ok) return result;
  }
  muushig.finishKhozerPhase(room);
  sendHands(room);
  broadcastToRoom(roomId, {
    type: 'muushigKhozer',
    ...muushig.publicState(room),
    player: player.playerId,
    navshihed: !!navshih,
    trumpSuit: room.muushig.trumpSuit,
    cardCounts: getPlayerCardCounts(room),
  }, rooms);
  startTurnClock(roomId, rooms, broadcastToRoom, startTurnTimerFn);
  return { ok: true, navshihed: !!navshih };
}

function handleEnterDecision(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, enter) {
  const room = rooms[roomId];
  const result = muushig.decideEnter(room, player, enter);
  if (!result.ok) return result;

  broadcastToRoom(roomId, {
    type: 'muushigEnter',
    ...muushig.publicState(room),
    player: player.playerId,
    justEntered: result.entered,
    satOut: !result.entered,
    cardCounts: getPlayerCardCounts(room),
    points: room.playerPoints,
  }, rooms);

  if (!completeEnterIfNeeded(roomId, rooms, broadcastToRoom, startTurnTimerFn)) {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    startTurnClock(roomId, rooms, broadcastToRoom, startTurnTimerFn);
  }
  return result;
}

function handleMuushigMove(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, cards, action) {
  const room = rooms[roomId];
  const state = room.muushig;
  if (!state || room.gameFinished) {
    return { ok: false, error: 'Game not in progress' };
  }
  if (room.players[room.currentPlayerIndex]?.playerId !== player.playerId) {
    return { ok: false, error: 'Not your turn' };
  }
  clearTurnTimer(roomId, rooms);

  if (state.phase === 'khozer') {
    if (action === 'navshihKhozer') {
      return handleKhozerDecision(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, true);
    }
    if (action === 'keepKhozer' || action === 'enter') {
      return handleKhozerDecision(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, false);
    }
    return { ok: false, error: 'Keep or navshih khozer' };
  }

  if (state.phase === 'enter' || action === 'enter' || action === 'sitOut') {
    return handleEnterDecision(
      roomId,
      rooms,
      broadcastToRoom,
      startTurnTimerFn,
      player,
      action !== 'sitOut'
    );
  }

  if (state.phase === 'exchange') {
    const result = muushig.exchangeCards(room, player, cards || []);
    if (!result.ok) return result;
    if (player.ws && player.ws.readyState === 1) {
      player.ws.send(JSON.stringify({
        type: 'hand',
        hand: player.hand,
        player: player.playerId,
        drawn: result.drawn,
        cardCounts: getPlayerCardCounts(room),
        ...muushig.publicState(room),
      }));
    }
    broadcastToRoom(roomId, {
      type: 'muushigExchange',
      ...muushig.publicState(room),
      player: player.playerId,
      exchangedCount: (cards || []).length,
      tookTrump: !!result.tookTrump,
      cardCounts: getPlayerCardCounts(room),
    }, rooms);
    if (!completeExchangeIfNeeded(roomId, rooms, broadcastToRoom, startTurnTimerFn)) {
      room.currentPlayerIndex = muushig.nextEnteredIndex(room, room.currentPlayerIndex);
      startTurnClock(roomId, rooms, broadcastToRoom, startTurnTimerFn);
    }
    return { ok: true };
  }

  if (!cards || cards.length !== 1) {
    return { ok: false, error: 'Play exactly one card' };
  }
  return playCard(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, cards[0]);
}

function handleMuushigPass(roomId, rooms, broadcastToRoom, startTurnTimerFn, player) {
  const room = rooms[roomId];
  const state = room.muushig;
  if (!state) return { ok: false, error: 'Game not in progress' };
  if (state.phase === 'khozer') {
    return handleMuushigMove(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, [], 'navshihKhozer');
  }
  if (state.phase === 'enter') {
    return handleMuushigMove(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, [], 'sitOut');
  }
  if (state.phase === 'exchange') {
    return handleMuushigMove(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, []);
  }
  return { ok: false, error: 'Cannot pass during play' };
}

function handleMuushigRestart(roomId, rooms, broadcastToRoom, startTurnTimerFn) {
  const room = rooms[roomId];
  if (room.players.length < 2) {
    return { ok: false, error: 'Need at least 2 players to start' };
  }
  startMuushigGame(roomId, rooms, broadcastToRoom, startTurnTimerFn);
  return { ok: true };
}

function autoMuushigTimeout(roomId, rooms, broadcastToRoom, startTurnTimerFn) {
  const room = rooms[roomId];
  if (!room || !room.muushig || room.gameFinished) return;
  const player = room.players[room.currentPlayerIndex];
  if (!player) return;
  clearTurnTimer(roomId, rooms);

  if (room.muushig.phase === 'khozer') {
    handleKhozerDecision(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, false);
    return;
  }

  if (room.muushig.phase === 'enter') {
    const sit = muushig.canSitOut(room, player.playerId);
    handleEnterDecision(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, !sit);
    return;
  }

  if (room.muushig.phase === 'exchange') {
    handleMuushigPass(roomId, rooms, broadcastToRoom, startTurnTimerFn, player);
    return;
  }

  const card = muushig.lowestLegalCard(player.hand, room.muushig.trick, room.muushig.trumpSuit);
  if (!card) return;
  playCard(roomId, rooms, broadcastToRoom, startTurnTimerFn, player, card);
}

module.exports = {
  startMuushigGame,
  beginRound,
  handleMuushigMove,
  handleMuushigPass,
  handleMuushigRestart,
  autoMuushigTimeout,
  sendHands,
};
