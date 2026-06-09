/**
 * Numeric representation of the strength of a poker hand category.
 * Ordinal comparisons are valid (e.g. FullHouse > Flush).
 */
export enum HandRank {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}
