import { Suit } from "./Suit.js";
import { Rank } from "./Rank.js";

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}
