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
assert.strictEqual(dealRoom.muushig.phase, 'khozer');
assert.strictEqual(dealRoom.currentPlayerIndex, dealRoom.muushig.dealerIndex);
assert.strictEqual(logic.canNavshihKhozer(dealRoom, dealRoom.players[dealRoom.muushig.dealerIndex].playerId), true);
const oldTrump = { ...dealRoom.muushig.trump };
const flipped = logic.navshihKhozer(dealRoom, dealRoom.players[dealRoom.muushig.dealerIndex]);
assert.strictEqual(flipped.ok, true);
assert.notStrictEqual(flipped.trump.rank + flipped.trump.suit, oldTrump.rank + oldTrump.suit);
assert.strictEqual(dealRoom.muushig.khozerNavshihed, true);
assert.strictEqual(logic.canNavshihKhozer(dealRoom, dealRoom.players[dealRoom.muushig.dealerIndex].playerId), false);
logic.finishKhozerPhase(dealRoom);
assert.strictEqual(dealRoom.muushig.phase, 'enter');
assert.strictEqual(
  dealRoom.currentPlayerIndex,
  (dealRoom.muushig.dealerIndex + 1) % dealRoom.players.length
);

const mustLeadAce = logic.legalPlayCards(
  [{ rank: '9', suit: '♥' }, { rank: 'A', suit: '♠' }],
  [],
  '♠'
);
assert.deepStrictEqual(mustLeadAce.map((c) => c.rank + c.suit), ['A♠']);

console.log('muushigLogic tests passed');
