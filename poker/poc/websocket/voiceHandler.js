/**
 * WebSocket handler for WebRTC voice channel signaling.
 * Manages peer-to-peer audio mesh connections between players in the same game room.
 *
 * Supported messages:
 *   - voiceJoin: { type: 'voiceJoin', roomId, userId, username }
 *   - voiceOffer: { type: 'voiceOffer', targetUserId, sdp }
 *   - voiceAnswer: { type: 'voiceAnswer', targetUserId, sdp }
 *   - voiceIce: { type: 'voiceIce', targetUserId, candidate }
 *   - voiceMute: { type: 'voiceMute', muted: boolean }
 *   - voiceLeave: { type: 'voiceLeave' }
 */

// Map<roomId, Map<userId, { ws, userId, username, isMuted, roomId }>>
const voiceRooms = new Map();

// Map<WebSocket, { roomId, userId, username }>
const wsToVoice = new Map();

/**
 * Handle incoming voice-related signaling messages.
 * @returns {boolean} True if the message was handled by this voice handler.
 */
function handleVoiceMessage(msg, ws, player, roomId) {
  if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('voice')) {
    return false;
  }

  switch (msg.type) {
    case 'voiceJoin':
      handleVoiceJoin(msg, ws, player, roomId);
      return true;

    case 'voiceOffer':
      handleVoiceOffer(msg, ws, player, roomId);
      return true;

    case 'voiceAnswer':
      handleVoiceAnswer(msg, ws, player, roomId);
      return true;

    case 'voiceIce':
      handleVoiceIce(msg, ws, player, roomId);
      return true;

    case 'voiceMute':
      handleVoiceMute(msg, ws);
      return true;

    case 'voiceLeave':
      removeVoiceConnection(ws);
      return true;

    default:
      return false;
  }
}

/**
 * Player joins voice channel for a room.
 */
function handleVoiceJoin(msg, ws, player, roomId) {
  const effectiveRoomId = roomId || (msg.roomId ? String(msg.roomId).trim() : null);
  const rawUserId = msg.userId || (player ? player.userId : null);

  if (!effectiveRoomId || !rawUserId) {
    console.warn('⚠️ voiceJoin missing required fields:', { effectiveRoomId, rawUserId });
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Missing roomId or userId for voiceJoin'
    }));
    return;
  }

  const userId = Number(rawUserId);
  const username = msg.username || (player ? (player.username || player.displayName) : null) || `Player ${userId}`;

  // If this WebSocket connection is already in a voice channel, leave it first
  if (wsToVoice.has(ws)) {
    removeVoiceConnection(ws);
  }

  if (!voiceRooms.has(effectiveRoomId)) {
    voiceRooms.set(effectiveRoomId, new Map());
  }

  const roomVoiceMap = voiceRooms.get(effectiveRoomId);

  // If the same user ID already has an old connection in this room, clean it up
  if (roomVoiceMap.has(userId)) {
    const oldMember = roomVoiceMap.get(userId);
    if (oldMember.ws && oldMember.ws !== ws) {
      wsToVoice.delete(oldMember.ws);
    }
  }

  // Collect existing members to send back to the joining player
  const existingMembers = [];
  for (const [mUserId, member] of roomVoiceMap.entries()) {
    if (mUserId !== userId && member.ws && member.ws.readyState === 1) {
      existingMembers.push({
        userId: mUserId,
        username: member.username,
        muted: !!member.isMuted
      });
    }
  }

  // Save new participant
  const memberObj = {
    ws,
    userId,
    username,
    isMuted: false,
    roomId: effectiveRoomId
  };
  roomVoiceMap.set(userId, memberObj);
  wsToVoice.set(ws, { roomId: effectiveRoomId, userId, username });

  console.log(`🎙️ User ${userId} (${username}) joined voice channel in room "${effectiveRoomId}" (${roomVoiceMap.size} members)`);

  // 1. Send existing members list to the new joiner
  ws.send(JSON.stringify({
    type: 'voiceMembers',
    members: existingMembers
  }));

  // 2. Notify all existing members that a new peer joined
  const joinNotice = JSON.stringify({
    type: 'voiceJoined',
    userId,
    username
  });

  for (const [mUserId, member] of roomVoiceMap.entries()) {
    if (mUserId !== userId && member.ws && member.ws.readyState === 1) {
      member.ws.send(joinNotice);
    }
  }
}

/**
 * Route WebRTC SDP offer to target user.
 */
function handleVoiceOffer(msg, ws, player, roomId) {
  const voiceInfo = wsToVoice.get(ws);
  const effectiveRoomId = voiceInfo ? voiceInfo.roomId : (roomId || (msg.roomId ? String(msg.roomId).trim() : null));
  const fromUserId = voiceInfo ? voiceInfo.userId : Number(msg.fromUserId || msg.userId || (player ? player.userId : null));
  const fromUsername = voiceInfo ? voiceInfo.username : (player ? (player.username || player.displayName) : 'Тоглогч');
  const targetUserId = Number(msg.targetUserId);

  if (!effectiveRoomId || !fromUserId || !targetUserId) {
    console.warn(`⚠️ voiceOffer invalid params: from=${fromUserId}, to=${targetUserId}, room=${effectiveRoomId}`);
    return;
  }

  const roomVoiceMap = voiceRooms.get(effectiveRoomId);
  if (!roomVoiceMap) return;

  const target = roomVoiceMap.get(targetUserId);
  if (target && target.ws && target.ws.readyState === 1) {
    target.ws.send(JSON.stringify({
      type: 'voiceOffer',
      fromUserId,
      username: fromUsername,
      sdp: msg.sdp
    }));
  }
}

/**
 * Route WebRTC SDP answer to target user.
 */
function handleVoiceAnswer(msg, ws, player, roomId) {
  const voiceInfo = wsToVoice.get(ws);
  const effectiveRoomId = voiceInfo ? voiceInfo.roomId : (roomId || (msg.roomId ? String(msg.roomId).trim() : null));
  const fromUserId = voiceInfo ? voiceInfo.userId : Number(msg.fromUserId || msg.userId || (player ? player.userId : null));
  const targetUserId = Number(msg.targetUserId);

  if (!effectiveRoomId || !fromUserId || !targetUserId) {
    console.warn(`⚠️ voiceAnswer invalid params: from=${fromUserId}, to=${targetUserId}, room=${effectiveRoomId}`);
    return;
  }

  const roomVoiceMap = voiceRooms.get(effectiveRoomId);
  if (!roomVoiceMap) return;

  const target = roomVoiceMap.get(targetUserId);
  if (target && target.ws && target.ws.readyState === 1) {
    target.ws.send(JSON.stringify({
      type: 'voiceAnswer',
      fromUserId,
      sdp: msg.sdp
    }));
  }
}

/**
 * Route ICE candidate to target user.
 */
function handleVoiceIce(msg, ws, player, roomId) {
  const voiceInfo = wsToVoice.get(ws);
  const effectiveRoomId = voiceInfo ? voiceInfo.roomId : (roomId || (msg.roomId ? String(msg.roomId).trim() : null));
  const fromUserId = voiceInfo ? voiceInfo.userId : Number(msg.fromUserId || msg.userId || (player ? player.userId : null));
  const targetUserId = Number(msg.targetUserId);

  if (!effectiveRoomId || !fromUserId || !targetUserId) return;

  const roomVoiceMap = voiceRooms.get(effectiveRoomId);
  if (!roomVoiceMap) return;

  const target = roomVoiceMap.get(targetUserId);
  if (target && target.ws && target.ws.readyState === 1) {
    target.ws.send(JSON.stringify({
      type: 'voiceIce',
      fromUserId,
      candidate: msg.candidate
    }));
  }
}

/**
 * Update mute state and notify other members.
 */
function handleVoiceMute(msg, ws) {
  const voiceInfo = wsToVoice.get(ws);
  if (!voiceInfo) return;

  const roomVoiceMap = voiceRooms.get(voiceInfo.roomId);
  if (!roomVoiceMap) return;

  const member = roomVoiceMap.get(voiceInfo.userId);
  if (member) {
    member.isMuted = !!msg.muted;
  }

  const muteNotice = JSON.stringify({
    type: 'voiceMute',
    userId: voiceInfo.userId,
    muted: !!msg.muted
  });

  for (const [mUserId, m] of roomVoiceMap.entries()) {
    if (mUserId !== voiceInfo.userId && m.ws && m.ws.readyState === 1) {
      m.ws.send(muteNotice);
    }
  }
}

/**
 * Clean up a WebSocket connection from any voice room.
 */
function removeVoiceConnection(ws) {
  const voiceInfo = wsToVoice.get(ws);
  if (!voiceInfo) return;

  const { roomId, userId } = voiceInfo;
  wsToVoice.delete(ws);

  const roomVoiceMap = voiceRooms.get(roomId);
  if (roomVoiceMap) {
    roomVoiceMap.delete(userId);
    console.log(`🎙️ User ${userId} left voice channel in room "${roomId}" (${roomVoiceMap.size} remaining)`);

    const leftNotice = JSON.stringify({
      type: 'voiceLeft',
      userId
    });

    for (const member of roomVoiceMap.values()) {
      if (member.ws && member.ws.readyState === 1) {
        member.ws.send(leftNotice);
      }
    }

    if (roomVoiceMap.size === 0) {
      voiceRooms.delete(roomId);
    }
  }
}

/**
 * Get current voice participants for a room.
 */
function getVoiceMembers(roomId) {
  const roomVoiceMap = voiceRooms.get(roomId);
  if (!roomVoiceMap) return [];
  return Array.from(roomVoiceMap.values())
    .filter(m => m.ws && m.ws.readyState === 1)
    .map(m => ({
      userId: m.userId,
      username: m.username,
      muted: !!m.isMuted
    }));
}

module.exports = {
  handleVoiceMessage,
  removeVoiceConnection,
  getVoiceMembers
};
