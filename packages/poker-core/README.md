# poker-core

The core domain logic, data models, and hand evaluation engine for a production-grade real-time Texas Hold'em poker platform.

## Architecture Philosophy

`poker-core` is built following clean architecture and domain-driven design principles:

1. **Strict Separation of Concerns**: We separate domain types (`Card`, `Suit`, `Rank`, `Hand`, `Deck`, `HandRank`, `Classification`, `BestHand`, `CompareResult`) from behavioral implementations.
2. **Pure Functions & Immutability**: All functions are pure. They do not mutate inputs, have no side effects, and return new objects. The `Deck` and `Hand` cards are represented as `readonly` arrays.
3. **Deterministic & Replayable**: Operations like `shuffleDeck` support custom `PRNG` functions, facilitating fully reproducible game state replays and deterministic testing.
4. **Infrastructure & Framework Agnostic**: `poker-core` does not rely on web frameworks, database ORMs, or socket frameworks. It runs anywhere Node.js or modern JS runtimes are supported (browsers, serverless, edge runtimes).

## Installation

```bash
npm install @poker-platform/poker-core
```

## Usage

### 1. Deck Operations

```typescript
import { createDeck, shuffleDeck, dealCards } from "@poker-platform/poker-core";

// Create a deterministic sorted deck of 52 cards
const initialDeck = createDeck();

// Shuffle the deck (returns a new array)
const shuffledDeck = shuffleDeck(initialDeck);

// Deal cards (returns { dealt, remaining })
const { dealt, remaining } = dealCards(shuffledDeck, 2);

console.log("Dealt cards:", dealt);
console.log("Remaining cards count:", remaining.length);
```

### 2. Card Serialization & Parsing

Cards can be serialized into compact 2-character strings (useful for Redis keys, network payloads) and parsed back:

```typescript
import { serializeCard, parseCard } from "@poker-platform/poker-core";

const card = { rank: "T", suit: "hearts" } as const;

const serialized = serializeCard(card); // 'Th'
const parsed = parseCard("Th"); // { rank: 'T', suit: 'hearts' }
```

### 3. Hand Evaluation & Comparison

Evaluate and rank 5 to 7 cards (combination of hole cards and community board) to find the best 5-card combination and compare strengths:

```typescript
import { bestHand, compareHands, parseCard } from "@poker-platform/poker-core";

const board = ["As", "Ks", "Qs", "Js", "Ts"].map(parseCard);
const holeA = ["2h", "3d"].map(parseCard);
const holeB = ["Ac", "Kh"].map(parseCard);

// Player A's best hand selected from 7 cards
const evalA = bestHand([...board, ...holeA]); // Royal Flush (board play)

// Player B's best hand selected from 7 cards
const evalB = bestHand([...board, ...holeB]); // Royal Flush (board play)

const result = compareHands(evalA, evalB); // { result: 'tie', winners: [evalA, evalB] }
```

### 4. Game State Machine

A pure-functional Texas Hold'em state engine that processes actions, tracks turns, compiles community cards, and handles side pots/showdown payouts:

```typescript
import { startHand, transition, distributePayouts } from "@poker-platform/poker-core";

// 1. Initialize a new hand with players and blind config
const seats = [
  { id: "P0", name: "Alice", stack: 1000 },
  { id: "P1", name: "Bob",   stack: 1000 },
  { id: "P2", name: "Carol", stack: 1000 },
];
const config = { smallBlind: 10, bigBlind: 20, dealerIndex: 0 };
let state = startHand(config, seats);

// 2. Transition state by dispatching player actions
// Preflop: Alice calls, Bob calls, Carol checks
let res = transition(state, { type: "call", playerId: "P0" });
if (res.ok) state = res.value;

res = transition(state, { type: "call", playerId: "P1" });
if (res.ok) state = res.value;

res = transition(state, { type: "check", playerId: "P2" });
if (res.ok) state = res.value; // Advances automatically to Flop!

console.log("Round:", state.currentRound); // 'Flop'
console.log("Community board:", state.communityCards); // 3 board cards

// 3. Compute final showdown payouts
if (state.currentRound === "Showdown") {
  const result = distributePayouts(state.pots, state.players, state.communityCards, config.dealerIndex);
  console.log("Payouts:", result.payouts);
}
```

## Custom Errors

When invalid operations are attempted, `poker-core` throws a custom `PokerError` with programmatically queryable codes:

```typescript
import { PokerError, dealCards } from "@poker-platform/poker-core";

try {
  dealCards(deck, 100);
} catch (error) {
  if (error instanceof PokerError) {
    console.log("Error code:", error.code); // e.g., 'INSUFFICIENT_CARDS'
  }
}
```
