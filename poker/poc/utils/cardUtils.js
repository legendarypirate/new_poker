const suitOrder = {
  '♠': 4, // Spades (highest)
  '♥': 3, // Hearts
  '♣': 2, // Clubs
  '♦': 1  // Diamonds (lowest)
};

function cardValue(rank) {
  const values = {
    '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15,
  };
  return values[rank] || 0;
}

function compareCards(cardA, cardB) {
  const valueA = cardValue(cardA.rank);
  const valueB = cardValue(cardB.rank);
  
  // First compare by rank
  if (valueA !== valueB) {
    return valueA - valueB;
  }
  
  // If ranks are equal, compare by suit
  return (suitOrder[cardA.suit] || 0) - (suitOrder[cardB.suit] || 0);
}

function createDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
  let deck = [];
  for (let suit of suits) {
    for (let rank of ranks) {
      deck.push({ rank, suit });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function removeCardsFromHand(hand, cards) {
  return hand.filter(
    (h) => !cards.some((c) => c.rank === h.rank && c.suit === h.suit)
  );
}

module.exports = {
  suitOrder,
  cardValue,
  compareCards,
  createDeck,
  removeCardsFromHand
};

