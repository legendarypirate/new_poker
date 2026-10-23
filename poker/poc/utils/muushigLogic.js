const { removeCardsFromHand } = require('./cardUtils');

const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const START_POINTS = 15;
const WIN_AT = 0;
const EMPTY_TRICK_PENALTY = 5;
const HAND_SIZE = 5;
const MAX_SIT_OUT_STREAK = 3;
const BOOLT_PRIMARY_ROUNDS = 5;
const MAX_MATCH_ROUNDS = 10;
const DEFAULT_GER_PRICE = 500;

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

function samePlayerId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function valueById(map, playerId, fallback = 0) {
  if (!map || playerId == null) return fallback;
  if (map[playerId] != null) return map[playerId];
  if (map[String(playerId)] != null) return map[String(playerId)];
  const asNum = Number(playerId);
  if (!Number.isNaN(asNum) && map[asNum] != null) return map[asNum];
  return fallback;
}

function setById(map, playerId, value) {
  if (!map || playerId == null) return;
  map[playerId] = value;
  const alt = String(playerId);
  if (alt !== playerId && map[alt] != null) map[alt] = value;
}

function findPlayer(room, playerId) {
  return room.players.find((player) => samePlayerId(player.playerId, playerId)) || null;
}

function snapshotRoundStartPoints(room) {
  ensureMuushigPoints(room);
  return Object.fromEntries(
    room.players.map((player) => [player.playerId, room.playerPoints[player.playerId]])
  );
}

function roundStartPointsOf(room, playerId) {
  const snap = room.muushig?.roundStartPoints;
  const fromSnap = valueById(snap, playerId, null);
  if (fromSnap != null) return Number(fromSnap);
  return Number(valueById(room.playerPoints, playerId, START_POINTS));
}

function tricksOf(room, playerId) {
  return Number(valueById(room.muushig?.tricksWon, playerId, 0));
}

function resetMuushigPoints(room) {
  room.playerPoints = {};
  for (const player of room.players) {
    room.playerPoints[player.playerId] = START_POINTS;
  }
  if (room.muushig) room.muushig.sitOutStreak = {};
}

function clampGerPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_GER_PRICE;
  return Math.min(100000, Math.round(n));
}

function clampMatchRounds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return BOOLT_PRIMARY_ROUNDS;
  return Math.max(1, Math.min(MAX_MATCH_ROUNDS, Math.round(n)));
}

function applyTableSettings(room, raw = {}) {
  const booltEnabled = raw.boolt === true || raw.booltEnabled === true;
  const gerPrice = clampGerPrice(raw.gerPrice ?? raw.ger_price ?? room.muushigMatch?.gerPrice);
  const primaryRounds = booltEnabled
    ? BOOLT_PRIMARY_ROUNDS
    : clampMatchRounds(raw.rounds ?? raw.maxRounds ?? room.muushigMatch?.primaryRounds);
  const previous = room.muushigMatch;
  room.muushigMatch = {
    booltEnabled,
    gerPrice,
    primaryRounds,
    phase: previous?.phase || 'primary',
    primaryPlayed: previous?.primaryPlayed || 0,
    booltTotal: previous?.booltTotal || 0,
    booltPlayed: previous?.booltPlayed || 0,
    roundWins: previous?.roundWins ? { ...previous.roundWins } : {},
    gers: previous?.gers ? { ...previous.gers } : {},
    gerValue: previous?.gerValue ? { ...previous.gerValue } : {},
    chips: previous?.gerValue ? { ...previous.gerValue } : {},
  };
  return ensureMatch(room);
}

function resetMatchProgress(room) {
  const match = ensureMatch(room);
  match.phase = 'primary';
  match.primaryPlayed = 0;
  match.booltTotal = 0;
  match.booltPlayed = 0;
  match.roundWins = {};
  match.gers = {};
  match.gerValue = {};
  match.chips = {};
  return ensureMatch(room);
}

function ensureMatch(room) {
  if (!room.muushigMatch) {
    room.muushigMatch = {
      booltEnabled: false,
      gerPrice: DEFAULT_GER_PRICE,
      primaryRounds: BOOLT_PRIMARY_ROUNDS,
      phase: 'primary',
      primaryPlayed: 0,
      booltTotal: 0,
      booltPlayed: 0,
      roundWins: {},
      gers: {},
      gerValue: {},
      chips: {},
    };
  }
  for (const player of room.players || []) {
    if (room.muushigMatch.roundWins[player.playerId] == null) {
      room.muushigMatch.roundWins[player.playerId] = 0;
    }
    if (room.muushigMatch.gers[player.playerId] == null) {
      room.muushigMatch.gers[player.playerId] = 0;
    }
    if (room.muushigMatch.gerValue[player.playerId] == null) {
      room.muushigMatch.gerValue[player.playerId] = 0;
    }
    room.muushigMatch.chips[player.playerId] = room.muushigMatch.gerValue[player.playerId];
  }
  return room.muushigMatch;
}

function currentGerPrice(room) {
  const match = ensureMatch(room);
  return match.phase === 'boolt' ? match.gerPrice * 2 : match.gerPrice;
}

function creditGer(room, winnerId) {
  const match = ensureMatch(room);
  const price = currentGerPrice(room);
  const gers = (match.gers[winnerId] || match.gers[String(winnerId)] || 0) + 1;
  const value = (match.gerValue[winnerId] || match.gerValue[String(winnerId)] || 0) + price;
  match.gers[winnerId] = gers;
  match.gerValue[winnerId] = value;
  match.chips[winnerId] = value;
  return { price, gers, value };
}

function winlessCount(room) {
  const match = ensureMatch(room);
  return room.players.filter((player) => (match.roundWins[player.playerId] || 0) === 0).length;
}

function afterMatchRound(room, winnerId) {
  const match = ensureMatch(room);
  match.roundWins[winnerId] = (match.roundWins[winnerId] || 0) + 1;
  if (match.phase === 'boolt') match.booltPlayed += 1;
  else match.primaryPlayed += 1;

  if (match.phase === 'primary') {
    if (match.primaryPlayed < match.primaryRounds) {
      return { done: false, next: 'primary' };
    }
    if (match.booltEnabled) {
      match.booltTotal = winlessCount(room);
      if (match.booltTotal > 0) {
        match.phase = 'boolt';
        return { done: false, next: 'boolt', booltRounds: match.booltTotal };
      }
    }
    return { done: true };
  }
  if (match.booltPlayed < match.booltTotal) {
    return { done: false, next: 'boolt' };
  }
  return { done: true };
}

function matchChampion(room) {
  const match = ensureMatch(room);
  let best = null;
  let bestWins = -1;
  let bestChips = -Infinity;
  for (const player of room.players) {
    const wins = match.roundWins[player.playerId] || 0;
    const chips = match.chips[player.playerId] || 0;
    if (wins > bestWins || (wins === bestWins && chips > bestChips)) {
      bestWins = wins;
      bestChips = chips;
      best = player;
    }
  }
  return best;
}

function matchStatus(room) {
  const match = ensureMatch(room);
  const inBoolt = match.phase === 'boolt';
  return {
    booltEnabled: !!match.booltEnabled,
    booltPhase: inBoolt,
    phase: match.phase,
    gerPrice: match.gerPrice,
    currentGerPrice: currentGerPrice(room),
    primaryRounds: match.primaryRounds,
    primaryPlayed: match.primaryPlayed,
    booltTotal: match.booltTotal,
    booltPlayed: match.booltPlayed,
    roundWins: { ...match.roundWins },
    gers: { ...match.gers },
    gerValue: { ...match.gerValue },
    chips: { ...match.gerValue },
    roundIndex: inBoolt ? match.booltPlayed + 1 : match.primaryPlayed + 1,
    roundTotal: inBoolt ? Math.max(1, match.booltTotal) : match.primaryRounds,
  };
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
    phase: 'enter',
    trick: [],
    tricksWon: Object.fromEntries(room.players.map((p) => [p.playerId, 0])),
    trickWinners: [],
    roundStartPoints: snapshotRoundStartPoints(room),
    entered: {},
    satOut: {},
    exchanged: {},
    sitOutStreak: previous?.sitOutStreak ? { ...previous.sitOutStreak } : {},
    passedThisTrick: {},
    dealerIndex,
  };
  room.currentPlayerIndex = (dealerIndex + 1) % room.players.length;
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
  state.khozerNavshihed = true;
  return { ok: true, taken, discarded, trumpSuit: state.trumpSuit };
}

function startKhozerPhase(room) {
  const state = room.muushig;
  const dealer = room.players[state.dealerIndex];
  if (!state || !dealer || !state.entered[dealer.playerId] || state.trumpTaken || !state.trump) {
    startPlayPhase(room);
    return false;
  }
  state.phase = 'khozer';
  room.currentPlayerIndex = state.dealerIndex;
  return true;
}

function finishKhozerPhase(room) {
  startPlayPhase(room);
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

function sitOutCount(state, playerId) {
  if (!state?.sitOutStreak) return 0;
  const streak = state.sitOutStreak;
  return Number(streak[playerId] ?? streak[String(playerId)] ?? 0);
}

function sitOutBlockReason(room, playerId) {
  const state = room.muushig;
  if (!state || state.phase !== 'enter') return 'notEnter';
  if (hasDecided(state, playerId)) return 'decided';
  if (room.players.length <= 2) return 'headsUp';
  if (sitOutCount(state, playerId) >= MAX_SIT_OUT_STREAK) return 'streak';
  const sat = room.players.filter((p) => state.satOut[p.playerId]).length;
  const inPlay = room.players.filter((p) => state.entered[p.playerId]).length;
  const undecided = room.players.length - sat - inPlay;
  if (inPlay + undecided <= 2) return 'lastTwo';
  return null;
}

function canSitOut(room, playerId) {
  return sitOutBlockReason(room, playerId) == null;
}

function decideEnter(room, player, enter) {
  const state = room.muushig;
  if (!state || state.phase !== 'enter') {
    return { ok: false, error: 'Not enter phase' };
  }
  if (hasDecided(state, player.playerId)) {
    return { ok: false, error: 'Already decided' };
  }
  const blockReason = sitOutBlockReason(room, player.playerId);
  const sittingOut = !enter && blockReason == null;
  if (sittingOut) {
    state.satOut[player.playerId] = true;
    state.sitOutStreak[player.playerId] = sitOutCount(state, player.playerId) + 1;
    return { ok: true, entered: false };
  }
  state.entered[player.playerId] = true;
  state.sitOutStreak[player.playerId] = 0;
  return { ok: true, entered: true, forced: !enter, reason: !enter ? blockReason : undefined };
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
  if (cards.length > state.stock.length) {
    return { ok: false, error: 'Not enough stock' };
  }

  player.hand = removeCardsFromHand(player.hand, cards);
  const discarded = cards.map(normalizeCard);
  const drawn = [];
  while (drawn.length < discarded.length && state.stock.length > 0) {
    drawn.push(normalizeCard(state.stock.shift()));
  }
  player.hand.push(...drawn);
  state.exchanged[player.playerId] = true;
  return { ok: true, drawn, tookTrump: false };
}

function skipExchange(room, player) {
  return exchangeCards(room, player, []);
}

function allExchanged(room) {
  return enteredPlayers(room).every((player) => room.muushig?.exchanged[player.playerId]);
}

/** When the stock (gazar) is empty, no one can swap — finish exchange for everyone. */
function finalizeExchangeIfStockDepleted(room) {
  const state = room.muushig;
  if (!state || state.phase !== "exchange") return false;
  if (state.stock.length > 0) return false;
  for (const player of enteredPlayers(room)) {
    state.exchanged[player.playerId] = true;
  }
  return true;
}

function startPlayPhase(room) {
  const state = room.muushig;
  state.phase = 'play';
  state.trick = [];
  state.passedThisTrick = {};
  room.currentPlayerIndex = nextEnteredIndex(room, state.dealerIndex);
  room.lastPlay = null;
}

function hasPlayedThisTrick(state, playerId) {
  return (state.trick || []).some((play) => (play.playerId ?? play.player) === playerId);
}

function hasResolvedThisTrick(state, playerId) {
  return hasPlayedThisTrick(state, playerId) || !!(state.passedThisTrick && state.passedThisTrick[playerId]);
}

function nextUnresolvedIndex(room, fromIndex) {
  const state = room.muushig;
  const n = room.players.length;
  for (let step = 1; step <= n; step++) {
    const index = (fromIndex + step) % n;
    const player = room.players[index];
    if (state.entered[player.playerId] && !hasResolvedThisTrick(state, player.playerId)) {
      return index;
    }
  }
  return -1;
}

function trickIsResolved(room) {
  const active = enteredPlayers(room);
  return active.length > 0 && active.every((player) => hasResolvedThisTrick(room.muushig, player.playerId));
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
    if (valueById(state.satOut, player.playerId, false)) {
      deltas[player.playerId] = 0;
      continue;
    }
    const tricks = tricksOf(room, player.playerId);
    const delta = tricks === 0 ? EMPTY_TRICK_PENALTY : -tricks;
    deltas[player.playerId] = delta;
    room.playerPoints[player.playerId] =
      (room.playerPoints[player.playerId] ?? START_POINTS) + delta;
  }
  return deltas;
}

function awardTrick(room, winnerId) {
  const state = room.muushig;
  if (!state || winnerId == null) return false;
  state.tricksWon = state.tricksWon || {};
  setById(state.tricksWon, winnerId, tricksOf(room, winnerId) + 1);
  state.trickWinners = state.trickWinners || [];
  state.trickWinners.push(winnerId);
  creditGer(room, winnerId);
  return playerCompletedWin(room, winnerId);
}

function playerCompletedWin(room, playerId) {
  const need = roundStartPointsOf(room, playerId);
  if (!(need > WIN_AT)) return false;
  return tricksOf(room, playerId) >= need;
}

// First player, in trick order, to collect as many gers as they still needed
// at the start of the round. Works for any table size and any scores
// (e.g. 3-1-1): a 3-point player can beat two 1-point players if they
// finish their 3 gers before anyone else finishes theirs.
function firstToCompleteWin(room) {
  const state = room.muushig;
  if (!state) return null;
  const counts = {};
  for (const winnerId of state.trickWinners || []) {
    const key = String(winnerId);
    counts[key] = (counts[key] || 0) + 1;
    const need = roundStartPointsOf(room, winnerId);
    if (need > WIN_AT && counts[key] >= need) return winnerId;
  }
  return null;
}

function resolveRoundWinner(room) {
  return firstToCompleteWin(room);
}

function finishedWinners(room) {
  const first = firstToCompleteWin(room);
  if (first != null) {
    const rest = room.players
      .filter((player) =>
        !samePlayerId(player.playerId, first) &&
        (room.playerPoints[player.playerId] ?? START_POINTS) <= WIN_AT
      )
      .map((player) => player.playerId);
    return [first, ...rest];
  }
  return room.players
    .filter((player) => (room.playerPoints[player.playerId] ?? START_POINTS) <= WIN_AT)
    .map((player) => player.playerId);
}

function publicState(room) {
  const state = room.muushig;
  const match = room.muushigMatch ? matchStatus(room) : undefined;
  if (!state) return match ? { match } : {};
  return {
    gameType: 'muushig',
    match,
    phase: state.phase,
    trump: state.trumpTaken ? null : state.trump,
    trumpSuit: state.trumpSuit,
    trumpTaken: !!state.trumpTaken,
    stockLeft: state.stock.length,
    tricksWon: state.tricksWon,
    trickWinners: Array.isArray(state.trickWinners) ? state.trickWinners.slice() : [],
    roundStartPoints: { ...(state.roundStartPoints || {}) },
    trick: state.trick.map((play) => ({
      player: play.playerId,
      rank: play.card.rank,
      suit: play.card.suit,
    })),
    entered: state.entered,
    satOut: state.satOut,
    exchanged: state.exchanged,
    dealer: room.players[state.dealerIndex]?.playerId,
    seatOrder: Array.isArray(room.seatOrder) ? room.seatOrder.slice() : room.players.map((p) => p.playerId),
    canSitOut: room.players[room.currentPlayerIndex]
      ? canSitOut(room, room.players[room.currentPlayerIndex].playerId)
      : false,
    sitOutBlockReason: room.players[room.currentPlayerIndex]
      ? sitOutBlockReason(room, room.players[room.currentPlayerIndex].playerId)
      : null,
    sitOutStreak: { ...(state.sitOutStreak || {}) },
    maxSitOutStreak: MAX_SIT_OUT_STREAK,
    canNavshihKhozer:
      state.phase === "khozer" && room.players[state.dealerIndex]
        ? canNavshihKhozer(room, room.players[state.dealerIndex].playerId)
        : false,
    passedThisTrick: state.passedThisTrick || {},
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
  MAX_SIT_OUT_STREAK,
  BOOLT_PRIMARY_ROUNDS,
  MAX_MATCH_ROUNDS,
  DEFAULT_GER_PRICE,
  rankValue,
  createMuushigDeck,
  ensureMuushigPoints,
  resetMuushigPoints,
  applyTableSettings,
  resetMatchProgress,
  ensureMatch,
  currentGerPrice,
  applyGerPayouts: creditGer,
  creditGer,
  afterMatchRound,
  matchChampion,
  matchStatus,
  dealMuushigRound,
  decideEnter,
  canSitOut,
  sitOutBlockReason,
  sitOutCount,
  canNavshihKhozer,
  navshihKhozer,
  finishKhozerPhase,
  allDecided,
  startExchangePhase,
  startKhozerPhase,
  exchangeCards,
  skipExchange,
  allExchanged,
  finalizeExchangeIfStockDepleted,
  startPlayPhase,
  enteredPlayers,
  nextEnteredIndex,
  legalPlayCards,
  isLegalPlay,
  lowestLegalCard,
  trickWinner,
  applyRoundScores,
  awardTrick,
  playerCompletedWin,
  firstToCompleteWin,
  resolveRoundWinner,
  finishedWinners,
  findPlayer,
  samePlayerId,
  findFourAcesWinner,
  publicState,
  hasPlayedThisTrick,
  hasResolvedThisTrick,
  nextUnresolvedIndex,
  trickIsResolved,
  cardsOwned,
  sameCard,
  trumpAce,
  emptyByPlayer,
  normalizeSuit,
  normalizeCard,
};
