const assert = require('assert');
const {
  ensureSeatOrder,
  allocateSeatOrder,
  syncPlayersToSeatOrder,
  chooseSeat,
  seatedPlayerIds,
} = require('./seatOrder');

const room = {
  maxPlayers: 4,
  players: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }],
  seatSlots: [1, 2, 3, null],
};

ensureSeatOrder(room);
assert.strictEqual(room.seatOrder.length, 3);
assert.ok(room.seatOrder.includes(1) && room.seatOrder.includes(2) && room.seatOrder.includes(3));
const waiting = room.seatOrder.slice();

ensureSeatOrder(room);
assert.deepStrictEqual(room.seatOrder, waiting);

allocateSeatOrder(room);
assert.strictEqual(room.seatOrderLocked, true);
assert.strictEqual(room.seatOrder.length, 3);

room.players.push({ playerId: 4 });
const pick = chooseSeat(room, { playerId: 4 }, 3);
assert.strictEqual(pick.ok, true);
assert.deepStrictEqual(seatedPlayerIds(room), [1, 2, 3, 4]);

const taken = chooseSeat(room, { playerId: 99 }, 0);
assert.strictEqual(taken.ok, false);

allocateSeatOrder(room, { fresh: true });
assert.strictEqual(room.seatOrderLocked, true);
assert.strictEqual(room.seatOrder.length, 4);
assert.ok(room.seatOrder.includes(4));

const mixed = {
  maxPlayers: 3,
  players: [{ playerId: 3 }, { playerId: 1 }, { playerId: 2 }],
  seatSlots: [1, 2, 3],
  seatOrder: [1, 2, 3],
  currentPlayerIndex: 0,
  muushig: { dealerIndex: 0 },
};
syncPlayersToSeatOrder(mixed);
assert.deepStrictEqual(mixed.players.map((p) => p.playerId), [1, 2, 3]);
assert.strictEqual(mixed.currentPlayerIndex, 2);
assert.strictEqual(mixed.muushig.dealerIndex, 2);

console.log('seatOrder tests passed');
