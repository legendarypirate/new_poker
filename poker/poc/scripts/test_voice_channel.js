const assert = require('assert');
const { handleVoiceMessage, removeVoiceConnection, getVoiceMembers } = require('../websocket/voiceHandler');

function createMockSocket(id) {
  const sent = [];
  return {
    id,
    readyState: 1, // WebSocket.OPEN
    send(data) {
      sent.push(JSON.parse(data));
    },
    getSent() {
      return sent;
    },
    popSent() {
      return sent.pop();
    },
    clearSent() {
      sent.length = 0;
    }
  };
}

console.log('🧪 Starting Voice Channel Signaling Tests...');

const wsA = createMockSocket('wsA');
const wsB = createMockSocket('wsB');
const wsC = createMockSocket('wsC');

// Test 1: User A joins voice room
console.log('Test 1: User A joins room_1');
handleVoiceMessage({
  type: 'voiceJoin',
  roomId: 'room_1',
  userId: 101,
  username: 'Alice'
}, wsA);

assert.strictEqual(wsA.getSent().length, 1);
assert.deepStrictEqual(wsA.getSent()[0], {
  type: 'voiceMembers',
  members: []
});
wsA.clearSent();

// Test 2: User B joins voice room
console.log('Test 2: User B joins room_1');
handleVoiceMessage({
  type: 'voiceJoin',
  roomId: 'room_1',
  userId: 102,
  username: 'Bob'
}, wsB);

// User B should get existing members [Alice]
assert.strictEqual(wsB.getSent().length, 1);
assert.deepStrictEqual(wsB.getSent()[0], {
  type: 'voiceMembers',
  members: [{ userId: 101, username: 'Alice', muted: false }]
});

// User A should get voiceJoined notice for Bob
assert.strictEqual(wsA.getSent().length, 1);
assert.deepStrictEqual(wsA.getSent()[0], {
  type: 'voiceJoined',
  userId: 102,
  username: 'Bob'
});
wsA.clearSent();
wsB.clearSent();

// Test 3: Offer routing (Alice creates offer to Bob)
console.log('Test 3: Alice sends voiceOffer to Bob');
handleVoiceMessage({
  type: 'voiceOffer',
  targetUserId: 102,
  sdp: 'v=0\r\no=alice...'
}, wsA);

assert.strictEqual(wsB.getSent().length, 1);
assert.strictEqual(wsB.getSent()[0].type, 'voiceOffer');
assert.strictEqual(wsB.getSent()[0].fromUserId, 101);
assert.strictEqual(wsB.getSent()[0].username, 'Alice');
assert.strictEqual(wsB.getSent()[0].sdp, 'v=0\r\no=alice...');
wsB.clearSent();

// Test 4: Answer routing (Bob sends voiceAnswer to Alice)
console.log('Test 4: Bob sends voiceAnswer to Alice');
handleVoiceMessage({
  type: 'voiceAnswer',
  targetUserId: 101,
  sdp: 'v=0\r\no=bob...'
}, wsB);

assert.strictEqual(wsA.getSent().length, 1);
assert.strictEqual(wsA.getSent()[0].type, 'voiceAnswer');
assert.strictEqual(wsA.getSent()[0].fromUserId, 102);
assert.strictEqual(wsA.getSent()[0].sdp, 'v=0\r\no=bob...');
wsA.clearSent();

// Test 5: ICE candidate exchange
console.log('Test 5: Alice & Bob exchange ICE candidates');
handleVoiceMessage({
  type: 'voiceIce',
  targetUserId: 102,
  candidate: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 }
}, wsA);

assert.strictEqual(wsB.getSent().length, 1);
assert.strictEqual(wsB.getSent()[0].type, 'voiceIce');
assert.strictEqual(wsB.getSent()[0].fromUserId, 101);
assert.strictEqual(wsB.getSent()[0].candidate.candidate, 'candidate:1');
wsB.clearSent();

handleVoiceMessage({
  type: 'voiceIce',
  targetUserId: 101,
  candidate: { candidate: 'candidate:2', sdpMid: '0', sdpMLineIndex: 0 }
}, wsB);

assert.strictEqual(wsA.getSent().length, 1);
assert.strictEqual(wsA.getSent()[0].type, 'voiceIce');
assert.strictEqual(wsA.getSent()[0].fromUserId, 102);
assert.strictEqual(wsA.getSent()[0].candidate.candidate, 'candidate:2');
wsA.clearSent();

// Test 6: Mute toggle
console.log('Test 6: Alice mutes microphone');
handleVoiceMessage({
  type: 'voiceMute',
  muted: true
}, wsA);

assert.strictEqual(wsB.getSent().length, 1);
assert.deepStrictEqual(wsB.getSent()[0], {
  type: 'voiceMute',
  userId: 101,
  muted: true
});
wsB.clearSent();

// Check members helper
const members = getVoiceMembers('room_1');
assert.strictEqual(members.length, 2);
assert.strictEqual(members.find(m => m.userId === 101).muted, true);
assert.strictEqual(members.find(m => m.userId === 102).muted, false);

// Test 7: User leaves voice channel
console.log('Test 7: Alice leaves voice channel');
handleVoiceMessage({
  type: 'voiceLeave'
}, wsA);

assert.strictEqual(wsB.getSent().length, 1);
assert.deepStrictEqual(wsB.getSent()[0], {
  type: 'voiceLeft',
  userId: 101
});
wsB.clearSent();

assert.strictEqual(getVoiceMembers('room_1').length, 1);

// Test 8: Disconnect cleanup
console.log('Test 8: Bob disconnects');
removeVoiceConnection(wsB);
assert.strictEqual(getVoiceMembers('room_1').length, 0);

console.log('✅ ALL VOICE CHANNEL TESTS PASSED SUCCESSFULLY!');
