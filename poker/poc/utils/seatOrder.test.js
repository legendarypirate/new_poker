const assert = require('assert');
const { ensureSeatOrder, allocateSeatOrder } = require('./seatOrder');

const room = {
  players: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }],
};

ensureSeatOrder(room);
assert.strictEqual(room.seatOrder.length, 3);
assert.ok(room.seatOrder.includes(1) && room.seatOrder.includes(2) && room.seatOrder.includes(3));
const waiting = room.seatOrder.slice();

ensureSeatOrder(room);
assert.deepStrictEqual(room.seatOrder, waiting);

allocateSeatOrder(room);
assert.strictEqual(room.seatOrderLocked, true);
assert.deepStrictEqual(room.seatOrder, waiting);

room.players.push({ playerId: 4 });
ensureSeatOrder(room);
assert.deepStrictEqual(room.seatOrder, [...waiting, 4]);

allocateSeatOrder(room, { fresh: true });
assert.strictEqual(room.seatOrderLocked, true);
assert.strictEqual(room.seatOrder.length, 4);
assert.ok(room.seatOrder.includes(4));

console.log('seatOrder tests passed');
