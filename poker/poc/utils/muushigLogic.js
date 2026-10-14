const { removeCardsFromHand } = require('./cardUtils');

const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const START_POINTS = 15;
const WIN_AT = 0;
const EMPTY_TRICK_PENALTY = 5;
const HAND_SIZE = 5;

function rankValue(rank) {
  const value = RANKS.indexOf(rank);
  return value < 0 ? -1 : value;
}

function sameCard(a, b) {
  return a && b && a.rank === b.rank && a.suit === b.suit;
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

function dealMuushigRound(room) {
  const deck = createMuushigDeck();
  for (const player of room.players) {
    player.hand = deck.splice(0, HAND_SIZE);
  }
  const trump = deck.shift();
  const previous = room.muushig;
  const dealerIndex = previous
    ? (previous.dealerIndex + 1) % room.players.length
    : 0;
  room.muushig = {
    trump,
    trumpSuit: trump.suit,
    trumpTaken: false,
    stock: deck,
    phase: 'exchange',
    trick: [],
    tricksWon: Object.fromEntries(room.players.map((p) => [p.playerId, 0])),
    exchanged: {},
    dealerIndex,
  };
  room.currentPlayerIndex = (dealerIndex + 1) % room.players.length;
  room.lastPlay = null;
  room.passCount = 0;
  return room.muushig;
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

function exchangeCards(room, player, cards) {
  const state = room.muushig;
  if (!state || state.phase !== 'exchange') {
    return { ok: false, error: 'Not exchange phase' };
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
  if (cards.length > state.stock.length + (state.trumpTaken ? 0 : 1)) {
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
    drawn.push(state.stock.shift());
  }
  player.hand.push(...drawn);
  state.exchanged[player.playerId] = true;
  return { ok: true, drawn };
}

function skipExchange(room, player) {
  return exchangeCards(room, player, []);
}

function allExchanged(room) {
  return room.players.every((player) => room.muushig?.exchanged[player.playerId]);
}

function startPlayPhase(room) {
  const state = room.muushig;
  state.phase = 'play';
  state.trick = [];
  room.currentPlayerIndex = (state.dealerIndex + 1) % room.players.length;
  room.lastPlay = null;
}

function legalPlayCards(hand, trick, trumpSuit) {
  if (!trick.length) return hand.slice();
  const leadSuit = trick[0].card.suit;
  const sameSuit = hand.filter((card) => card.suit === leadSuit);
  if (sameSuit.length) {
    const highestLead = Math.max(
      ...trick
        .filter((play) => play.card.suit === leadSuit)
        .map((play) => rankValue(play.card.rank))
    );
    const higher = sameSuit.filter((card) => rankValue(card.rank) > highestLead);
    return higher.length ? higher : sameSuit;
  }
  const trumps = hand.filter((card) => card.suit === trumpSuit);
  return trumps.length ? trumps : hand.slice();
}

function isLegalPlay(hand, card, trick, trumpSuit) {
  return legalPlayCards(hand, trick, trumpSuit).some((legal) => sameCard(legal, card));
}

function lowestLegalCard(hand, trick, trumpSuit) {
  const legal = legalPlayCards(hand, trick, trumpSuit);
  return [...legal].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0] || null;
}

function trickWinner(trick, trumpSuit) {
  const trumps = trick.filter((play) => play.card.suit === trumpSuit);
  const pool = trumps.length
    ? trumps
    : trick.filter((play) => play.card.suit === trick[0].card.suit);
  return pool.reduce((best, play) =>
    rankValue(play.card.rank) > rankValue(best.card.rank) ? play : best
  ).playerId;
}

function applyRoundScores(room) {
  const state = room.muushig;
  const deltas = {};
  for (const player of room.players) {
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
    trump: state.trump,
    trumpSuit: state.trumpSuit,
    stockLeft: state.stock.length + (state.trumpTaken ? 0 : 0),
    tricksWon: state.tricksWon,
    trick: state.trick.map((play) => ({
      player: play.playerId,
      rank: play.card.rank,
      suit: play.card.suit,
    })),
    dealer: room.players[state.dealerIndex]?.playerId,
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
  exchangeCards,
  skipExchange,
  allExchanged,
  startPlayPhase,
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
};
