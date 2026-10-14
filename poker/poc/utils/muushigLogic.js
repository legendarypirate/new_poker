const { removeCardsFromHand } = require('./cardUtils');

const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const START_POINTS = 15;
const WIN_AT = 0;
const EMPTY_TRICK_PENALTY = 5;
const HAND_SIZE = 5;
const MAX_SIT_OUT_STREAK = 3;

function rankValue(rank) {
  const value = RANKS.indexOf(rank);
  return value < 0 ? -1 : value;
}

function normalizeSuit(suit) {
  const value = String(suit || '').trim().toLowerCase();
  if (value === '♥' || value === '♡' || value === 'h' || value === 'hearts' || value.includes('бунд')) {
    return '♥';
  }
  if (value === '♦' || value === '♢' || value === 'd' || value === 'diamonds' || value.includes('дөрвөлжин')) {
    return '♦';
  }
  if (
    value === '♣' ||
    value === '♧' ||
    value === 'c' ||
    value === 'clubs' ||
    value.includes('цэцэг') ||
    value.includes('хөндлөн')
  ) {
    return '♣';
  }
  if (value === '♠' || value === '♤' || value === 's' || value === 'spades' || value.includes('гил')) {
    return '♠';
  }
  return String(suit || '');
}

function normalizeCard(card) {
  if (!card) return card;
  return { rank: String(card.rank), suit: normalizeSuit(card.suit) };
}

function sameCard(a, b) {
  if (!a || !b) return false;
  return a.rank === b.rank && normalizeSuit(a.suit) === normalizeSuit(b.suit);
}

function createMuushigDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function ensureMuushigPoints(room) {
  room.playerPoints = room.playerPoints || {};
  for (const player of room.players) {
    if (room.playerPoints[player.playerId] == null) {
      room.playerPoints[player.playerId] = START_POINTS;
    }
  }
}

function resetMuushigPoints(room) {
  room.playerPoints = {};
  for (const player of room.players) {
    room.playerPoints[player.playerId] = START_POINTS;
  }
}

function emptyByPlayer(room, value = false) {
  return Object.fromEntries(room.players.map((p) => [p.playerId, value]));
}

function dealMuushigRound(room) {
  const deck = createMuushigDeck();
  for (const player of room.players) {
    player.hand = deck.splice(0, HAND_SIZE).map(normalizeCard);
  }
  const trump = normalizeCard(deck.shift());
  const previous = room.muushig;
  const dealerIndex = previous
    ? (previous.dealerIndex + 1) % room.players.length
    : 0;
  room.muushig = {
    trump,
    trumpSuit: trump.suit,
    trumpTaken: false,
    khozerNavshihed: false,
    stock: deck,
    phase: 'khozer',
    trick: [],
    tricksWon: Object.fromEntries(room.players.map((p) => [p.playerId, 0])),
    entered: {},
    satOut: {},
    exchanged: {},
    sitOutStreak: previous?.sitOutStreak ? { ...previous.sitOutStreak } : {},
    dealerIndex,
  };
  room.currentPlayerIndex = dealerIndex % room.players.length;
  room.lastPlay = null;
  room.passCount = 0;
  return room.muushig;
}

function canNavshihKhozer(room, playerId) {
  const state = room.muushig;
  if (!state || state.phase !== 'khozer') return false;
  if (state.khozerNavshihed || state.trumpTaken || !state.trump) return false;
  return room.players[state.dealerIndex]?.playerId === playerId;
}

function navshihKhozer(room, player, cards) {
  const state = room.muushig;
  if (!canNavshihKhozer(room, player.playerId)) {
    return { ok: false, error: 'Cannot navshih khozer' };
  }
  if (!Array.isArray(cards) || cards.length !== 1) {
    return { ok: false, error: 'Select one card to swap' };
  }
  if (!cardsOwned(player.hand, cards)) {
    return { ok: false, error: 'Cards not in hand' };
  }
  const discarded = normalizeCard(cards[0]);
  const taken = normalizeCard(state.trump);
  player.hand = removeCardsFromHand(player.hand, [discarded]);
  player.hand.push(taken);
  state.stock.push(discarded);
  state.khozerNavshihed = true;
  return { ok: true, taken, discarded, trumpSuit: state.trumpSuit };
}

function finishKhozerPhase(room) {
  const state = room.muushig;
  if (!state) return;
  state.phase = 'enter';
  room.currentPlayerIndex = (state.dealerIndex + 1) % room.players.length;
}

function cardsOwned(hand, cards) {
  const remaining = [...hand];
  for (const card of cards) {
    const index = remaining.findIndex((held) => sameCard(held, card));
    if (index < 0) return false;
    remaining.splice(index, 1);
  }
  return true;
}

function hasFourAces(hand) {
  return hand.filter((card) => card.rank === 'A').length === 4;
}

function findFourAcesWinner(room) {
  return room.players.find((player) => hasFourAces(player.hand)) || null;
}

function enteredPlayers(room) {
  return room.players.filter((player) => room.muushig?.entered[player.playerId]);
}

function hasDecided(state, playerId) {
  return !!(state.entered[playerId] || state.satOut[playerId]);
}

function canSitOut(room, playerId) {
  const state = room.muushig;
  if (!state || state.phase !== 'enter') return false;
  if (hasDecided(state, playerId)) return false;
  if (room.players.length <= 2) return false;
  if ((state.sitOutStreak[playerId] || 0) >= MAX_SIT_OUT_STREAK) return false;
  const sat = room.players.filter((p) => state.satOut[p.playerId]).length;
  const inPlay = room.players.filter((p) => state.entered[p.playerId]).length;
  const undecided = room.players.length - sat - inPlay;
  return inPlay + undecided > 2;
}

function decideEnter(room, player, enter) {
  const state = room.muushig;
  if (!state || state.phase !== 'enter') {
    return { ok: false, error: 'Not enter phase' };
  }
  if (hasDecided(state, player.playerId)) {
    return { ok: false, error: 'Already decided' };
  }
  const sittingOut = !enter && canSitOut(room, player.playerId);
  if (sittingOut) {
    state.satOut[player.playerId] = true;
    state.sitOutStreak[player.playerId] = (state.sitOutStreak[player.playerId] || 0) + 1;
    return { ok: true, entered: false };
  }
  state.entered[player.playerId] = true;
  state.sitOutStreak[player.playerId] = 0;
  return { ok: true, entered: true, forced: !enter };
}

function allDecided(room) {
  const state = room.muushig;
  return room.players.every((player) => hasDecided(state, player.playerId));
}

function nextEnteredIndex(room, fromIndex) {
  const n = room.players.length;
  for (let step = 1; step <= n; step++) {
    const index = (fromIndex + step) % n;
    if (room.muushig.entered[room.players[index].playerId]) return index;
  }
  return (fromIndex + 1) % n;
}

function startExchangePhase(room) {
  const state = room.muushig;
  state.phase = 'exchange';
  room.currentPlayerIndex = nextEnteredIndex(room, state.dealerIndex);
  room.lastPlay = null;
}

function exchangeCards(room, player, cards) {
  const state = room.muushig;
  if (!state || state.phase !== 'exchange') {
    return { ok: false, error: 'Not exchange phase' };
  }
  if (!state.entered[player.playerId]) {
    return { ok: false, error: 'Sat out this round' };
  }
  if (state.exchanged[player.playerId]) {
    return { ok: false, error: 'Already exchanged' };
  }
  if (!Array.isArray(cards)) {
    return { ok: false, error: 'Invalid cards' };
  }
  if (!cardsOwned(player.hand, cards)) {
    return { ok: false, error: 'Cards not in hand' };
  }
  const available = state.stock.length + (state.trumpTaken ? 0 : 1);
  if (cards.length > available) {
    return { ok: false, error: 'Not enough stock' };
  }

  const isDealer = room.players[state.dealerIndex]?.playerId === player.playerId;
  player.hand = removeCardsFromHand(player.hand, cards);

  const drawn = [];
  if (isDealer && cards.length > 0 && state.trump && !state.trumpTaken) {
    drawn.push(state.trump);
    state.trumpTaken = true;
  }
  while (drawn.length < cards.length && state.stock.length > 0) {
    drawn.push(normalizeCard(state.stock.shift()));
  }
  player.hand.push(...drawn);
  state.exchanged[player.playerId] = true;
  return { ok: true, drawn, tookTrump: isDealer && cards.length > 0 };
}

function skipExchange(room, player) {
  return exchangeCards(room, player, []);
}

function allExchanged(room) {
  return enteredPlayers(room).every((player) => room.muushig?.exchanged[player.playerId]);
}

function startPlayPhase(room) {
  const state = room.muushig;
  state.phase = 'play';
  state.trick = [];
  room.currentPlayerIndex = nextEnteredIndex(room, state.dealerIndex);
  room.lastPlay = null;
}

function trumpAce(trumpSuit) {
  return { rank: 'A', suit: trumpSuit };
}

function playCardOf(play) {
  return normalizeCard(play?.card || play);
}

function legalPlayCards(hand, trick, trumpSuit) {
  const trump = normalizeSuit(trumpSuit);
  const held = (hand || []).map(normalizeCard);
  if (!trick.length) {
    const ace = held.find((card) => card.rank === 'A' && card.suit === trump);
    return ace ? [ace] : held.slice();
  }
  const leadSuit = playCardOf(trick[0]).suit;
  const sameSuit = held.filter((card) => card.suit === leadSuit);
  if (sameSuit.length) {
    const highestLead = Math.max(
      ...trick
        .map(playCardOf)
        .filter((card) => card.suit === leadSuit)
        .map((card) => rankValue(card.rank))
    );
    const higher = sameSuit.filter((card) => rankValue(card.rank) > highestLead);
    return higher.length ? higher : sameSuit;
  }
  if (leadSuit !== trump) {
    const trumps = held.filter((card) => card.suit === trump);
    if (trumps.length) return trumps;
  }
  return held.slice();
}

function isLegalPlay(hand, card, trick, trumpSuit) {
  return legalPlayCards(hand, trick, trumpSuit).some((legal) => sameCard(legal, card));
}

function lowestLegalCard(hand, trick, trumpSuit) {
  const legal = legalPlayCards(hand, trick, trumpSuit);
  return [...legal].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0] || null;
}

function trickWinner(trick, trumpSuit) {
  const trump = normalizeSuit(trumpSuit);
  const plays = trick.map((play) => ({
    playerId: play.playerId ?? play.player,
    card: playCardOf(play),
  }));
  const trumps = plays.filter((play) => play.card.suit === trump);
  const leadSuit = plays[0].card.suit;
  const pool = trumps.length
    ? trumps
    : plays.filter((play) => play.card.suit === leadSuit);
  return pool.reduce((best, play) =>
    rankValue(play.card.rank) > rankValue(best.card.rank) ? play : best
  ).playerId;
}

function applyRoundScores(room) {
  const state = room.muushig;
  const deltas = {};
  for (const player of room.players) {
    if (state.satOut[player.playerId]) {
      deltas[player.playerId] = 0;
      continue;
    }
    const tricks = state.tricksWon[player.playerId] || 0;
    const delta = tricks === 0 ? EMPTY_TRICK_PENALTY : -tricks;
    deltas[player.playerId] = delta;
    room.playerPoints[player.playerId] =
      (room.playerPoints[player.playerId] ?? START_POINTS) + delta;
  }
  return deltas;
}

function finishedWinners(room) {
  return room.players
    .filter((player) => (room.playerPoints[player.playerId] ?? START_POINTS) <= WIN_AT)
    .map((player) => player.playerId);
}

function publicState(room) {
  const state = room.muushig;
  if (!state) return {};
  return {
    gameType: 'muushig',
    phase: state.phase,
    trump: state.trumpTaken ? null : state.trump,
    trumpSuit: state.trumpSuit,
    trumpTaken: !!state.trumpTaken,
    stockLeft: state.stock.length,
    tricksWon: state.tricksWon,
    trick: state.trick.map((play) => ({
      player: play.playerId,
      rank: play.card.rank,
      suit: play.card.suit,
    })),
    entered: state.entered,
    satOut: state.satOut,
    exchanged: state.exchanged,
    dealer: room.players[state.dealerIndex]?.playerId,
    canSitOut: room.players[room.currentPlayerIndex]
      ? canSitOut(room, room.players[room.currentPlayerIndex].playerId)
      : false,
    canNavshihKhozer: room.players[room.currentPlayerIndex]
      ? canNavshihKhozer(room, room.players[room.currentPlayerIndex].playerId)
      : false,
    turnSeconds: 20,
    startPoints: START_POINTS,
    loseAt: WIN_AT,
    points: room.playerPoints || {},
  };
}

module.exports = {
  RANKS,
  SUITS,
  START_POINTS,
  WIN_AT,
  HAND_SIZE,
  rankValue,
  createMuushigDeck,
  ensureMuushigPoints,
  resetMuushigPoints,
  dealMuushigRound,
  decideEnter,
  canSitOut,
  canNavshihKhozer,
  navshihKhozer,
  finishKhozerPhase,
  allDecided,
  startExchangePhase,
  exchangeCards,
  skipExchange,
  allExchanged,
  startPlayPhase,
  enteredPlayers,
  nextEnteredIndex,
  legalPlayCards,
  isLegalPlay,
  lowestLegalCard,
  trickWinner,
  applyRoundScores,
  finishedWinners,
  findFourAcesWinner,
  publicState,
  cardsOwned,
  sameCard,
  trumpAce,
  emptyByPlayer,
  normalizeSuit,
  normalizeCard,
};
