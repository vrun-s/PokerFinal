import { Card } from "./Card.js";
import { HandRank } from "./HandRank.js";

/**
 * Represents the classification details of a 5-card hand.
 */
export interface Classification {
  readonly rank: HandRank;
  /**
   * The cards forming the active hand (e.g. the pair, the three of a kind).
   */
  readonly primaryCards: readonly Card[];
  /**
   * Remaining kicker cards used for tiebreaks, sorted descending by rank.
   */
  readonly kickers: readonly Card[];
}
