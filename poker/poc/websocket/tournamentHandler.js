const db = require('../app/models');

// In-memory tournament state
const activeTournaments = new Map(); // tournamentId -> tournament data
const tournamentPlayers = new Map(); // tournamentId -> Set of player WebSocket connections

/**
 * Tournament configuration based on buy-in
 */
const TOURNAMENT_CONFIGS = {
  50: {
    name: 'Хурдан Турнир',
    maxPlayers: 8,
    prizePool: 200000, // 200k
    startDelay: 300, // 5 minutes
  },
  100: {
    name: 'Стандарт Турнир',
    maxPlayers: 16,
    prizePool: 500000, // 500k
    startDelay: 600, // 10 minutes
  },
  200: {
    name: 'VIP Турнир',
    maxPlayers: 32,
    prizePool: 1200000, // 1,200k
    startDelay: 900, // 15 minutes
  },
  500: {
    name: 'Мега Турнир',
    maxPlayers: 64,
    prizePool: 3000000, // 3,000k
    startDelay: 1200, // 20 minutes
  },
};

/**
 * Get or create tournament for a buy-in level
 */
async function getOrCreateTournament(buyIn) {
  const config = TOURNAMENT_CONFIGS[buyIn];
  if (!config) {
    throw new Error(`Invalid buy-in: ${buyIn}`);
  }

  // Check for existing waiting tournament
  for (const [tournamentId, tournament] of activeTournaments.entries()) {
    if (tournament.buyIn === buyIn && tournament.status === 0) {
      return tournament;
    }
  }

  // Create new tournament
  try {
    const tournamentRecord = await db.tournaments.create({
      tournament_name: config.name,
      buy_in: buyIn,
      prize_pool: 0, // Will be calculated from registrations
      max_players: config.maxPlayers,
      status: 0, // waiting
      game_type: 'mongol_13',
      registered_players: [],
    });

    const tournament = {
      tournamentId: tournamentRecord.tournament_id,
      name: config.name,
      buyIn: buyIn,
      prizePool: 0,
      maxPlayers: config.maxPlayers,
      status: 0, // 0=waiting, 1=starting, 2=active, 3=finished
      registeredPlayers: [],
      startDelay: config.startDelay,
      countdown: config.startDelay,
      startTimer: null,
      gameType: 'mongol_13',
      bracket: null,
      rooms: new Map(), // roomId -> room data
    };

    activeTournaments.set(tournament.tournamentId, tournament);
    tournamentPlayers.set(tournament.tournamentId, new Set());

    return tournament;
  } catch (error) {
    console.error('Error creating tournament:', error);
    throw error;
  }
}

/**
 * Register player for tournament
 */
async function registerPlayerForTournament(tournamentId, userId, username, buyIn, ws) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) {
    throw new Error('Tournament not found');
  }

  if (tournament.status !== 0) {
    throw new Error('Tournament is not accepting registrations');
  }

  // Check if already registered
  const existingPlayer = tournament.registeredPlayers.find(p => p.userId === userId);
  if (existingPlayer) {
    return { success: true, alreadyRegistered: true };
  }

  if (tournament.registeredPlayers.length >= tournament.maxPlayers) {
    throw new Error('Tournament is full');
  }

  // Validate user balance
  try {
    const user = await db.users.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const accountBalance = parseFloat(user.account_balance) || 0;
    const requiredAmount = buyIn * 1000; // Convert to actual amount

    if (accountBalance < requiredAmount) {
      throw new Error('Insufficient balance');
    }

    // Deduct buy-in from balance
    await user.update({
      account_balance: accountBalance - requiredAmount
    });

    // Add to prize pool
    tournament.prizePool += requiredAmount;

    // Register player
    const player = {
      userId: userId,
      username: username,
      buyIn: buyIn,
      registeredAt: new Date(),
      eliminated: false,
      position: null,
      prize: 0,
    };

    tournament.registeredPlayers.push(player);

    // Update database
    await db.tournaments.update(
      {
        registered_players: tournament.registeredPlayers,
        prize_pool: tournament.prizePool,
      },
      { where: { tournament_id: tournamentId } }
    );

    // Add WebSocket connection
    const players = tournamentPlayers.get(tournamentId);
    if (players) {
      players.add(ws);
    }

    // Start countdown if first player or enough players
    if (tournament.registeredPlayers.length === 1) {
      _startTournamentCountdown(tournament);
    } else if (tournament.registeredPlayers.length >= tournament.maxPlayers) {
      // Start immediately if full
      _startTournamentCountdown(tournament, 10); // 10 second countdown
    }

    // Broadcast update
    broadcastTournamentUpdate(tournamentId);

    return { success: true, tournament: tournament };
  } catch (error) {
    console.error('Error registering player:', error);
    throw error;
  }
}

/**
 * Start tournament countdown
 */
function _startTournamentCountdown(tournament, customDelay = null) {
  if (tournament.startTimer) {
    clearTimeout(tournament.startTimer);
  }

  const delay = customDelay || tournament.startDelay;
  tournament.countdown = delay;
  tournament.status = 1; // starting

  // Update countdown every second
  const countdownInterval = setInterval(() => {
    tournament.countdown--;
    broadcastTournamentUpdate(tournament.tournamentId);

    if (tournament.countdown <= 0) {
      clearInterval(countdownInterval);
      startTournament(tournament.tournamentId);
    }
  }, 1000);

  // Start tournament after delay
  tournament.startTimer = setTimeout(() => {
    startTournament(tournament.tournamentId);
  }, delay * 1000);
}

/**
 * Start tournament - create bracket and rooms
 */
async function startTournament(tournamentId) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament || tournament.status === 2) {
    return; // Already started or doesn't exist
  }

  tournament.status = 2; // active

  // Create bracket structure
  const players = tournament.registeredPlayers;
  const bracket = createBracket(players);
  tournament.bracket = bracket;

  // Create rooms for first round
  const firstRoundMatches = bracket.rounds[0]?.matches || [];
  const rooms = [];

  for (let i = 0; i < firstRoundMatches.length; i++) {
    const match = firstRoundMatches[i];
    const roomId = `tournament_${tournamentId}_round_1_match_${i + 1}`;
    
    // Get player user IDs
    const playerUserIds = match.players.map(p => {
      if (typeof p === 'object' && p.userId) {
        return p.userId;
      }
      return p;
    });
    
    // Create room in database
    try {
      const gameRecord = await db.games.create({
        room_id: parseInt(roomId.replace(/\D/g, '')) || i + 1,
        status: 1, // active
        players: playerUserIds,
        buy_in: tournament.buyIn,
        game_type: 'mongol_13',
        start_time: new Date(),
      });

      rooms.push({
        roomId: roomId,
        gameId: gameRecord.game_id,
        match: match,
        players: match.players,
      });

      tournament.rooms.set(roomId, {
        roomId: roomId,
        gameId: gameRecord.game_id,
        match: match,
        status: 'waiting', // waiting, active, finished
        winner: null,
      });
    } catch (error) {
      console.error('Error creating tournament room:', error);
    }
  }

  // Update tournament in database
  await db.tournaments.update(
    {
      status: 2,
      start_time: new Date(),
      bracket: bracket,
    },
    { where: { tournament_id: tournamentId } }
  );

  // Notify all players
  broadcastTournamentStarted(tournamentId, rooms);
}

/**
 * Create tournament bracket
 */
function createBracket(players) {
  const numPlayers = players.length;
  const rounds = [];
  let currentRoundPlayers = [...players];

  // Create rounds until we have a winner
  let roundNumber = 1;
  while (currentRoundPlayers.length > 1) {
    const matches = [];
    const nextRoundPlayers = [];

    // Pair up players
    for (let i = 0; i < currentRoundPlayers.length; i += 2) {
      if (i + 1 < currentRoundPlayers.length) {
        const matchId = `round_${roundNumber}_match_${Math.floor(i / 2) + 1}`;
        matches.push({
          matchId: matchId,
          players: [currentRoundPlayers[i], currentRoundPlayers[i + 1]],
          winner: null,
          status: 'pending',
        });
      } else {
        // Bye - player advances automatically (odd number of players)
        nextRoundPlayers.push(currentRoundPlayers[i]);
      }
    }

    rounds.push({
      roundNumber: roundNumber,
      matches: matches,
    });

    // For next round, we'll populate players after current round finishes
    // For now, just prepare structure
    if (matches.length > 0) {
      // Next round will have half the matches (or half + 1 if odd)
      const nextRoundSize = Math.ceil(matches.length / 2);
      currentRoundPlayers = new Array(nextRoundSize).fill(null);
    } else {
      break; // No more matches needed
    }
    
    roundNumber++;
  }

  return {
    rounds: rounds,
    finalWinner: null,
  };
}

/**
 * Handle tournament match completion
 */
async function handleMatchCompletion(tournamentId, roomId, winnerUserId) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) return;

  const room = tournament.rooms.get(roomId);
  if (!room) return;

  room.status = 'finished';
  room.winner = winnerUserId;

  // Update bracket
  const match = room.match;
  match.winner = winnerUserId;
  match.status = 'finished';

  // Mark loser as eliminated
  const loser = match.players.find(p => p.userId !== winnerUserId);
  if (loser) {
    const player = tournament.registeredPlayers.find(p => p.userId === loser.userId);
    if (player) {
      player.eliminated = true;
    }
  }

  // Check if round is complete
  const currentRound = tournament.bracket.rounds.find(r => 
    r.matches.some(m => m.matchId === match.matchId)
  );

  if (currentRound) {
    const allMatchesFinished = currentRound.matches.every(m => m.status === 'finished');
    
    if (allMatchesFinished) {
      // Advance to next round or finish tournament
      await advanceTournamentRound(tournamentId);
    }
  }
}

/**
 * Advance tournament to next round
 */
async function advanceTournamentRound(tournamentId) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) return;

  // Find current round (first round with unfinished matches)
  let currentRoundIndex = -1;
  for (let i = 0; i < tournament.bracket.rounds.length; i++) {
    const round = tournament.bracket.rounds[i];
    const hasUnfinished = round.matches.some(m => m.status !== 'finished');
    if (hasUnfinished) {
      currentRoundIndex = i;
      break;
    }
  }

  // Check if all matches in current round are finished
  if (currentRoundIndex >= 0) {
    const currentRound = tournament.bracket.rounds[currentRoundIndex];
    const allFinished = currentRound.matches.every(m => m.status === 'finished');
    
    if (!allFinished) {
      return; // Wait for all matches to finish
    }
  }

  // Check if this was the last round
  if (currentRoundIndex === -1 || currentRoundIndex >= tournament.bracket.rounds.length - 1) {
    // Tournament finished
    await finishTournament(tournamentId);
    return;
  }

  // Get winners from current round
  const currentRound = tournament.bracket.rounds[currentRoundIndex];
  const winners = currentRound.matches
    .map(m => {
      const winnerPlayer = tournament.registeredPlayers.find(p => p.userId === m.winner);
      return winnerPlayer;
    })
    .filter(p => p !== undefined);

  // Create next round matches
  const nextRoundIndex = currentRoundIndex + 1;
  if (nextRoundIndex >= tournament.bracket.rounds.length) {
    await finishTournament(tournamentId);
    return;
  }

  const nextRound = tournament.bracket.rounds[nextRoundIndex];
  const newRooms = [];
  let matchIndex = 0;

  // Pair up winners for next round
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      const matchId = `round_${nextRoundIndex + 1}_match_${matchIndex + 1}`;
      const match = {
        matchId: matchId,
        players: [winners[i], winners[i + 1]],
        winner: null,
        status: 'pending',
      };

      const roomId = `tournament_${tournamentId}_round_${nextRoundIndex + 1}_match_${matchIndex + 1}`;
      
      try {
        const gameRecord = await db.games.create({
          room_id: parseInt(roomId.replace(/\D/g, '')) || matchIndex + 1,
          status: 1,
          players: match.players.map(p => p.userId),
          buy_in: tournament.buyIn,
          game_type: 'mongol_13',
          start_time: new Date(),
        });

        tournament.rooms.set(roomId, {
          roomId: roomId,
          gameId: gameRecord.game_id,
          match: match,
          status: 'waiting',
          winner: null,
        });

        newRooms.push({
          roomId: roomId,
          gameId: gameRecord.game_id,
          match: match,
          players: match.players,
        });

        matchIndex++;
      } catch (error) {
        console.error('Error creating next round room:', error);
      }
    } else {
      // Odd number - bye for last player
      // This shouldn't happen in elimination, but handle it
      console.log('Odd number of winners in round advancement');
    }
  }

  // Update bracket
  nextRound.matches = newRooms.map(r => r.match);

  // Notify players of next round
  if (newRooms.length > 0) {
    broadcastTournamentRoundAdvanced(tournamentId, newRooms);
  } else {
    // No more matches - tournament finished
    await finishTournament(tournamentId);
  }
}

/**
 * Finish tournament and distribute prizes
 */
async function finishTournament(tournamentId) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) return;

  tournament.status = 3; // finished

  // Find final winner
  const finalRound = tournament.bracket.rounds[tournament.bracket.rounds.length - 1];
  const finalMatch = finalRound.matches[0];
  const winner = tournament.registeredPlayers.find(p => p.userId === finalMatch.winner);

  if (winner) {
    // Calculate prize distribution
    const prizeDistribution = calculatePrizeDistribution(tournament.prizePool, tournament.registeredPlayers.length);
    
    // Award prizes
    for (let i = 0; i < Math.min(prizeDistribution.length, tournament.registeredPlayers.length); i++) {
      const player = tournament.registeredPlayers[i];
      if (player.userId === winner.userId) {
        player.prize = prizeDistribution[0];
        player.position = 1;

        // Update user balance
        try {
          const user = await db.users.findByPk(player.userId);
          if (user) {
            const currentBalance = parseFloat(user.account_balance) || 0;
            await user.update({
              account_balance: currentBalance + prizeDistribution[0]
            });
          }
        } catch (error) {
          console.error('Error awarding prize:', error);
        }
      }
    }

    tournament.bracket.finalWinner = winner.userId;
  }

  // Update database
  await db.tournaments.update(
    {
      status: 3,
      end_time: new Date(),
      bracket: tournament.bracket,
      winners: tournament.registeredPlayers.filter(p => p.prize > 0),
    },
    { where: { tournament_id: tournamentId } }
  );

  // Broadcast tournament finished
  broadcastTournamentFinished(tournamentId, winner);

  // Clean up after delay
  setTimeout(() => {
    activeTournaments.delete(tournamentId);
    tournamentPlayers.delete(tournamentId);
  }, 60000); // 1 minute
}

/**
 * Calculate prize distribution
 */
function calculatePrizeDistribution(prizePool, numPlayers) {
  const distribution = [];
  
  if (numPlayers >= 8) {
    distribution.push(Math.floor(prizePool * 0.5)); // 1st place: 50%
    if (numPlayers >= 16) {
      distribution.push(Math.floor(prizePool * 0.3)); // 2nd place: 30%
      if (numPlayers >= 32) {
        distribution.push(Math.floor(prizePool * 0.15)); // 3rd place: 15%
        distribution.push(Math.floor(prizePool * 0.05)); // 4th place: 5%
      }
    }
  } else {
    distribution.push(Math.floor(prizePool * 0.7)); // 1st place: 70%
    distribution.push(Math.floor(prizePool * 0.3)); // 2nd place: 30%
  }

  return distribution;
}

/**
 * Broadcast tournament update to all registered players
 */
function broadcastTournamentUpdate(tournamentId) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) return;

  const players = tournamentPlayers.get(tournamentId);
  if (!players) return;

  const message = {
    type: 'tournamentUpdate',
    tournamentId: tournament.tournamentId,
    players: tournament.registeredPlayers.map(p => ({
      userId: p.userId,
      username: p.username,
    })),
    countdown: tournament.countdown,
    status: tournament.status,
    prizePool: tournament.prizePool,
    maxPlayers: tournament.maxPlayers,
  };

  players.forEach(ws => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Broadcast tournament started
 */
function broadcastTournamentStarted(tournamentId, rooms) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) return;

  const players = tournamentPlayers.get(tournamentId);
  if (!players) return;

  const message = {
    type: 'tournamentStarted',
    tournamentId: tournament.tournamentId,
    bracket: tournament.bracket,
    rooms: rooms.map(r => ({
      roomId: r.roomId,
      players: r.players.map(p => ({ userId: p.userId, username: p.username })),
    })),
  };

  players.forEach(ws => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Broadcast round advanced
 */
function broadcastTournamentRoundAdvanced(tournamentId, rooms) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) return;

  const players = tournamentPlayers.get(tournamentId);
  if (!players) return;

  const message = {
    type: 'tournamentRoundAdvanced',
    tournamentId: tournament.tournamentId,
    rooms: rooms.map(r => ({
      roomId: r.roomId,
      players: r.players.map(p => ({ userId: p.userId, username: p.username })),
    })),
  };

  players.forEach(ws => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Broadcast tournament finished
 */
function broadcastTournamentFinished(tournamentId, winner) {
  const tournament = activeTournaments.get(tournamentId);
  if (!tournament) return;

  const players = tournamentPlayers.get(tournamentId);
  if (!players) return;

  const message = {
    type: 'tournamentFinished',
    tournamentId: tournament.tournamentId,
    winner: winner ? {
      userId: winner.userId,
      username: winner.username,
      prize: winner.prize,
    } : null,
    prizePool: tournament.prizePool,
  };

  players.forEach(ws => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Handle tournament WebSocket messages
 */
function handleTournamentMessage(msg, ws, userId) {
  switch (msg.type) {
    case 'registerTournament': {
      const { buyIn, username, tournamentType } = msg;
      
      getOrCreateTournament(buyIn)
        .then(tournament => {
          return registerPlayerForTournament(
            tournament.tournamentId,
            userId,
            username || 'Player',
            buyIn,
            ws
          );
        })
        .then(result => {
          if (result.success) {
            ws.send(JSON.stringify({
              type: 'tournamentRegistered',
              tournamentId: result.tournament.tournamentId,
              tournament: result.tournament,
            }));
          }
        })
        .catch(error => {
          ws.send(JSON.stringify({
            type: 'tournamentError',
            message: error.message,
          }));
        });
      return true;
    }

    case 'getTournamentStatus': {
      // Find tournament user is registered in
      for (const [tournamentId, tournament] of activeTournaments.entries()) {
        const player = tournament.registeredPlayers.find(p => p.userId === userId);
        if (player) {
          broadcastTournamentUpdate(tournamentId);
          return true;
        }
      }
      return false;
    }

    default:
      return false;
  }
}

module.exports = {
  handleTournamentMessage,
  getOrCreateTournament,
  registerPlayerForTournament,
  startTournament,
  handleMatchCompletion,
  finishTournament,
  broadcastTournamentUpdate,
};

