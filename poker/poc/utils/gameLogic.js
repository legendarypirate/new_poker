const { createDeck } = require('./cardUtils');
const db = require('../app/models');

function getPlayerCardCounts(room) {
  const counts = {};
  room.players.forEach(player => {
    counts[player.playerId] = player.hand.length;
  });
  return counts;
}

function calculatePoints(hand) {
  // Your existing point calculation logic
  let points = 0;
  hand.forEach(card => {
    if (card.rank === '2') points += 2;
    else if (card.rank === 'A') points += 1;
    else if (['K', 'Q', 'J'].includes(card.rank)) points += 0.5;
  });
  return points;
}

function calculateRoundPoints(roomId, winnerId, rooms) {
  const room = rooms[roomId];
  const points = {};
  
  // Winner gets 0 points
  points[winnerId] = 0;
  
  // Calculate points for other players
  for (let player of room.players) {
    if (player.playerId !== winnerId) {
      const cardCount = player.hand.length;
      
      // POINT SYSTEM WITH MULTIPLICATION:
      let playerPoints = cardCount; // Base points = number of cards
      
      // Multiply points based on card count
      if (cardCount >= 10 && cardCount <= 12) {
        playerPoints = cardCount * 2; // Double for 10-12 cards
        console.log(`📊 Player ${player.playerId} has ${cardCount} cards - points DOUBLED to ${playerPoints}`);
      } else if (cardCount === 13) {
        playerPoints = cardCount * 3; // Triple for 13 cards
        console.log(`📊 Player ${player.playerId} has ${cardCount} cards - points TRIPLED to ${playerPoints}`);
      } else {
        console.log(`📊 Player ${player.playerId} has ${cardCount} cards - points: ${playerPoints}`);
      }
      
      points[player.playerId] = playerPoints;
    }
  }
  
  console.log(`📊 Points calculation for room ${roomId}:`, points);
  return points;
}

/**
 * Check if a player has all 13 cards of a suit (3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2)
 * @param {Array} hand - The player's hand
 * @returns {Object|null} - Returns {suit, playerId} if found, null otherwise
 */
function checkCompleteSuit(hand) {
  const requiredRanks = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
  const suits = ["♠", "♥", "♦", "♣"];
  
  for (let suit of suits) {
    const suitCards = hand.filter(card => card.suit === suit);
    if (suitCards.length === 13) {
      // Check if all required ranks are present
      const ranks = suitCards.map(card => card.rank);
      const hasAllRanks = requiredRanks.every(rank => ranks.includes(rank));
      if (hasAllRanks) {
        return { suit, ranks };
      }
    }
  }
  return null;
}

function dealCards(roomId, rooms, startTurnTimerFn, broadcastToRoomFn, firstPlayerId = null) {
  const room = rooms[roomId];
  const numPlayers = room.players.length;

  const deck = createDeck();
  const handSize = 13;
  const totalCardsNeeded = numPlayers * handSize;

  if (totalCardsNeeded > deck.length) {
    console.error(`❌ Not enough cards for ${numPlayers} players`);
    broadcastToRoomFn(roomId, { type: "error", message: "Not enough cards to start the game" });
    return;
  }

  for (let i = 0; i < numPlayers; i++) {
    const hand = deck.slice(i * handSize, (i + 1) * handSize);
    room.players[i].hand = hand;

    if (room.players[i].ws) {
      room.players[i].ws.send(
        JSON.stringify({
          type: "hand",
          hand,
          player: room.players[i].playerId,
        })
      );
    }
  }

  // Check for complete suit (all 13 cards of a suit) - auto win game
  for (let player of room.players) {
    const completeSuit = checkCompleteSuit(player.hand);
    if (completeSuit) {
      console.log(`🎉 Player ${player.playerId} has complete suit ${completeSuit.suit} - AUTO WIN GAME!`);
      
      // Mark game as finished
      room.gameFinished = true;
      room.processingRoundEnd = true;
      
      // Set all other players to have maximum points (eliminated)
      room.playerPoints = room.playerPoints || {};
      for (let p of room.players) {
        if (p.playerId !== player.playerId) {
          room.playerPoints[p.playerId] = 30; // Set to elimination threshold
        } else {
          room.playerPoints[p.playerId] = 0; // Winner gets 0 points
        }
      }
      
      // Broadcast game over immediately
      setTimeout(() => {
        const winnerUserId = player.userId;
        const winnerPlayerId = player.playerId;
        
        handleGameFinish(roomId, room, winnerUserId, winnerPlayerId).catch(err => {
          console.error("Error handling game finish:", err);
        });
        
        // Check if this is a tournament match
        if (room.tournamentId) {
          const { handleMatchCompletion } = require('../websocket/tournamentHandler');
          handleMatchCompletion(room.tournamentId, roomId, winnerUserId || winnerPlayerId).catch(err => {
            console.error("Error handling tournament match completion:", err);
          });
        }
        
        // Save user statistics
        saveUserStatistics(room, winnerPlayerId, rooms).catch(err => {
          console.error("Error saving user statistics:", err);
        });
        
        // Clear player states
        const { clearPlayerState } = require('../websocket/disconnectHandler');
        for (const p of room.players) {
          if (p.userId && room.gameId) {
            clearPlayerState(p.userId, room.gameId).catch(err => {
              console.error(`Error clearing player state for user ${p.userId}:`, err);
            });
          }
        }
        
        broadcastToRoomFn(roomId, {
          type: 'gameOver',
          winner: winnerPlayerId,
          points: room.playerPoints,
          eliminatedPlayers: room.players.filter(p => p.playerId !== winnerPlayerId).map(p => p.playerId),
          completeSuitWin: true,
          winningSuit: completeSuit.suit,
          isTournament: !!room.tournamentId,
          tournamentId: room.tournamentId
        });
        
        // Reset after game
        setTimeout(() => {
          room.playerPoints = {};
          room.lastPlay = null;
          room.passCount = 0;
          room.currentPlayerIndex = 0;
          room.players.forEach(p => p.hand = []);
          room.processingRoundEnd = false;
        }, 5000);
      }, 1000);
      
      return; // Don't continue with normal game flow
    }
  }

  // Find player with lowest card to start first
  // Priority: 3♦ < 3♣ < 3♥ < 3♠ < absolute lowest card
  let playerWithLowestCard = null;
  let lowestCard = null;
  
  if (firstPlayerId === null) {
    const { compareCards } = require('./cardUtils');
    const suitOrder = ['♦', '♣', '♥', '♠']; // Lowest to highest suit
    
    // First, check for 3s in suit order (3♦, 3♣, 3♥, 3♠)
    for (let suit of suitOrder) {
      for (let player of room.players) {
        const threeCard = player.hand.find(card => card.rank === "3" && card.suit === suit);
        if (threeCard) {
          playerWithLowestCard = player;
          lowestCard = threeCard;
          console.log(`🎯 Found player ${player.playerId} with 3 of ${suit}`);
          break;
        }
      }
      if (playerWithLowestCard) break; // Found a 3, stop searching
    }
    
    // If no one has any 3, find the absolute lowest card across all players
    if (!playerWithLowestCard) {
      for (let player of room.players) {
        for (let card of player.hand) {
          if (lowestCard === null || compareCards(card, lowestCard) < 0) {
            lowestCard = card;
            playerWithLowestCard = player;
          }
        }
      }
      if (playerWithLowestCard) {
        console.log(`🎯 Found lowest card: ${lowestCard.rank}${lowestCard.suit} - Player ${playerWithLowestCard.playerId} will start`);
      }
    }
  }

  // Set current player index to winner if provided, or player with lowest card, otherwise start with player 0
  if (firstPlayerId !== null) {
    const winnerIndex = room.players.findIndex(p => p.playerId === firstPlayerId);
    if (winnerIndex !== -1) {
      room.currentPlayerIndex = winnerIndex;
      console.log(`🎯 Setting first player to winner ${firstPlayerId} (index ${winnerIndex})`);
    } else {
      room.currentPlayerIndex = 0;
      console.log(`⚠️ Winner ${firstPlayerId} not found, starting with player 0`);
    }
  } else if (playerWithLowestCard) {
    const lowestCardIndex = room.players.findIndex(p => p.playerId === playerWithLowestCard.playerId);
    room.currentPlayerIndex = lowestCardIndex;
    console.log(`🎯 Setting first player to ${playerWithLowestCard.playerId} (index ${lowestCardIndex}) - has lowest card ${lowestCard.rank}${lowestCard.suit}`);
  } else {
    room.currentPlayerIndex = 0;
    console.log(`⚠️ No player found with any card, starting with player 0`);
  }
  
  room.lastPlay = null;
  room.passCount = 0;

  if (startTurnTimerFn) {
    startTurnTimerFn(roomId);
  }

  broadcastToRoomFn(roomId, {
    type: "turn",
    player: room.players[room.currentPlayerIndex].playerId,
  });

  console.log(`🃏 Dealt ${handSize} cards to ${numPlayers} players in room ${roomId}`);
}

function checkRoundOver(roomId, rooms, clearTurnTimerFn, broadcastToRoomFn) {
  const room = rooms[roomId];
  if (!room) return false;

  // Check if any player has no cards left
  const winningPlayer = room.players.find(player => player.hand.length === 0);
  if (!winningPlayer) return false;

  // PROTECTION: Check if we're already processing this round end
  if (room.processingRoundEnd) {
    console.log(`⚠️ Round end already being processed for room ${roomId}, skipping`);
    return true;
  }
  
  room.processingRoundEnd = true;
  console.log(`🎉 Player ${winningPlayer.playerId} won the round with 0 cards left`);
  
  if (clearTurnTimerFn) {
    clearTurnTimerFn(roomId);
  }

  // Calculate points for this round
  const pointsUpdate = calculateRoundPoints(roomId, winningPlayer.playerId, rooms);
  
  // Update player points - ACCUMULATE
  room.playerPoints = room.playerPoints || {};
  console.log(`🔍 [BEFORE ACCUMULATION] Current points:`, room.playerPoints);
  
  for (const [playerId, points] of Object.entries(pointsUpdate)) {
    const playerIdNum = parseInt(playerId);
    const currentPoints = room.playerPoints[playerIdNum] || 0;
    room.playerPoints[playerIdNum] = currentPoints + points;
    
    console.log(`🔍 [ACCUMULATION] Player ${playerId}: ${currentPoints} + ${points} = ${room.playerPoints[playerIdNum]}`);
  }
  
  console.log(`🔍 [AFTER ACCUMULATION] Final points:`, room.playerPoints);
  
  // Check for eliminated players (30+ points)
  const eliminatedPlayers = [];
  let gameWinner = null;
  let minPoints = Infinity;
  
  for (const [playerId, totalPoints] of Object.entries(room.playerPoints)) {
    const playerIdNum = parseInt(playerId);
    
    if (totalPoints >= 30) {
      eliminatedPlayers.push(playerIdNum);
      console.log(`🚫 Player ${playerIdNum} ELIMINATED with ${totalPoints} points`);
    }
    
    // Find player with lowest points (winner)
    if (totalPoints < minPoints) {
      minPoints = totalPoints;
      gameWinner = playerIdNum;
    }
  }
  
  const isFinalGameOver = eliminatedPlayers.length > 0;
  
  console.log(`🏆 Round winner: ${winningPlayer.playerId}, Game winner: ${gameWinner}, Eliminated: ${eliminatedPlayers}, Final: ${isFinalGameOver}`);

  // Send SINGLE round win notification
  broadcastToRoomFn(roomId, {
    type: 'playerWonRound',
    winner: winningPlayer.playerId,
    cardsLeft: getPlayerCardCounts(room),
    points: pointsUpdate
  });
  
  // Schedule SINGLE round over event
  setTimeout(() => {
    broadcastToRoomFn(roomId, {
      type: 'roundOver',
      winner: winningPlayer.playerId,
      points: pointsUpdate,
      totalPoints: room.playerPoints,
      eliminatedPlayers: eliminatedPlayers,
      gameEnded: isFinalGameOver
    });
    
    // RESET the processing flag so next round can be processed
    room.processingRoundEnd = false;
    
    if (isFinalGameOver) {
      // FINAL GAME OVER
      console.log(`🎉 FINAL GAME OVER! Winner: ${gameWinner}`);
      
      // Convert playerId to userId for winner
      const winnerPlayer = room.players.find(p => p.playerId === gameWinner);
      const winnerUserId = winnerPlayer ? winnerPlayer.userId : null;
      
      // Handle buy-in logic and update game status
      handleGameFinish(roomId, room, winnerUserId, gameWinner).catch(err => {
        console.error("Error handling game finish:", err);
      });
      
      // Check if this is a tournament match
      if (room.tournamentId) {
        const { handleMatchCompletion } = require('../websocket/tournamentHandler');
        // For tournaments, pass userId
        handleMatchCompletion(room.tournamentId, roomId, winnerUserId || gameWinner).catch(err => {
          console.error("Error handling tournament match completion:", err);
        });
      }
      
      // Save user statistics for all players
      saveUserStatistics(room, gameWinner, rooms).catch(err => {
        console.error("Error saving user statistics:", err);
      });

      // Clear player states for all players
      const { clearPlayerState } = require('../websocket/disconnectHandler');
      for (const player of room.players) {
        if (player.userId && room.gameId) {
          clearPlayerState(player.userId, room.gameId).catch(err => {
            console.error(`Error clearing player state for user ${player.userId}:`, err);
          });
        }
      }
      
      setTimeout(() => {
        broadcastToRoomFn(roomId, {
          type: 'gameOver',
          winner: gameWinner,
          points: room.playerPoints,
          eliminatedPlayers: eliminatedPlayers,
          isTournament: !!room.tournamentId,
          tournamentId: room.tournamentId
        });
        
        // Reset after final game
        setTimeout(() => {
          room.playerPoints = {};
          room.lastPlay = null;
          room.passCount = 0;
          room.currentPlayerIndex = 0;
          room.players.forEach(p => p.hand = []);
          room.processingRoundEnd = false;
        }, 5000);
      }, 3000);
    } else {
      // Continue to next round
      console.log(`🔄 Starting next round in room ${roomId}`);
      // Clear lastPlay from previous round - new round starts fresh
      room.lastPlay = null;
      room.passCount = 0;
      console.log(`🧹 Cleared lastPlay and passCount for new round`);
      
      setTimeout(() => {
        broadcastToRoomFn(roomId, {
          type: 'newRoundStart',
          firstPlayer: winningPlayer.playerId
        });
        
        // Deal new cards with winner as first player
        setTimeout(() => {
          const { startTurnTimer } = require('../websocket/timerUtils');
          const boundStartTurnTimer = (roomId) => {
            startTurnTimer(roomId, rooms, broadcastToRoomFn, (roomId) => {
              const { autoPass } = require('../websocket/gameHandler');
              autoPass(roomId, rooms, broadcastToRoomFn, boundStartTurnTimer);
            });
          };
          dealCards(roomId, rooms, boundStartTurnTimer, broadcastToRoomFn, winningPlayer.playerId);
        }, 1000);
      }, 3000);
    }
  }, 2000);
  
  return true;
}

/**
 * Handle game finish: update status, save winner, handle buy-ins and platform charges
 * @param {string} roomId - The room ID (e.g., "room_1")
 * @param {Object} room - The room object
 * @param {number} winnerUserId - The user ID of the winner
 * @param {number} winnerPlayerId - The player ID of the winner (for statistics)
 */
async function handleGameFinish(roomId, room, winnerUserId, winnerPlayerId) {
  try {
    const gameId = room.gameId;
    if (!gameId) {
      console.log(`⚠️ No gameId found for room ${roomId}`);
      return;
    }

    const game = await db.games.findByPk(gameId);
    if (!game) {
      console.log(`⚠️ Game ${gameId} not found`);
      return;
    }

    // Check if all players left - don't reduce balance in this case
    if (room.allPlayersLeft) {
      console.log(`💰 Skipping balance reduction for game ${gameId} - all players left`);
      // Still update game status
      await game.update({
        status: 2, // 2 = finished
        end_time: new Date(),
        winner: winnerUserId
      });
      return;
    }

    const buyIn = room.buyIn || 0;
    const numPlayers = room.players.length;
    
    // Only process buy-in logic if buy-in > 0
    if (buyIn > 0 && winnerUserId) {
      // Convert buyIn from "k" format to actual amount (e.g., 50 -> 50000)
      const buyInAmount = buyIn * 1000;
      
      // Calculate total pot (sum of all buy-ins)
      const totalPot = buyInAmount * numPlayers;
      
      // Calculate platform fee (5% of total pot)
      const platformFee = totalPot * 0.05;
      
      // Calculate winner payout (total pot - platform fee)
      const winnerPayout = totalPot - platformFee;
      
      console.log(`💰 Game ${gameId} - Buy-in: ${buyInAmount}, Total Pot: ${totalPot}, Platform Fee: ${platformFee}, Winner Payout: ${winnerPayout}`);
      
      // Deduct buy-in from all players
      for (const player of room.players) {
        if (!player.userId) {
          console.log(`⚠️ Skipping buy-in deduction for player ${player.playerId} - no userId`);
          continue;
        }
        
        try {
          const user = await db.users.findByPk(player.userId);
          if (!user) {
            console.log(`⚠️ User ${player.userId} not found`);
            continue;
          }
          
          const currentBalance = parseFloat(user.account_balance) || 0;
          
          // Deduct buy-in from all players
          const newBalance = Math.max(0, currentBalance - buyInAmount);
          await user.update({
            account_balance: newBalance
          });
          
          console.log(`💸 Deducted ${buyInAmount} from user ${player.userId} (${user.username}). Balance: ${currentBalance} -> ${newBalance}`);
        } catch (error) {
          console.error(`❌ Error deducting buy-in from user ${player.userId}:`, error);
        }
      }
      
      // Add winner payout to winner
      try {
        const winnerUser = await db.users.findByPk(winnerUserId);
        if (winnerUser) {
          const currentBalance = parseFloat(winnerUser.account_balance) || 0;
          const newBalance = currentBalance + winnerPayout;
          await winnerUser.update({
            account_balance: newBalance
          });
          
          console.log(`🎉 Added ${winnerPayout} to winner ${winnerUserId} (${winnerUser.username}). Balance: ${currentBalance} -> ${newBalance}`);
        } else {
          console.log(`⚠️ Winner user ${winnerUserId} not found`);
        }
      } catch (error) {
        console.error(`❌ Error adding payout to winner ${winnerUserId}:`, error);
      }
      
      // Save platform charge record
      try {
        await db.platform_charges.create({
          game_id: gameId,
          total_pot: totalPot,
          platform_fee: platformFee,
          winner_payout: winnerPayout
        });
        console.log(`✅ Saved platform charge record for game ${gameId}`);
      } catch (error) {
        console.error(`❌ Error saving platform charge:`, error);
      }
    }
    
    // Update game status and winner
    await game.update({
      status: 2, // 2 = finished
      end_time: new Date(),
      winner: winnerUserId
    });
    
    console.log(`✅ Updated game ${gameId} status to finished with winner ${winnerUserId}`);
  } catch (error) {
    console.error(`❌ Error handling game finish for room ${roomId}:`, error);
    throw error;
  }
}

/**
 * Update game status to finished in database
 * @param {string} roomId - The room ID (e.g., "room_1")
 */
async function updateGameStatusToFinished(roomId, gameId = null) {
  try {
    let game;
    
    if (gameId) {
      // Use provided gameId
      game = await db.games.findByPk(gameId);
    } else {
      // Extract room_id from roomId string (e.g., "room_1" -> 1)
      const roomNumber = parseInt(roomId.replace(/\D/g, '')) || parseInt(roomId.replace('room_', '')) || null;
      
      if (!roomNumber) {
        console.log(`⚠️ Could not extract room_id from roomId: ${roomId}`);
        return;
      }

      // Find the most recent active game for this room_id
      game = await db.games.findOne({
        where: {
          room_id: roomNumber,
          status: 1 // active
        },
        order: [['start_time', 'DESC']] // Get the most recent active game
      });
    }

    if (game) {
      await game.update({
        status: 2, // 2 = finished
        end_time: new Date()
      });
      console.log(`✅ Updated game ${game.game_id} status to finished for room ${roomId}`);
    } else {
      console.log(`⚠️ No active game found for room ${roomId}`);
    }
  } catch (error) {
    console.error(`❌ Error updating game status to finished for room ${roomId}:`, error);
  }
}

/**
 * Save user statistics after a game ends
 * @param {Object} room - The game room object
 * @param {number} gameWinner - The player ID of the game winner
 * @param {Object} rooms - All rooms object
 */
async function saveUserStatistics(room, gameWinner, rooms) {
  try {
    const buyIn = room.buyIn || null;
    const gameType = room.gameType || 'mongol_13';
    
    // Process statistics for each player
    for (const player of room.players) {
      const userId = player.userId;
      if (!userId) {
        console.log(`⚠️ Skipping statistics for player ${player.playerId} - no userId`);
        continue;
      }
      
      const isWinner = player.playerId === gameWinner;
      
      // Find or create user statistics record
      const [userStat, created] = await db.user_statistics.findOrCreate({
        where: {
          user_id: userId,
          game_type: gameType,
          buy_in: buyIn
        },
        defaults: {
          user_id: userId,
          games_played: 0,
          games_won: 0,
          game_type: gameType,
          buy_in: buyIn,
          last_played_at: new Date()
        }
      });
      
      // Update statistics
      await userStat.update({
        games_played: (userStat.games_played || 0) + 1,
        games_won: isWinner ? (userStat.games_won || 0) + 1 : (userStat.games_won || 0),
        last_played_at: new Date()
      });
      
      console.log(`📊 Updated statistics for user ${userId}: games_played=${userStat.games_played + 1}, games_won=${isWinner ? (userStat.games_won || 0) + 1 : (userStat.games_won || 0)}, game_type=${gameType}, buy_in=${buyIn}`);
    }
  } catch (error) {
    console.error("Error in saveUserStatistics:", error);
    throw error;
  }
}

module.exports = {
  getPlayerCardCounts,
  calculatePoints,
  calculateRoundPoints,
  dealCards,
  checkRoundOver,
  saveUserStatistics,
  updateGameStatusToFinished,
  handleGameFinish
};

