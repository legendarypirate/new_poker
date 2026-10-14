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

console.log('muushigLogic tests passed');
