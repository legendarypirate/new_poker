/**
 * Standard 52-card deck for Texas Hold'em.
 * Ranks: 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A (no jokers).
 * Suits: ♠ ♥ ♦ ♣
 */

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Texas rank value: 2=2, 3=3, ... K=13, A=14 */
function texasRankValue(rank) {
  const v = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  return v[rank] || 0;
}

function createTexasDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return shuffle(deck);
}

function shuffle(deck) {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

module.exports = {
  SUITS,
  RANKS,
  texasRankValue,
  createTexasDeck,
  shuffle,
};
