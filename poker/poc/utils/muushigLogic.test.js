const assert = require('assert');
const logic = require('./muushigLogic');

function roomWithHands(hands, trumpSuit = '♠') {
  const players = hands.map((hand, i) => ({
    playerId: i + 1,
    hand: hand.map(([rank, suit]) => ({ rank, suit })),
  }));
  return {
    players,
    playerPoints: Object.fromEntries(players.map((p) => [p.playerId, 15])),
    muushig: {
      trump: { rank: '7', suit: trumpSuit },
      trumpSuit,
      trumpTaken: false,
      stock: [],
      phase: 'play',
      trick: [],
      tricksWon: Object.fromEntries(players.map((p) => [p.playerId, 0])),
      entered: Object.fromEntries(players.map((p) => [p.playerId, true])),
      satOut: {},
      exchanged: {},
      sitOutStreak: {},
      dealerIndex: 0,
    },
  };
}

const follow = logic.legalPlayCards(
  [{ rank: '9', suit: '♥' }, { rank: 'A', suit: '♠' }, { rank: '8', suit: '♦' }],
  [{ playerId: 1, card: { rank: '10', suit: '♥' } }],
  '♠'
);
assert.deepStrictEqual(follow.map((c) => c.rank + c.suit), ['9♥']);

const mustTrump = logic.legalPlayCards(
  [{ rank: '9', suit: '♣' }, { rank: 'A', suit: '♠' }],
  [{ playerId: 1, card: { rank: '10', suit: '♥' } }],
  '♠'
);
assert.deepStrictEqual(mustTrump.map((c) => c.rank + c.suit), ['A♠']);

const winner = logic.trickWinner([
  { playerId: 1, card: { rank: 'A', suit: '♥' } },
  { playerId: 2, card: { rank: '7', suit: '♠' } },
  { playerId: 3, card: { rank: 'K', suit: '♥' } },
], '♠');
assert.strictEqual(winner, 2);

const scored = roomWithHands([
  [['A', '♥']],
  [['K', '♥']],
]);
scored.muushig.tricksWon = { 1: 3, 2: 0 };
const deltas = logic.applyRoundScores(scored);
assert.strictEqual(deltas[1], -3);
assert.strictEqual(deltas[2], 5);
assert.strictEqual(scored.playerPoints[1], 12);
assert.strictEqual(scored.playerPoints[2], 20);

const sitOutRoom = roomWithHands([
  [['A', '♥']],
  [['K', '♥']],
  [['Q', '♥']],
]);
sitOutRoom.muushig.phase = 'enter';
sitOutRoom.muushig.entered = {};
sitOutRoom.muushig.satOut = {};
sitOutRoom.currentPlayerIndex = 1;
assert.strictEqual(logic.canSitOut(sitOutRoom, 2), true);
const navshih = logic.decideEnter(sitOutRoom, sitOutRoom.players[1], false);
assert.strictEqual(navshih.entered, false);
sitOutRoom.currentPlayerIndex = 2;
const lastMustEnter = !logic.canSitOut(sitOutRoom, 3) || sitOutRoom.players.length === 2;
assert.strictEqual(typeof lastMustEnter, 'boolean');

const forcedRoom = roomWithHands([
  [['7', '♥']],
  [['8', '♥']],
  [['9', '♥']],
]);
forcedRoom.muushig.phase = 'enter';
forcedRoom.muushig.entered = {};
forcedRoom.muushig.satOut = {};
forcedRoom.muushig.sitOutStreak = { 1: 3 };
assert.strictEqual(logic.canSitOut(forcedRoom, 1), false);
assert.strictEqual(logic.sitOutBlockReason(forcedRoom, 1), 'streak');
const forced = logic.decideEnter(forcedRoom, forcedRoom.players[0], false);
assert.strictEqual(forced.entered, true);
assert.strictEqual(forced.forced, true);
assert.strictEqual(forced.reason, 'streak');
assert.strictEqual(forcedRoom.muushig.sitOutStreak[1], 0);
assert.strictEqual(forcedRoom.muushig.entered[1], true);

const streakRoom = roomWithHands([
  [['7', '♥']],
  [['8', '♥']],
  [['9', '♥']],
]);
streakRoom.muushig.phase = 'enter';
streakRoom.muushig.entered = {};
streakRoom.muushig.satOut = {};
for (let round = 1; round <= 3; round++) {
  streakRoom.muushig.phase = 'enter';
  streakRoom.muushig.entered = {};
  streakRoom.muushig.satOut = {};
  assert.strictEqual(logic.canSitOut(streakRoom, 1), true, `sit out allowed in round ${round}`);
  const sat = logic.decideEnter(streakRoom, streakRoom.players[0], false);
  assert.strictEqual(sat.entered, false);
  assert.strictEqual(streakRoom.muushig.sitOutStreak[1], round);
}
streakRoom.muushig.phase = 'enter';
streakRoom.muushig.entered = {};
streakRoom.muushig.satOut = {};
assert.strictEqual(logic.canSitOut(streakRoom, 1), false);
const fourth = logic.decideEnter(streakRoom, streakRoom.players[0], false);
assert.strictEqual(fourth.entered, true);
assert.strictEqual(fourth.forced, true);

const satScored = roomWithHands([[['A', '♥']], [['K', '♥']]]);
satScored.muushig.satOut = { 2: true };
satScored.muushig.entered = { 1: true };
satScored.muushig.tricksWon = { 1: 5, 2: 0 };
const satDeltas = logic.applyRoundScores(satScored);
assert.strictEqual(satDeltas[2], 0);
assert.strictEqual(satScored.playerPoints[2], 15);

const dealRoom = {
  players: [{ playerId: 1, hand: [] }, { playerId: 2, hand: [] }, { playerId: 3, hand: [] }],
};
logic.dealMuushigRound(dealRoom);
assert.strictEqual(dealRoom.muushig.phase, 'enter');
dealRoom.muushig.entered = Object.fromEntries(dealRoom.players.map((p) => [p.playerId, true]));
dealRoom.muushig.exchanged = Object.fromEntries(dealRoom.players.map((p) => [p.playerId, true]));
assert.strictEqual(logic.startKhozerPhase(dealRoom), true);
assert.strictEqual(dealRoom.muushig.phase, 'khozer');
assert.strictEqual(dealRoom.currentPlayerIndex, dealRoom.muushig.dealerIndex);
assert.strictEqual(logic.canNavshihKhozer(dealRoom, dealRoom.players[dealRoom.muushig.dealerIndex].playerId), true);
assert.strictEqual(logic.canNavshihKhozer(dealRoom, dealRoom.players[(dealRoom.muushig.dealerIndex + 1) % 3].playerId), false);
const oldTrump = { ...dealRoom.muushig.trump };
const dealer = dealRoom.players[dealRoom.muushig.dealerIndex];
const giveAway = { ...dealer.hand[0] };
const before = dealer.hand.length;
const stockBeforeNav = dealRoom.muushig.stock.length;
const taken = logic.navshihKhozer(dealRoom, dealer, [giveAway]);
assert.strictEqual(taken.ok, true);
assert.strictEqual(dealer.hand.length, before);
assert.ok(dealer.hand.some((c) => c.rank === oldTrump.rank && c.suit === oldTrump.suit));
assert.ok(!dealer.hand.some((c) => c.rank === giveAway.rank && c.suit === giveAway.suit));
assert.strictEqual(dealRoom.muushig.trump.rank + dealRoom.muushig.trump.suit, oldTrump.rank + oldTrump.suit);
assert.strictEqual(dealRoom.muushig.trumpTaken, false);
assert.strictEqual(dealRoom.muushig.stock.length, stockBeforeNav);
assert.ok(!dealRoom.muushig.stock.some((c) => c.rank === giveAway.rank && c.suit === giveAway.suit));
assert.strictEqual(dealRoom.muushig.khozerNavshihed, true);
assert.strictEqual(logic.canNavshihKhozer(dealRoom, dealer.playerId), false);
logic.finishKhozerPhase(dealRoom);
assert.strictEqual(dealRoom.muushig.phase, 'play');

const { allocateSeatOrder } = require('./seatOrder');
const clockwiseRoom = {
  players: [
    { playerId: 10, hand: [] },
    { playerId: 20, hand: [] },
    { playerId: 30, hand: [] },
  ],
  seatOrder: [20, 30, 10],
};
allocateSeatOrder(clockwiseRoom);
logic.dealMuushigRound(clockwiseRoom);
assert.deepStrictEqual(clockwiseRoom.players.map((p) => p.playerId), [20, 30, 10]);
assert.strictEqual(clockwiseRoom.muushig.phase, 'enter');
assert.strictEqual(clockwiseRoom.muushig.dealerIndex, 0);
assert.strictEqual(clockwiseRoom.players[clockwiseRoom.currentPlayerIndex].playerId, 30);
clockwiseRoom.muushig.entered = { 20: true, 30: true, 10: true };
clockwiseRoom.muushig.exchanged = { 20: true, 30: true, 10: true };
assert.strictEqual(logic.startKhozerPhase(clockwiseRoom), true);
assert.strictEqual(clockwiseRoom.muushig.phase, 'khozer');
assert.strictEqual(clockwiseRoom.players[clockwiseRoom.currentPlayerIndex].playerId, 20);

const swapRoom = {
  players: [
    { playerId: 1, hand: [
      { rank: '7', suit: '♥' }, { rank: '8', suit: '♥' }, { rank: '9', suit: '♥' },
      { rank: '10', suit: '♥' }, { rank: 'J', suit: '♥' },
    ]},
    { playerId: 2, hand: [
      { rank: '7', suit: '♠' }, { rank: '8', suit: '♠' }, { rank: '9', suit: '♠' },
      { rank: '10', suit: '♠' }, { rank: 'J', suit: '♠' },
    ]},
  ],
};
logic.dealMuushigRound(swapRoom);
swapRoom.muushig.phase = 'exchange';
swapRoom.muushig.entered = { 1: true, 2: true };
const stockBefore = swapRoom.muushig.stock.length;
const give = swapRoom.players[0].hand.slice(0, 3);
const swapped = logic.exchangeCards(swapRoom, swapRoom.players[0], give);
assert.strictEqual(swapped.ok, true);
assert.strictEqual(swapRoom.players[0].hand.length, 5);
assert.strictEqual(swapRoom.muushig.stock.length, stockBefore - 3);

const mustLeadAce = logic.legalPlayCards(
  [{ rank: '9', suit: '♥' }, { rank: 'A', suit: '♠' }],
  [],
  '♠'
);
assert.deepStrictEqual(mustLeadAce.map((c) => c.rank + c.suit), ['A♠']);

const clubTrumpWins = logic.trickWinner([
  { playerId: 1, card: { rank: 'A', suit: '♥' } },
  { playerId: 2, card: { rank: '7', suit: '♣' } },
  { playerId: 3, card: { rank: 'K', suit: '♦' } },
], '♣');
assert.strictEqual(clubTrumpWins, 2);

const cannotDump = logic.legalPlayCards(
  [{ rank: '9', suit: '♦' }, { rank: '8', suit: '♥' }],
  [{ playerId: 1, card: { rank: '10', suit: '♥' } }],
  '♣'
);
assert.deepStrictEqual(cannotDump.map((c) => c.rank + c.suit), ['8♥']);

const mustEatWithTrump = logic.legalPlayCards(
  [{ rank: '9', suit: '♦' }, { rank: '7', suit: '♣' }],
  [{ playerId: 1, card: { rank: '10', suit: '♥' } }],
  '♣'
);
assert.deepStrictEqual(mustEatWithTrump.map((c) => c.rank + c.suit), ['7♣']);

const mustFollowDiamond = logic.legalPlayCards(
  [{ rank: 'K', suit: '♦' }, { rank: '9', suit: '♠' }, { rank: '10', suit: '♠' }],
  [{ playerId: 1, card: { rank: 'A', suit: '♦' } }],
  '♠'
);
assert.deepStrictEqual(mustFollowDiamond.map((c) => c.rank + c.suit), ['K♦']);
assert.strictEqual(
  logic.isLegalPlay(
    [{ rank: 'K', suit: '♦' }, { rank: '9', suit: '♠' }],
    { rank: '9', suit: '♠' },
    [{ playerId: 1, card: { rank: 'A', suit: '♦' } }],
    '♠'
  ),
  false
);

const onjihRoom = roomWithHands([
  [['A', '♥']],
  [['K', '♥']],
  [['Q', '♥']],
]);
onjihRoom.muushig.trick = [{ playerId: 1, card: { rank: 'A', suit: '♥' } }];
onjihRoom.muushig.passedThisTrick = { 2: true };
assert.strictEqual(logic.hasResolvedThisTrick(onjihRoom.muushig, 1), true);
assert.strictEqual(logic.hasResolvedThisTrick(onjihRoom.muushig, 2), true);
assert.strictEqual(logic.hasResolvedThisTrick(onjihRoom.muushig, 3), false);
assert.strictEqual(logic.trickIsResolved(onjihRoom), false);
onjihRoom.muushig.passedThisTrick[3] = true;
assert.strictEqual(logic.trickIsResolved(onjihRoom), true);

function raceTable(pointsById) {
  const ids = Object.keys(pointsById).map(Number);
  const room = roomWithHands(ids.map(() => [['A', '♥']]));
  room.players = ids.map((id) => ({ playerId: id, hand: [{ rank: 'A', suit: '♥' }] }));
  room.playerPoints = { ...pointsById };
  room.muushig.roundStartPoints = { ...pointsById };
  room.muushig.tricksWon = Object.fromEntries(ids.map((id) => [id, 0]));
  room.muushig.trickWinners = [];
  room.muushig.entered = Object.fromEntries(ids.map((id) => [id, true]));
  return room;
}

const raceRoom = raceTable({ 1: 2, 2: 1 });
assert.strictEqual(logic.awardTrick(raceRoom, 1), false);
assert.strictEqual(logic.awardTrick(raceRoom, 2), true);
assert.strictEqual(logic.resolveRoundWinner(raceRoom), 2);

const raceTwoFirst = raceTable({ 1: 2, 2: 1 });
assert.strictEqual(logic.awardTrick(raceTwoFirst, 1), false);
assert.strictEqual(logic.awardTrick(raceTwoFirst, 1), true);
assert.strictEqual(logic.resolveRoundWinner(raceTwoFirst), 1);
assert.strictEqual(logic.playerCompletedWin(raceTwoFirst, 2), false);

const threeOneOne = raceTable({ 1: 3, 2: 1, 3: 1 });
assert.strictEqual(logic.awardTrick(threeOneOne, 1), false);
assert.strictEqual(logic.awardTrick(threeOneOne, 1), false);
assert.strictEqual(logic.awardTrick(threeOneOne, 1), true);
assert.strictEqual(logic.resolveRoundWinner(threeOneOne), 1);
assert.strictEqual(logic.playerCompletedWin(threeOneOne, 2), false);
assert.strictEqual(logic.playerCompletedWin(threeOneOne, 3), false);

const onePointFinishesFirst = raceTable({ 1: 3, 2: 1, 3: 1 });
assert.strictEqual(logic.awardTrick(onePointFinishesFirst, 1), false);
assert.strictEqual(logic.awardTrick(onePointFinishesFirst, 3), true);
assert.strictEqual(logic.resolveRoundWinner(onePointFinishesFirst), 3);

const laterPlayerArrayOrder = raceTable({ 10: 1, 20: 4, 30: 1 });
assert.strictEqual(logic.awardTrick(laterPlayerArrayOrder, 20), false);
assert.strictEqual(logic.awardTrick(laterPlayerArrayOrder, 20), false);
assert.strictEqual(logic.awardTrick(laterPlayerArrayOrder, 20), false);
assert.strictEqual(logic.awardTrick(laterPlayerArrayOrder, 20), true);
assert.strictEqual(logic.resolveRoundWinner(laterPlayerArrayOrder), 20);

const stringIds = raceTable({ 1: 3, 2: 1, 3: 1 });
assert.strictEqual(logic.awardTrick(stringIds, '1'), false);
assert.strictEqual(logic.awardTrick(stringIds, '1'), false);
assert.strictEqual(logic.awardTrick(stringIds, '1'), true);
assert.strictEqual(String(logic.resolveRoundWinner(stringIds)), '1');

const fullRoundBothWouldFinish = raceTable({ 1: 3, 2: 1, 3: 1 });
for (const winner of [1, 2, 1, 3, 1]) logic.awardTrick(fullRoundBothWouldFinish, winner);
assert.strictEqual(logic.resolveRoundWinner(fullRoundBothWouldFinish), 2);

const dealSnap = {
  players: [{ playerId: 1, hand: [] }, { playerId: 2, hand: [] }, { playerId: 3, hand: [] }],
  playerPoints: { 1: 3, 2: 1, 3: 1 },
};
logic.dealMuushigRound(dealSnap);
assert.deepStrictEqual(dealSnap.muushig.roundStartPoints, { 1: 3, 2: 1, 3: 1 });
assert.deepStrictEqual(dealSnap.muushig.trickWinners, []);

const seriesRoom = {
  players: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }],
};
logic.applyTableSettings(seriesRoom, { boolt: false, rounds: 3, gerPrice: 500 });
assert.strictEqual(seriesRoom.muushigMatch.primaryRounds, 3);
assert.strictEqual(logic.currentGerPrice(seriesRoom), 500);
let series = logic.afterMatchRound(seriesRoom, 1);
assert.strictEqual(series.done, false);
series = logic.afterMatchRound(seriesRoom, 2);
assert.strictEqual(series.done, false);
series = logic.afterMatchRound(seriesRoom, 1);
assert.strictEqual(series.done, true);
assert.strictEqual(logic.matchChampion(seriesRoom).playerId, 1);

const booltRoom = {
  players: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }],
};
logic.applyTableSettings(booltRoom, { boolt: true, gerPrice: 1000 });
assert.strictEqual(booltRoom.muushigMatch.primaryRounds, 5);
assert.strictEqual(logic.currentGerPrice(booltRoom), 1000);
for (let i = 0; i < 4; i++) {
  const step = logic.afterMatchRound(booltRoom, 1);
  assert.strictEqual(step.done, false);
  assert.strictEqual(step.next, 'primary');
}
const intoBoolt = logic.afterMatchRound(booltRoom, 1);
assert.strictEqual(intoBoolt.done, false);
assert.strictEqual(intoBoolt.next, 'boolt');
assert.strictEqual(intoBoolt.booltRounds, 2);
assert.strictEqual(logic.currentGerPrice(booltRoom), 2000);
const booltOne = logic.afterMatchRound(booltRoom, 2);
assert.strictEqual(booltOne.done, false);
const booltTwo = logic.afterMatchRound(booltRoom, 3);
assert.strictEqual(booltTwo.done, true);

const payoutRoom = {
  players: [{ playerId: 1 }, { playerId: 2 }],
};
logic.applyTableSettings(payoutRoom, { gerPrice: 500 });
const paid = logic.applyGerPayouts(payoutRoom, { 1: -2, 2: 5 });
assert.strictEqual(paid.price, 500);
assert.strictEqual(paid.payouts[1], 1000);
assert.strictEqual(paid.payouts[2], -2500);

console.log('muushigLogic tests passed');
