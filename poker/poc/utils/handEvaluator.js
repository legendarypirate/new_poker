const { cardValue, suitOrder } = require('./cardUtils');

// FIXED: Check for straights including special cases A-2-3-4-5 and 2-3-4-5-6
function checkStraight(cards) {
  if (cards.length !== 5) return false;
  
  // Get unique ranks
  const ranks = [...new Set(cards.map(c => c.rank))];
  if (ranks.length !== 5) return false;
  
  // Check for special case: A-2-3-4-5 (wheel)
  if (ranks.includes('A') && ranks.includes('2') && ranks.includes('3') && 
      ranks.includes('4') && ranks.includes('5')) {
    return true;
  }
  
  // Check for special case: 2-3-4-5-6
  if (ranks.includes('2') && ranks.includes('3') && ranks.includes('4') && 
      ranks.includes('5') && ranks.includes('6')) {
    return true;
  }
  
  // Check for normal consecutive straights
  const sortedCards = [...cards].sort((a, b) => cardValue(a.rank) - cardValue(b.rank));
  for (let i = 0; i < sortedCards.length - 1; i++) {
    if (cardValue(sortedCards[i].rank) + 1 !== cardValue(sortedCards[i + 1].rank)) {
      return false;
    }
  }
  return true;
}

function checkFlush(cards) {
  const firstSuit = cards[0].suit;
  return cards.every(card => card.suit === firstSuit);
}

function checkFullHouse(cards) {
  const ranks = cards.map(card => card.rank);
  const rankCounts = {};
  for (const rank of ranks) {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  }
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  return counts[0] === 3 && counts[1] === 2;
}

function checkFourOfAKind(cards) {
  const ranks = cards.map(card => card.rank);
  const rankCounts = {};
  for (const rank of ranks) {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  }
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  return counts[0] === 4;
}

function getTwoPairValue(cards) {
  const ranks = cards.map(card => card.rank);
  const rankCounts = {};
  for (const rank of ranks) {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  }
  
  const pairs = [];
  const suitsForPairs = {};
  
  // Find pairs and their highest suits
  for (const card of cards) {
    if (rankCounts[card.rank] === 2) {
      if (!suitsForPairs[card.rank]) {
        suitsForPairs[card.rank] = [];
      }
      suitsForPairs[card.rank].push(suitOrder[card.suit] || 0);
    }
  }
  
  // Get the highest suit for each pair
  for (const [rank, suits] of Object.entries(suitsForPairs)) {
    const highestSuit = Math.max(...suits);
    pairs.push({
      rankValue: cardValue(rank),
      suitValue: highestSuit
    });
  }
  
  // Sort pairs by rank then by suit
  pairs.sort((a, b) => {
    if (b.rankValue !== a.rankValue) {
      return b.rankValue - a.rankValue;
    }
    return b.suitValue - a.suitValue;
  });
  
  if (pairs.length >= 2) {
    return pairs[0].rankValue * 100 + pairs[0].suitValue * 10 + pairs[1].rankValue;
  }
  
  return 0;
}

function evaluateFiveCardHand(cards) {
  const sortedCards = [...cards].sort((a, b) => cardValue(a.rank) - cardValue(b.rank));
  
  const isStraight = checkStraight(sortedCards);
  const isFlush = checkFlush(cards);
  const isFullHouse = checkFullHouse(cards);
  const isFourOfAKind = checkFourOfAKind(cards);
  
  if (isStraight && isFlush) {
    // Check for Royal Flush (10-J-Q-K-A)
    if (sortedCards[0].rank === '10' && sortedCards[4].rank === 'A') {
      return { rank: 'RoyalFlush', value: 1000, cards: cards };
    }
    return { rank: 'StraightFlush', value: 900 + cardValue(sortedCards[4].rank), cards: cards };
  }
  
  if (isFourOfAKind) {
    // For four of a kind, find the rank that appears 4 times
    const rankCounts = {};
    for (const card of cards) {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    }
    let fourOfAKindRank = null;
    for (const [rank, count] of Object.entries(rankCounts)) {
      if (count === 4) {
        fourOfAKindRank = rank;
        break;
      }
    }
    // Four of a kind value: 800 + rank value * 100
    // This ensures it always beats Full House (700 + threeValue * 100 + pairValue)
    // Example: 8 8 8 8 4 = 800 + 8*100 = 1600, which beats 7 7 7 3 3 = 700 + 7*100 + 3 = 1403
    return { rank: 'FourOfAKind', value: 800 + cardValue(fourOfAKindRank) * 100, cards: cards };
  }
  
  if (isFullHouse) {
    // For full house, find the three-of-a-kind rank (the rank that appears 3 times)
    const rankCounts = {};
    for (const card of cards) {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    }
    let threeOfAKindRank = null;
    let pairRank = null;
    for (const [rank, count] of Object.entries(rankCounts)) {
      if (count === 3) {
        threeOfAKindRank = rank;
      } else if (count === 2) {
        pairRank = rank;
      }
    }
    // Full house value: 700 + threeOfAKind value * 100 + pair value
    // This ensures three-of-a-kind is compared first, then pair
    const threeValue = cardValue(threeOfAKindRank);
    const pairValue = cardValue(pairRank);
    return { rank: 'FullHouse', value: 700 + threeValue * 100 + pairValue, cards: cards };
  }
  
  if (isFlush) {
    return { rank: 'Flush', value: 600 + cardValue(sortedCards[4].rank), cards: cards };
  }
  
  if (isStraight) {
    // Calculate straight value based on the highest card in the straight sequence
    // Order: A-2-3-4-5 (lowest, value 5) < 2-3-4-5-6 (value 6) < 3-4-5-6-7 (value 7) < ... < 10-J-Q-K-A (highest, value 14)
    let highCardValue;
    
    const ranks = sortedCards.map(c => c.rank);
    
    // Check for A-2-3-4-5 (wheel - lowest straight)
    if (ranks.includes('A') && ranks.includes('2') && ranks.includes('3') && 
        ranks.includes('4') && ranks.includes('5') && !ranks.includes('6')) {
      highCardValue = cardValue('5'); // A-2-3-4-5 is valued at 5 (lowest)
    } 
    // Check for 10-J-Q-K-A (highest straight)
    else if (ranks.includes('10') && ranks.includes('J') && ranks.includes('Q') && 
             ranks.includes('K') && ranks.includes('A') && !ranks.includes('2')) {
      highCardValue = cardValue('A'); // 10-J-Q-K-A is valued at A (14, highest)
    }
    // For all other straights, find the actual highest card in the sequence
    // Note: '2' has cardValue 15, but in a straight 2-3-4-5-6, the high card is 6, not 2
    else {
      // For straights containing '2', find the highest non-2 card
      // For straights without '2', use the highest card normally
      if (ranks.includes('2')) {
        // Straight contains 2, so find highest non-2 card (e.g., 2-3-4-5-6 -> 6)
        const nonTwoCards = sortedCards.filter(c => c.rank !== '2');
        // After filtering, the last card is the highest
        highCardValue = cardValue(nonTwoCards[nonTwoCards.length - 1].rank);
      } else {
        // No 2 in straight, highest card is the last one after sorting
        highCardValue = cardValue(sortedCards[4].rank);
      }
    }
    
    return { rank: 'Straight', value: 500 + highCardValue, cards: cards };
  }
  
  // BLOCK all other 5-card combinations including TwoPair
  return { rank: 'Invalid', value: 0 };
}

function evaluateHand(cards) {
  if (!cards || cards.length === 0) return { rank: 'Invalid', value: 0 };
  
  // Sort cards by rank and suit for consistent evaluation
  const sortedCards = [...cards].sort((a, b) => {
    const valueA = cardValue(a.rank);
    const valueB = cardValue(b.rank);
    if (valueA !== valueB) {
      return valueA - valueB;
    }
    return (suitOrder[a.suit] || 0) - (suitOrder[b.suit] || 0);
  });
  
  // STRICT VALIDATION - Only allow specific combinations
  switch (cards.length) {
    case 1:
      return { 
        rank: 'Single', 
        value: cardValue(sortedCards[0].rank) * 100 + (suitOrder[sortedCards[0].suit] || 0),
        cards: sortedCards 
      };
      
    case 2:
      // Must be a pair
      if (sortedCards[0].rank === sortedCards[1].rank) {
        const pairValue = cardValue(sortedCards[0].rank) * 100;
        const highestSuit = Math.max(suitOrder[sortedCards[0].suit] || 0, suitOrder[sortedCards[1].suit] || 0);
        return { 
          rank: 'Pair', 
          value: pairValue + highestSuit,
          cards: sortedCards 
        };
      }
      break;
      
    case 3:
      // Must be three of a kind
      if (sortedCards[0].rank === sortedCards[1].rank && sortedCards[1].rank === sortedCards[2].rank) {
        return { 
          rank: 'ThreeOfAKind', 
          value: cardValue(sortedCards[0].rank), 
          cards: sortedCards 
        };
      }
      break;
      
    case 4:
      // Must be two pair (2+2) or four of a kind
      const ranks4 = sortedCards.map(card => card.rank);
      const rankCounts4 = {};
      for (const rank of ranks4) {
        rankCounts4[rank] = (rankCounts4[rank] || 0) + 1;
      }
      const counts4 = Object.values(rankCounts4).sort((a, b) => b - a);
      
      if (counts4[0] === 2 && counts4[1] === 2) {
        return { 
          rank: 'TwoPair', 
          value: 300 + getTwoPairValue(sortedCards), 
          cards: sortedCards 
        };
      } else if (counts4[0] === 4) {
        // For four of a kind (4 cards), find the rank that appears 4 times
        const fourOfAKindRank = sortedCards[0].rank; // All 4 cards have the same rank
        // Four of a kind value: 800 + rank value * 100 (consistent with 5-card evaluation)
        return { 
          rank: 'FourOfAKind', 
          value: 800 + cardValue(fourOfAKindRank) * 100, 
          cards: sortedCards 
        };
      }
      break;
      
    case 5:
      // Only allow specific 5-card combinations
      return evaluateFiveCardHand(sortedCards);
  }
  
  return { rank: 'Invalid', value: 0 };
}

function canPlayCards(playedCards, lastPlay) {
  if (!lastPlay) return true; // First play of the round
  
  // Basic validation - same number of cards
  if (playedCards.length !== lastPlay.cards.length) {
    return false;
  }
  
  const playedHand = evaluateHand(playedCards);
  const lastHand = evaluateHand(lastPlay.cards);
  
  // Check if played hand is valid
  if (playedHand.rank === 'Invalid') {
    return false;
  }
  
  // Compare hand values
  // Hand value hierarchy (for 5-card hands):
  // RoyalFlush: 1000
  // StraightFlush: 900+
  // FourOfAKind: 800+
  // FullHouse: 700+
  // Flush: 600+
  // Straight: 500+
  // Higher value always beats lower value
  console.log(`🔍 Comparing hands: Played=${playedHand.rank} (${playedHand.value}) vs Last=${lastHand.rank} (${lastHand.value})`);
  
  // If values are different, higher value wins
  if (playedHand.value !== lastHand.value) {
    const canBeat = playedHand.value > lastHand.value;
    if (!canBeat) {
      console.log(`❌ Cannot beat: ${playedHand.rank} (${playedHand.value}) <= ${lastHand.rank} (${lastHand.value})`);
    }
    return canBeat;
  }
  
  // If values are the same and both are straights, compare by suit of the highest card
  if (playedHand.rank === 'Straight' && lastHand.rank === 'Straight') {
    // Get the highest card from each straight (the card that determines the straight value)
    const getHighestCardInStraight = (cards) => {
      const sortedCards = [...cards].sort((a, b) => cardValue(a.rank) - cardValue(b.rank));
      const ranks = sortedCards.map(c => c.rank);
      
      // Check for A-2-3-4-5 (wheel - highest card is 5)
      if (ranks.includes('A') && ranks.includes('2') && ranks.includes('3') && 
          ranks.includes('4') && ranks.includes('5') && !ranks.includes('6')) {
        return sortedCards.find(c => c.rank === '5');
      }
      // Check for 10-J-Q-K-A (highest card is A)
      else if (ranks.includes('10') && ranks.includes('J') && ranks.includes('Q') && 
               ranks.includes('K') && ranks.includes('A') && !ranks.includes('2')) {
        return sortedCards.find(c => c.rank === 'A');
      }
      // For straights containing '2', find the highest non-2 card
      else if (ranks.includes('2')) {
        const nonTwoCards = sortedCards.filter(c => c.rank !== '2');
        return nonTwoCards[nonTwoCards.length - 1];
      }
      // For other straights, the highest card is the last one after sorting
      else {
        return sortedCards[4];
      }
    };
    
    const lastHighestCard = getHighestCardInStraight(lastHand.cards);
    const playedHighestCard = getHighestCardInStraight(playedCards);
    
    const lastHighestSuit = suitOrder[lastHighestCard.suit] || 0;
    const playedHighestSuit = suitOrder[playedHighestCard.suit] || 0;
    
    const canBeat = playedHighestSuit > lastHighestSuit;
    console.log(`🔍 Same straight value, comparing highest card suits: Played ${playedHighestCard.rank}${playedHighestCard.suit} (${playedHighestSuit}) vs Last ${lastHighestCard.rank}${lastHighestCard.suit} (${lastHighestSuit}), canBeat=${canBeat}`);
    return canBeat;
  }
  
  // For other hand types with same value, compare by highest suit of highest rank
  const lastMaxRank = Math.max(...lastHand.cards.map(c => cardValue(c.rank)));
  const playedMaxRank = Math.max(...playedCards.map(c => cardValue(c.rank)));
  
  if (playedMaxRank !== lastMaxRank) {
    return playedMaxRank > lastMaxRank;
  }
  
  // Same rank, compare suits
  const lastMaxSuit = Math.max(...lastHand.cards.filter(c => cardValue(c.rank) === lastMaxRank).map(c => suitOrder[c.suit] || 0));
  const playedMaxSuit = Math.max(...playedCards.filter(c => cardValue(c.rank) === playedMaxRank).map(c => suitOrder[c.suit] || 0));
  return playedMaxSuit > lastMaxSuit;
}

module.exports = {
  checkStraight,
  checkFlush,
  checkFullHouse,
  checkFourOfAKind,
  evaluateHand,
  evaluateFiveCardHand,
  canPlayCards
};

