/**
 * Numeric representation of the strength of a poker hand category.
 * Ordinal comparisons are valid (e.g. FullHouse > Flush).
 */
export var HandRank;
(function (HandRank) {
    HandRank[HandRank["HighCard"] = 0] = "HighCard";
    HandRank[HandRank["OnePair"] = 1] = "OnePair";
    HandRank[HandRank["TwoPair"] = 2] = "TwoPair";
    HandRank[HandRank["ThreeOfAKind"] = 3] = "ThreeOfAKind";
    HandRank[HandRank["Straight"] = 4] = "Straight";
    HandRank[HandRank["Flush"] = 5] = "Flush";
    HandRank[HandRank["FullHouse"] = 6] = "FullHouse";
    HandRank[HandRank["FourOfAKind"] = 7] = "FourOfAKind";
    HandRank[HandRank["StraightFlush"] = 8] = "StraightFlush";
})(HandRank || (HandRank = {}));
