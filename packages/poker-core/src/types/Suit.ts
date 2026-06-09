export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;

export type Suit = typeof SUITS[number];
