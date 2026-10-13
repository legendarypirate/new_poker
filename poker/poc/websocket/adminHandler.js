// Admin chat storage
const adminChats = new Map();
const adminConnections = new Set();
// Store user info by WebSocket connection for admin chat room
const adminChatUsers = new Map(); // ws -> { userId, username }

function getUserChat(userId, userInfo = null) {
  if (!adminChats.has(userId)) {
    adminChats.set(userId, {
      userInfo: userInfo || { userId, username: 'Unknown User' },
      messages: [],
      unreadCount: 0,
      lastActivity: new Date()
    });
  }
  return adminChats.get(userId);
}

function addUserMessage(userId, message, isAdmin = false) {
  const userChat = getUserChat(userId);
  const newMessage = {
    id: Date.now().toString(),
    userId: isAdmin ? 'admin' : userId,
    userName: isAdmin ? 'Admin' : (userChat.userInfo?.username || userChat.userInfo?.name || 'User'),
    content: message,
    timestamp: new Date(),
    isAdmin: isAdmin,
    read: isAdmin
  };

  userChat.messages.push(newMessage);
  userChat.lastActivity = new Date();
  
  if (!isAdmin) {
    userChat.unreadCount++;
  }

  return newMessage;
}

function markUserMessagesAsRead(userId) {
  const userChat = adminChats.get(userId);
  if (userChat) {
    userChat.unreadCount = 0;
    userChat.messages.forEach(msg => {
      if (!msg.isAdmin) msg.read = true;
    });
  }
}

function getAllChatUsers() {
  const users = [];
  adminChats.forEach((chat, userId) => {
    users.push({
      id: userId,
      name: chat.userInfo.username || 'Unknown User',
      avatar: chat.userInfo.avatar,
      lastMessage: chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content : 'No messages',
      lastMessageTime: chat.lastActivity,
      unreadCount: chat.unreadCount,
      isOnline: false
    });
  });
  
  return users.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
}

function broadcastToAdmins(message) {
  adminConnections.forEach((adminWs) => {
    if (adminWs.readyState === 1) { // WebSocket.OPEN
      adminWs.send(JSON.stringify(message));
    }
  });
}

function handleAdminMessage(msg, ws, rooms) {
  // Admin connection
  if (msg.type === "adminConnect") {
    adminConnections.add(ws);
    
    console.log(`🔧 Admin connected to chat panel`);
    
    const chatUsers = getAllChatUsers();
    ws.send(JSON.stringify({
      type: "adminChatUsers",
      users: chatUsers
    }));
    
    return true;
  }

  // Admin sends message to user
  if (msg.type === "adminSendMessage") {
    const { userId, message } = msg;
    
    if (!userId || !message) {
      ws.send(JSON.stringify({ type: "error", message: "Missing userId or message" }));
      return true;
    }
    
    const userChat = getUserChat(userId);
    const newMessage = addUserMessage(userId, message, true);
    
    // Include recipient userId so admin panel knows which chat this message belongs to
    broadcastToAdmins({
      type: "adminNewMessage",
      message: newMessage,
      recipientUserId: userId  // Add recipient userId
    });
    
    let userFound = false;
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const userPlayer = room.players.find(p => p.playerId.toString() === userId);
      if (userPlayer && userPlayer.ws.readyState === 1) { // WebSocket.OPEN
        userPlayer.ws.send(JSON.stringify({
          type: "adminNewMessage",
          message: newMessage
        }));
        userFound = true;
        console.log(`💬 Admin message delivered to user ${userId} in room ${roomId}`);
      }
    }
    
    if (!userFound) {
      console.log(`ℹ️ User ${userId} is not currently connected, message stored in history`);
    }
    
    console.log(`💬 Admin sent message to user ${userId}: ${message}`);
    return true;
  }

  // Admin requests user messages
  if (msg.type === "adminGetUserMessages") {
    const { userId } = msg;
    const userChat = getUserChat(userId);
    
    ws.send(JSON.stringify({
      type: "adminUserMessages",
      userId,
      messages: userChat.messages
    }));
    
    markUserMessagesAsRead(userId);
    return true;
  }

  return false;
}

function handleUserAdminMessage(msg, ws, player, rooms) {
  // Try to get userId from player or from rooms
  let userId = null;
  let username = null;
  
  if (player) {
    userId = player.playerId?.toString() || player.userId?.toString();
    username = player.username;
  } else {
    // Try to find player in any room by WebSocket
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const foundPlayer = room.players.find(p => p.ws === ws);
      if (foundPlayer) {
        userId = foundPlayer.playerId?.toString() || foundPlayer.userId?.toString();
        username = foundPlayer.username;
        break;
      }
    }
    
    // If not found in game rooms, check admin chat users
    if (!userId && adminChatUsers.has(ws)) {
      const userInfo = adminChatUsers.get(ws);
      userId = userInfo.userId?.toString();
      username = userInfo.username;
    }
  }

  // User requests message history
  if (msg.type === "getMessageHistory") {
    if (!userId) {
      // Try to get userId from joinRoom message if it was just sent
      // For now, allow it to work with a temporary userId
      ws.send(JSON.stringify({ type: "error", message: "Please join a room first" }));
      return true;
    }
    
    const userChat = getUserChat(userId);
    
    ws.send(JSON.stringify({
      type: "messageHistory",
      messages: userChat.messages,
      userId: userId
    }));
    
    console.log(`📚 Sent message history to user ${userId} (${userChat.messages.length} messages)`);
    return true;
  }

  // User joins admin chat room specifically
  if (msg.type === "joinAdminChat") {
    if (!userId) {
      ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
      return true;
    }
    
    const username = player?.username || msg.username || 'User';
    const userChat = getUserChat(userId, {
      userId: userId,
      username: username
    });
    
    // Store user info for this WebSocket connection
    adminChatUsers.set(ws, { userId, username });
    
    ws.send(JSON.stringify({
      type: "messageHistory",
      messages: userChat.messages,
      userId: userId
    }));
    
    console.log(`💬 User ${userId} joined admin chat with ${userChat.messages.length} messages`);
    return true;
  }
  
  // Handle joinRoom for admin_chat_room - store user info
  if (msg.type === "joinRoom" && msg.roomId === "admin_chat_room") {
    const chatUserId = msg.userId || msg.user_id;
    const chatUsername = msg.username || 'User';
    
    if (chatUserId) {
      // Store user info for this WebSocket connection
      adminChatUsers.set(ws, { userId: chatUserId, username: chatUsername });
      
      // Initialize or update user chat
      const userChat = getUserChat(chatUserId.toString(), {
        userId: chatUserId.toString(),
        username: chatUsername
      });
      
      // Send message history
      ws.send(JSON.stringify({
        type: "messageHistory",
        messages: userChat.messages,
        userId: chatUserId.toString()
      }));
      
      console.log(`🎮 Player ${chatUserId} joined room ${msg.roomId} (${chatUsername})`);
      console.log(`📚 Sent message history to user ${chatUserId} (${userChat.messages.length} messages)`);
      
      // Return true to prevent game handler from processing this
      return true;
    } else {
      // Send error if userId is missing
      ws.send(JSON.stringify({ 
        type: "error", 
        message: "userId is required to join admin chat room" 
      }));
      console.log(`❌ Failed to join admin_chat_room: userId is missing`);
      return true; // Still return true to prevent game handler from processing
    }
  }

  // User sends message to admin (from game)
  if (msg.type === "userToAdminMessage") {
    // Get userId from various sources
    let finalUserId = userId;
    let finalUsername = username || msg.username || 'User';
    
    // If userId is still null, try to get it from stored admin chat users
    if (!finalUserId && adminChatUsers.has(ws)) {
      const userInfo = adminChatUsers.get(ws);
      finalUserId = userInfo.userId?.toString();
      finalUsername = userInfo.username || finalUsername;
    }
    
    // If still no userId, try to get from message
    if (!finalUserId) {
      finalUserId = msg.userId || msg.user_id;
    }
    
    if (!finalUserId) {
      ws.send(JSON.stringify({ type: "error", message: "Not authenticated. Please join the chat room first." }));
      return true;
    }
    
    const { message } = msg;
    if (!message || message.trim() === '') {
      ws.send(JSON.stringify({ type: "error", message: "Message cannot be empty" }));
      return true;
    }
    
    // Use the final username (prioritize msg.username if provided)
    finalUsername = msg.username || finalUsername || 'User';
    
    const userChat = getUserChat(finalUserId.toString(), {
      userId: finalUserId.toString(),
      username: finalUsername
    });
    
    // Update stored user info if needed
    if (adminChatUsers.has(ws)) {
      adminChatUsers.set(ws, { userId: finalUserId.toString(), username: finalUsername });
    }
    
    const newMessage = addUserMessage(finalUserId.toString(), message.trim(), false);
    
    // Include recipient userId (which is the user who sent the message)
    broadcastToAdmins({
      type: "adminNewMessage",
      message: newMessage,
      recipientUserId: finalUserId.toString()  // Add recipient userId
    });
    
    const chatUsers = getAllChatUsers();
    broadcastToAdmins({
      type: "adminChatUsers",
      users: chatUsers
    });
    
    console.log(`💬 User ${finalUserId} (${finalUsername}) sent message to admin: ${message}`);
    
    ws.send(JSON.stringify({
      type: "userMessageSent",
      success: true,
      message: newMessage
    }));
    
    return true;
  }

  return false;
}

function removeAdminConnection(ws) {
  adminConnections.delete(ws);
  console.log(`🔧 Admin disconnected from chat panel`);
}

function removeAdminChatUser(ws) {
  adminChatUsers.delete(ws);
}

module.exports = {
  handleAdminMessage,
  handleUserAdminMessage,
  removeAdminConnection,
  removeAdminChatUser,
  getUserChat
};

