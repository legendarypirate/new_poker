/**
 * Texas Hold'em hand evaluator.
 * Evaluates best 5-card hand from 2 hole cards + 5 community cards.
 * Ranks: HighCard, Pair, TwoPair, ThreeOfAKind, Straight, Flush, FullHouse, FourOfAKind, StraightFlush, RoyalFlush.
 * Ace is high (14) and can be low in wheel A-2-3-4-5.
 */
const { texasRankValue } = require('./texasCardUtils');

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function getRankCounts(cards) {
  const counts = {};
  for (const c of cards) {
    counts[c.rank] = (counts[c.rank] || 0) + 1;
  }
  return counts;
}

function isFlush(cards) {
  if (cards.length < 5) return false;
  const suit = cards[0].suit;
  return cards.every(c => c.suit === suit);
}

function isStraight(cards) {
  if (cards.length !== 5) return false;
  const values = [...new Set(cards.map(c => texasRankValue(c.rank)))].sort((a, b) => a - b);
  if (values.length !== 5) return false;
  // Wheel: A-2-3-4-5
  if (values[0] === 2 && values[1] === 3 && values[2] === 4 && values[3] === 5 && values[4] === 14) {
    return { isStraight: true, high: 5 };
  }
  for (let i = 0; i < 4; i++) {
    if (values[i + 1] - values[i] !== 1) return false;
  }
  return { isStraight: true, high: values[4] };
}

function evaluateFiveCards(cards) {
  if (cards.length !== 5) return null;
  const sorted = [...cards].sort((a, b) => texasRankValue(a.rank) - texasRankValue(b.rank));
  const counts = getRankCounts(cards);
  const countValues = Object.values(counts).sort((a, b) => b - a);
  const flush = isFlush(cards);
  const straightResult = isStraight(cards);

  const kickers = sorted.map(c => texasRankValue(c.rank)).reverse();

  // Straight flush / Royal flush
  if (flush && straightResult) {
    const isRoyal = straightResult.high === 14 && sorted.some(c => c.rank === '10');
    return { rank: isRoyal ? 'RoyalFlush' : 'StraightFlush', value: (isRoyal ? 10 : 9) * 1e10 + straightResult.high, kickers, cards: sorted };
  }

  // Four of a kind
  if (countValues[0] === 4) {
    const quad = Object.entries(counts).find(([, n]) => n === 4)[0];
    const kick = Object.entries(counts).find(([, n]) => n === 1)[0];
    return { rank: 'FourOfAKind', value: 8 * 1e10 + texasRankValue(quad) * 1e6 + texasRankValue(kick), kickers, cards: sorted };
  }

  // Full house
  if (countValues[0] === 3 && countValues[1] === 2) {
    const trip = Object.entries(counts).find(([, n]) => n === 3)[0];
    const pair = Object.entries(counts).find(([, n]) => n === 2)[0];
    return { rank: 'FullHouse', value: 7 * 1e10 + texasRankValue(trip) * 1e6 + texasRankValue(pair), kickers, cards: sorted };
  }

  // Flush
  if (flush) {
    const high = texasRankValue(sorted[4].rank);
    return { rank: 'Flush', value: 6 * 1e10 + high * 1e6 + kickers.slice(0, 5).reduce((a, k, i) => a + k * Math.pow(14, 4 - i), 0), kickers, cards: sorted };
  }

  // Straight
  if (straightResult) {
    return { rank: 'Straight', value: 5 * 1e10 + straightResult.high * 1e6, kickers, cards: sorted };
  }

  // Three of a kind
  if (countValues[0] === 3) {
    const trip = Object.entries(counts).find(([, n]) => n === 3)[0];
    const rest = Object.entries(counts).filter(([, n]) => n !== 3).map(([r]) => texasRankValue(r)).sort((a, b) => b - a);
    return { rank: 'ThreeOfAKind', value: 4 * 1e10 + texasRankValue(trip) * 1e6 + (rest[0] || 0) * 1e3 + (rest[1] || 0), kickers, cards: sorted };
  }

  // Two pair
  if (countValues[0] === 2 && countValues[1] === 2) {
    const pairs = Object.entries(counts).filter(([, n]) => n === 2).map(([r]) => texasRankValue(r)).sort((a, b) => b - a);
    const kick = Object.entries(counts).find(([, n]) => n === 1);
    return { rank: 'TwoPair', value: 3 * 1e10 + pairs[0] * 1e6 + pairs[1] * 1e3 + (kick ? texasRankValue(kick[0]) : 0), kickers, cards: sorted };
  }

  // Pair
  if (countValues[0] === 2) {
    const pairRank = Object.entries(counts).find(([, n]) => n === 2)[0];
    const rest = Object.entries(counts).filter(([, n]) => n === 1).map(([r]) => texasRankValue(r)).sort((a, b) => b - a);
    let v = 2 * 1e10 + texasRankValue(pairRank) * 1e6;
    rest.slice(0, 3).forEach((k, i) => { v += k * Math.pow(14, 2 - i); });
    return { rank: 'Pair', value: v, kickers, cards: sorted };
  }

  // High card
  const v = 1 * 1e10 + kickers.slice(0, 5).reduce((a, k, i) => a + k * Math.pow(14, 4 - i), 0);
  return { rank: 'HighCard', value: v, kickers, cards: sorted };
}

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = combinations(arr.slice(i + 1), k - 1);
    for (const c of rest) {
      result.push([arr[i], ...c]);
    }
  }
  return result;
}

/** Best 5-card hand from 7 cards (2 hole + 5 community) */
function bestHand(holeCards, communityCards) {
  const all = [...holeCards, ...communityCards];
  if (all.length < 5) return null;
  const fives = all.length === 5 ? [all] : combinations(all, 5);
  let best = null;
  for (const five of fives) {
    const ev = evaluateFiveCards(five);
    if (ev && (!best || ev.value > best.value)) best = ev;
  }
  return best;
}

module.exports = {
  evaluateFiveCards,
  bestHand,
  RANK_ORDER,
};
