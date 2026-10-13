/**
 * Texas Hold'em single-hand logic.
 * One hand: post blinds, preflop, flop, turn, river, showdown.
 * Min 2 players, max 9. Stacks in "chips" (start = 100 per player for the hand).
 */
const { createTexasDeck } = require('./texasCardUtils');
const { bestHand } = require('./texasHandEvaluator');

const PHASES = ['preflop', 'flop', 'turn', 'river', 'showdown'];
const SB = 1;
const BB = 2;
const STARTING_STACK = 100;

function initTexasHand(room) {
  const players = room.players.filter(p => p.ws && p.ws.readyState === 1);
  if (players.length < 2) return null;

  const deck = createTexasDeck();
  const dealerIndex = room.texas ? (room.texas.dealerIndex + 1) % players.length : 0;
  const sbIndex = (dealerIndex + 1) % players.length;
  const bbIndex = (dealerIndex + 2) % players.length;

  const stacks = {};
  const holeCards = {};
  players.forEach((p, i) => {
    stacks[p.playerId] = STARTING_STACK;
    holeCards[p.playerId] = [deck.pop(), deck.pop()];
  });

  let pot = 0;
  const bets = {};
  players.forEach(p => { bets[p.playerId] = 0; });
  const folded = new Set();
  const allIn = new Set();

  const sbPlayer = players[sbIndex];
  const bbPlayer = players[bbIndex];
  const sbAmount = Math.min(SB, stacks[sbPlayer.playerId]);
  const bbAmount = Math.min(BB, stacks[bbPlayer.playerId]);
  stacks[sbPlayer.playerId] -= sbAmount;
  stacks[bbPlayer.playerId] -= bbAmount;
  bets[sbPlayer.playerId] = sbAmount;
  bets[bbPlayer.playerId] = bbAmount;
  pot = sbAmount + bbAmount;
  if (stacks[sbPlayer.playerId] <= 0) allIn.add(sbPlayer.playerId);
  if (stacks[bbPlayer.playerId] <= 0) allIn.add(bbPlayer.playerId);

  const communityCards = [];
  const currentBet = BB;
  const minRaise = BB;
  const actingIndex = (bbIndex + 1) % players.length;
  const lastRaiserIndex = bbIndex;

  room.texas = {
    deck,
    communityCards,
    pot,
    currentBet,
    minRaise,
    dealerIndex,
    sbIndex,
    bbIndex,
    phase: 'preflop',
    phaseIndex: 0,
    actingIndex,
    lastRaiserIndex,
    stacks,
    bets,
    folded,
    allIn,
    holeCards,
    playersOrder: players.map(p => p.playerId),
    startOfRoundBetIndex: actingIndex,
  };
  return room.texas;
}

function canCheck(room, playerId) {
  const t = room.texas;
  const idx = t.playersOrder.indexOf(playerId);
  const bet = t.bets[playerId] || 0;
  return bet >= t.currentBet;
}

function canFold(room, playerId) {
  return !room.texas.folded.has(playerId) && !room.texas.allIn.has(playerId);
}

function canCall(room, playerId) {
  const t = room.texas;
  if (t.folded.has(playerId) || t.allIn.has(playerId)) return false;
  const bet = t.bets[playerId] || 0;
  const toCall = t.currentBet - bet;
  return toCall > 0 && t.stacks[playerId] >= toCall;
}

function canRaise(room, playerId, raiseAmount) {
  const t = room.texas;
  if (t.folded.has(playerId) || t.allIn.has(playerId)) return false;
  const bet = t.bets[playerId] || 0;
  const minRaiseTotal = t.currentBet + t.minRaise;
  const totalBet = bet + (raiseAmount || 0);
  if (totalBet < minRaiseTotal && totalBet < t.stacks[playerId]) return false;
  return t.stacks[playerId] >= Math.min(raiseAmount || t.stacks[playerId], t.stacks[playerId]);
}

function applyAction(room, playerId, action, amount = 0) {
  const t = room.texas;
  const player = room.players.find(p => p.playerId === playerId);
  if (!player || !t || t.folded.has(playerId)) return false;

  if (action === 'fold') {
    t.folded.add(playerId);
    return true;
  }

  if (action === 'check') {
    if (!canCheck(room, playerId)) return false;
    return true;
  }

  if (action === 'call') {
    if (!canCall(room, playerId)) return false;
    const toCall = t.currentBet - (t.bets[playerId] || 0);
    const put = Math.min(toCall, t.stacks[playerId]);
    t.stacks[playerId] -= put;
    t.bets[playerId] = (t.bets[playerId] || 0) + put;
    t.pot += put;
    if (t.stacks[playerId] <= 0) t.allIn.add(playerId);
    return true;
  }

  if (action === 'raise' || action === 'bet') {
    const currentBetForPlayer = t.bets[playerId] || 0;
    const totalToPut = amount;
    if (totalToPut <= currentBetForPlayer) return false;
    const add = Math.min(totalToPut - currentBetForPlayer, t.stacks[playerId]);
    if (add <= 0) return false;
    const newBet = currentBetForPlayer + add;
    if (t.phase === 'preflop' && newBet < t.currentBet + t.minRaise && t.stacks[playerId] > add) {
      const minTotal = t.currentBet + t.minRaise;
      if (newBet < minTotal) return false;
    }
    t.stacks[playerId] -= add;
    t.bets[playerId] = newBet;
    t.pot += add;
    t.currentBet = newBet;
    t.lastRaiserIndex = t.playersOrder.indexOf(playerId);
    if (t.stacks[playerId] <= 0) t.allIn.add(playerId);
    return true;
  }

  if (action === 'allin') {
    const add = t.stacks[playerId];
    if (add <= 0) return false;
    t.stacks[playerId] = 0;
    t.bets[playerId] = (t.bets[playerId] || 0) + add;
    t.pot += add;
    t.allIn.add(playerId);
    if (t.bets[playerId] > t.currentBet) {
      t.currentBet = t.bets[playerId];
      t.lastRaiserIndex = t.playersOrder.indexOf(playerId);
    }
    return true;
  }

  return false;
}

function nextActingPlayer(room) {
  const t = room.texas;
  const order = t.playersOrder;
  const n = order.length;
  let next = (t.actingIndex + 1) % n;
  for (let i = 0; i < n; i++) {
    if (next === t.startOfRoundBetIndex) return null;
    if (!t.folded.has(order[next])) return next;
    next = (next + 1) % n;
  }
  return null;
}

function bettingRoundComplete(room) {
  const t = room.texas;
  const active = t.playersOrder.filter(pid => !t.folded.has(pid));
  if (active.length <= 1) return true;
  let allMatchedOrAllIn = true;
  for (const pid of active) {
    if (t.allIn.has(pid)) continue;
    const bet = t.bets[pid] || 0;
    if (bet < t.currentBet) {
      allMatchedOrAllIn = false;
      break;
    }
  }
  if (!allMatchedOrAllIn) return false;
  const firstToAct = t.startOfRoundBetIndex;
  let idx = (firstToAct + 1) % t.playersOrder.length;
  while (idx !== firstToAct) {
    const pid = t.playersOrder[idx];
    if (!t.folded.has(pid) && !t.allIn.has(pid)) {
      const bet = t.bets[pid] || 0;
      if (bet < t.currentBet) return false;
    }
    idx = (idx + 1) % t.playersOrder.length;
  }
  return true;
}

function advancePhase(room, broadcastToRoom, roomId, rooms) {
  const t = room.texas;
  const active = t.playersOrder.filter(pid => !t.folded.has(pid));
  if (active.length === 1) {
    const winnerId = active[0];
    broadcastToRoom(roomId, { type: 'texasShowdown', winner: winnerId, reason: 'fold', pot: t.pot }, rooms);
    return { winner: winnerId, winnerUserId: room.players.find(p => p.playerId === winnerId).userId };
  }

  if (t.phase === 'preflop') {
    t.communityCards.push(t.deck.pop(), t.deck.pop(), t.deck.pop());
    t.phase = 'flop';
    t.currentBet = 0;
    t.bets = {};
    t.playersOrder.forEach(pid => { t.bets[pid] = 0; });
    t.startOfRoundBetIndex = (t.dealerIndex + 1) % t.playersOrder.length;
    t.actingIndex = t.startOfRoundBetIndex;
    while (t.folded.has(t.playersOrder[t.actingIndex])) {
      t.actingIndex = (t.actingIndex + 1) % t.playersOrder.length;
    }
    broadcastToRoom(roomId, { type: 'texasStreet', street: 'flop', communityCards: t.communityCards, pot: t.pot, actingPlayer: t.playersOrder[t.actingIndex] }, rooms);
    return null;
  }

  if (t.phase === 'flop') {
    t.communityCards.push(t.deck.pop());
    t.phase = 'turn';
    t.currentBet = 0;
    t.bets = {};
    t.playersOrder.forEach(pid => { t.bets[pid] = 0; });
    t.startOfRoundBetIndex = (t.dealerIndex + 1) % t.playersOrder.length;
    t.actingIndex = t.startOfRoundBetIndex;
    while (t.folded.has(t.playersOrder[t.actingIndex])) {
      t.actingIndex = (t.actingIndex + 1) % t.playersOrder.length;
    }
    broadcastToRoom(roomId, { type: 'texasStreet', street: 'turn', communityCards: t.communityCards, pot: t.pot, actingPlayer: t.playersOrder[t.actingIndex] }, rooms);
    return null;
  }

  if (t.phase === 'turn') {
    t.communityCards.push(t.deck.pop());
    t.phase = 'river';
    t.currentBet = 0;
    t.bets = {};
    t.playersOrder.forEach(pid => { t.bets[pid] = 0; });
    t.startOfRoundBetIndex = (t.dealerIndex + 1) % t.playersOrder.length;
    t.actingIndex = t.startOfRoundBetIndex;
    while (t.folded.has(t.playersOrder[t.actingIndex])) {
      t.actingIndex = (t.actingIndex + 1) % t.playersOrder.length;
    }
    broadcastToRoom(roomId, { type: 'texasStreet', street: 'river', communityCards: t.communityCards, pot: t.pot, actingPlayer: t.playersOrder[t.actingIndex] }, rooms);
    return null;
  }

  if (t.phase === 'river') {
    t.phase = 'showdown';
    const remaining = t.playersOrder.filter(pid => !t.folded.has(pid));
    const hands = remaining.map(pid => ({
      playerId: pid,
      hand: bestHand(t.holeCards[pid] || [], t.communityCards),
    }));
    let best = hands[0];
    for (let i = 1; i < hands.length; i++) {
      if (hands[i].hand && (!best.hand || hands[i].hand.value > best.hand.value)) best = hands[i];
    }
    const winners = hands.filter(h => h.hand && best.hand && h.hand.value === best.hand.value).map(h => h.playerId);
    const winnerId = winners[0];
    const winnerPlayer = room.players.find(p => p.playerId === winnerId);
    const winnerUserId = winnerPlayer ? winnerPlayer.userId : null;
    const showdownData = {
      type: 'texasShowdown',
      winner: winnerId,
      reason: 'showdown',
      pot: t.pot,
      communityCards: t.communityCards,
      hands: hands.map(h => ({ playerId: h.playerId, rank: h.hand ? h.hand.rank : null, value: h.hand ? h.hand.value : 0 })),
    };
    broadcastToRoom(roomId, showdownData, rooms);
    return { winner: winnerId, winnerUserId };
  }

  return null;
}

function processTexasAction(roomId, rooms, playerId, action, amount, broadcastToRoom) {
  const room = rooms[roomId];
  if (!room || !room.texas) return { ok: false, error: 'No Texas hand in progress' };
  const t = room.texas;
  const pid = Number(playerId);
  const actingPlayerId = t.playersOrder[t.actingIndex];
  // Normalize so "2" === 2 (connection can have string or number)
  if (Number(actingPlayerId) !== pid) {
    console.log(`[Texas] Not your turn: roomId=${roomId} action=${action} playerId=${playerId} pid=${pid} actingPlayerId=${actingPlayerId} actingIndex=${t.actingIndex} playersOrder=${JSON.stringify(t.playersOrder)}`);
    return { ok: false, error: 'Not your turn' };
  }

  const applied = applyAction(room, pid, action, amount);
  if (!applied) return { ok: false, error: 'Invalid action' };

  broadcastToRoom(roomId, {
    type: 'texasAction',
    playerId: pid,
    action,
    amount: amount || 0,
    pot: t.pot,
    currentBet: t.currentBet,
    bets: { ...t.bets },
    stacks: { ...t.stacks },
    folded: [...t.folded],
  }, rooms);

  const activeCount = t.playersOrder.filter(pid => !t.folded.has(pid)).length;
  if (activeCount === 1) {
    const winnerId = t.playersOrder.find(pid => !t.folded.has(pid));
    broadcastToRoom(roomId, { type: 'texasShowdown', winner: winnerId, reason: 'fold', pot: t.pot }, rooms);
    return { ok: true, gameOver: true, winner: winnerId, winnerUserId: room.players.find(p => p.playerId === winnerId).userId };
  }

  const nextIdx = nextActingPlayer(room);
  if (nextIdx !== null) {
    t.actingIndex = nextIdx;
    broadcastToRoom(roomId, { type: 'texasTurn', actingPlayer: t.playersOrder[nextIdx], pot: t.pot, currentBet: t.currentBet }, rooms);
    return { ok: true };
  }

  const roundComplete = bettingRoundComplete(room);
  if (!roundComplete) {
    t.actingIndex = (t.lastRaiserIndex + 1) % t.playersOrder.length;
    while (t.folded.has(t.playersOrder[t.actingIndex])) {
      t.actingIndex = (t.actingIndex + 1) % t.playersOrder.length;
    }
    broadcastToRoom(roomId, { type: 'texasTurn', actingPlayer: t.playersOrder[t.actingIndex], pot: t.pot, currentBet: t.currentBet }, rooms);
    return { ok: true };
  }

  const result = advancePhase(room, broadcastToRoom, roomId, rooms);
  if (result && result.winner) {
    return { ok: true, gameOver: true, winner: result.winner, winnerUserId: result.winnerUserId };
  }
  if (result === null) {
    broadcastToRoom(roomId, { type: 'texasTurn', actingPlayer: t.playersOrder[t.actingIndex], pot: t.pot, currentBet: t.currentBet }, rooms);
  }
  return { ok: true };
}

module.exports = {
  initTexasHand,
  applyAction,
  canCheck,
  canFold,
  canCall,
  canRaise,
  bettingRoundComplete,
  advancePhase,
  processTexasAction,
  PHASES,
  SB,
  BB,
  STARTING_STACK,
};
