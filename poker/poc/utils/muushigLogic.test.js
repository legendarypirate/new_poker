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
      exchanged: {},
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

console.log('muushigLogic tests passed');
