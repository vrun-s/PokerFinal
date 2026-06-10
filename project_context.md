# Project Context: poker-core

This document serves as the single source of truth for the design decisions, architecture, folder structure, strict API contracts, and implementation details of the `poker-core` package. It is designed to get any AI agent or developer up to speed on the codebase instantly.

---

## 1. Architectural Philosophy & Constraints

- **Pure Functions & Immutability**: All logic (deck creation, shuffling, dealing, combination generation, hand classification, and scoring) is implemented using pure functions. Mutation of arrays is strictly prohibited. `Deck` and `Hand` cards are `readonly` arrays.
- **Framework & Infrastructure Agnostic**: No external runtime dependencies. Runs anywhere Node.js or modern JS runtimes are supported (e.g. edge functions, browsers, serverless).
- **TypeScript Strict Mode**: Configured with `NodeNext` modules and resolution. Relative imports must end with `.js`.
- **Custom Error Codes**: Custom `PokerError` class maps invalid engine operations to programmatically queryable `PokerErrorCode` values, avoiding regex matching on error messages.

---

## 2. Card Representation & Domain Types

- **Suits**: Lowercase strings (`'hearts'`, `'diamonds'`, `'clubs'`, `'spades'`) derived from a const array.
- **Ranks**: Single-character strings (`'2'` to `'9'`, `'T'` for 10, `'J'`, `'Q'`, `'K'`, `'A'`) derived from a const array. This ensures all card rank strings are exactly one character long.
- **Serializations**: Cards serialize to and parse from canonical 2-character strings (e.g. `{ rank: 'T', suit: 'hearts' } -> 'Th'`).

---

## 3. Directory Structure

```
packages/poker-core/
├── src/
│   ├── types/
│   │   ├── Suit.ts             ← Lowercase const-derived union
│   │   ├── Rank.ts             ← Single-character const-derived union
│   │   ├── Card.ts             ← Readonly interface { suit, rank }
│   │   ├── Hand.ts             ← Readonly array of Cards wrapper
│   │   ├── Deck.ts             ← type Deck = readonly Card[]
│   │   ├── PRNG.ts             ← type PRNG = () => number
│   │   ├── HandRank.ts         ← Numeric HandRank enum (0 to 8)
│   │   ├── Classification.ts   ← Classified 5-card shape
│   │   ├── BestHand.ts         ← Evaluated best 5 cards + score array
│   │   ├── CompareResult.ts    ← win | loss | tie union
│   │   ├── Result.ts           ← Generic Result container wrapper
│   │   ├── ActionError.ts      ← Action validation error codes
│   │   ├── GameState.ts        ← State machine types (PlayerState, HandState, GameAction, etc.)
│   │   ├── CompareManyResult.ts ← Multi-player showdown result format
│   │   └── PayoutResult.ts     ← Payout distribution schema
│   │
│   ├── constants/
│   │   └── cards.ts            ← Re-exports SUITS and RANKS
│   │
│   ├── deck/
│   │   ├── createDeck.ts       ← Deterministic 52 card creation
│   │   ├── shuffleDeck.ts      ← Fisher-Yates using custom PRNG
│   │   └── dealCards.ts        ← Pure dealer slice returning remaining
│   │
│   ├── errors/
│   │   └── PokerError.ts       ← Custom error class with PokerErrorCode
│   │
│   ├── evaluation/
│   │   ├── classify.ts         ← Cascade checks on exactly 5 cards
│   │   ├── score.ts            ← Pre-computed score arrays
│   │   ├── bestHand.ts         ← Selects best 5 from C(n, 5) combos
│   │   ├── compareHands.ts     ← Lexicographical score comparison
│   │   └── compareMany.ts      ← Multiplayer hand comparison
│   │
│   ├── state-machine/
│   │   ├── potCalculations.ts  ← Pure side pot and payout distribution logic
│   │   ├── bettingRound.ts     ← Action checking, next actor, round advance
│   │   └── reducer.ts          ← startHand factory & transition state reducer
│   │
│   ├── utils/
│   │   ├── cardUtils.ts        ← serialize, parse, compare, and rankValue
│   │   └── combinations.ts     ← Pure combinations generator
│   │
│   └── index.ts                ← Clean package entry point
│
├── tests/
│   ├── createDeck.test.ts
│   ├── shuffleDeck.test.ts
│   ├── dealCards.test.ts
│   ├── cardUtils.test.ts
│   ├── combinations.test.ts
│   ├── classify.test.ts
│   ├── bestHand.test.ts
│   ├── compareHands.test.ts
│   ├── stateMachine.test.ts    ← Comprehensive Game State Machine tests
│   ├── tableOrchestrator.test.ts ← Table Orchestrator tests (Phase 4)
│   └── property.test.ts        ← Invariant & property-based tests
│
├── tsconfig.json
├── package.json
└── README.md
```

---

## 4. Evaluation Engine Mechanics

### A. Classify (5-Cards-Only)
`classify()` must always be fed exactly 5 cards; it throws an `INVALID_HAND_SIZE` error otherwise.
It sorts the cards descending and runs through a descending cascade:
1. **Straight Flush** (8)
2. **Four of a Kind** (7)
3. **Full House** (6)
4. **Flush** (5)
5. **Straight** (4)
6. **Three of a Kind** (3)
7. **Two Pair** (2)
8. **One Pair** (1)
9. **High Card** (0)

*The Wheel Straight ($5, 4, 3, 2, A$) is handled as a special low-Ace case, ranking as a 5-high straight.*

#### Primary & Kicker Distribution Policies:
- **HighCard**: `primaryCards` = `[]`, `kickers` = all 5 cards (sorted descending).
- **OnePair**: `primaryCards` = 2 cards of the pair, `kickers` = 3 remaining cards.
- **TwoPair**: `primaryCards` = 4 cards of the two pairs (sorted descending by pair rank), `kickers` = 1 remaining card.
- **ThreeOfAKind**: `primaryCards` = 3 cards of the set, `kickers` = 2 remaining cards.
- **Straight**: `primaryCards` = all 5 cards forming the straight (in straight order), `kickers` = `[]`.
- **Flush**: `primaryCards` = all 5 cards forming the flush, `kickers` = `[]`.
- **FullHouse**: `primaryCards` = all 5 cards (3 set, then 2 pair), `kickers` = `[]`.
- **FourOfAKind**: `primaryCards` = 4 cards of the quad, `kickers` = 1 remaining card.
- **StraightFlush**: `primaryCards` = all 5 cards forming the straight flush, `kickers` = `[]`.

### B. Lexicographical Scoring (`score.ts`)
Hands are evaluated by comparing numerical score arrays of a **fixed length** corresponding to each rank category:

| HandRank | score layout | Array Length |
| :--- | :--- | :--- |
| **HighCard** | `[0, k1, k2, k3, k4, k5]` | 6 |
| **OnePair** | `[1, pairRank, k1, k2, k3]` | 5 |
| **TwoPair** | `[2, highPairRank, lowPairRank, k1]` | 4 |
| **ThreeOfAKind** | `[3, tripRank, k1, k2]` | 4 |
| **Straight** | `[4, highCardRank]` | 2 |
| **Flush** | `[5, k1, k2, k3, k4, k5]` | 6 |
| **FullHouse** | `[6, tripRank, pairRank]` | 3 |
| **FourOfAKind** | `[7, quadRank, k1]` | 3 |
| **StraightFlush**| `[8, highCardRank]` | 2 |

*Compare score arrays left-to-right to determine the stronger hand.*

### C. Best Hand Extraction
- `bestHand(cards)` takes $\ge 5$ cards (typically 7).
- Generates all $C(n, 5)$ combinations.
- If two combinations from the same cards yield the same score, keeps the **first** combination processed.

---

## 5. Testing & Validation

All tests are implemented in Vitest and are divided into:
1. **Unit tests**:
   - Covering core deck operations, custom errors, card serializations, combinations validations, and exact rank classifications (including edge cases like `Kh Kd Qh Qd Qs` full house).
   - Covering the Game State Machine (`stateMachine.test.ts`):
     - Linear hand flow transitions through all betting rounds (PreFlop -> Flop -> Turn -> River -> Showdown).
     - Standard blind postings (>2 players) and special 2-player heads-up betting rotation.
     - Validation of action legality (checks on active bets, below-minimum raises, out-of-turn actions, folded/all-in players).
     - Complex side-pot creation, merging, and lazy showdown evaluations.
     - Odd-chip allocation (clockwise closest to the left of the button).
     - Automatically running out remaining board cards from the deck when a skip-to-showdown condition is reached (<= 1 active player remaining).
   - Covering the Table Orchestrator (`tableOrchestrator.test.ts`):
     - Seat management (occupied, empty, sitting-out states).
     - Buy-in limits verification.
     - Mid-hand join/leave atomic queueing and deferred action flushing.
     - Casino "Dead Button" rule and blind skipping with "mustWaitForBB" flags.
     - Chip conservation invariant across hand boundaries.
     - Heads-up blind rotation alternation.
2. **Property-based tests**: Verifying core invariants over 100 random deals:
   - Evaluated best hand card counts are always exactly 5.
   - Score array lengths are consistent per `HandRank`.
   - Hand comparison is reflexive (`compareHands(a, a)` is always a tie).
   - Hand comparison is antisymmetric (`compareHands(a, b)` outcome perfectly inverses `compareHands(b, a)`).

---

## 6. Game State Machine & Table Orchestration (Phases 3 & 4)

The Texas Hold'em Game State Machine and Table Orchestrator are implemented as pure, immutable reducers:

### A. Factory & Reducer Signatures
- **`startHand(config: HandConfig, seats: readonly SeatConfig[], deck?: readonly Card[]): HandState`**:
  Initializes a new hand, shuffles the deck (or uses a pre-shuffled mock deck), deals hole cards (exactly 2 cards per player), posts the blinds, and assigns the correct first actor.
- **`transition(state: HandState, action: GameAction): Result<HandState, ActionError>`**:
  Accepts a voluntary player action (`fold`, `check`, `call`, or `raise`) and transitions the state forward, returning a `Result` container with either the new `HandState` or a validation `ActionError`.

### B. Action Completion (The `hasActed` Flag)
Each player has a `hasActed: boolean` flag in their state. It is reset to `false` at the start of each betting round:
- Checking or calling sets the player's `hasActed` to `true`.
- Performing a full raise sets the player's `hasActed` to `true` and resets all other active players' `hasActed` flags to `false`.
- Under-raise all-ins are accepted but do **not** reset other active players' `hasActed` flags.
- A betting round is complete when all active (non-folded, non-all-in) players have `hasActed === true` and their current round bet matches the target `currentBet`.

### C. Side Pot & Showdown Payout Calculations
- **`calculatePots(players: readonly PlayerState[]): readonly Pot[]`**:
  Calculates side pots dynamically by sorting the unique `totalHandBet` values of all players. Folded players (including folded all-in players) are excluded from pot eligibility. Pots with identical eligible player sets are merged.
- **`distributePayouts(pots: readonly Pot[], players: readonly PlayerState[], communityCards: readonly Card[], dealerIndex: number): PayoutResult`**:
  Evaluates hands lazily at showdown and divides each pot among the pot's winners (using `compareMany`). Odd chips are distributed to winning players closest to the left of the button (`dealerIndex`) clockwise.

### D. Table Orchestration
The table layer handles seating configurations, buying-in/topping-up chips, leaving, sitting out/in, and transitioning between hands:
- **`createTable(config: TableConfig): TableState`**:
  Initializes a new table with empty seats based on the config (e.g., maxSeats 6 or 9).
- **`tableReducer(state: TableState, action: TableAction): TableState`**:
  Implements the state machine for table orchestration:
  - `joinTable`: Seats players at a specific seat. If a hand is in progress, the join is queued in `pendingJoins`. Validates min/max buy-in limits.
  - `leaveTable`: Evicts players immediately if idle, or queues in `pendingLeaves` if mid-hand.
  - `sitOut`: Transitions seat status to `"sitting-out"`. Players sitting out are skipped in subsequent hands.
  - `sitIn`: Re-seats players into the active list and sets `mustWaitForBB = true`.
  - `addChips`: Adds chips to a player's seat stack immediately. Because the active hand's state (`HandState`) maintains a snapshot of player stacks when the hand is dealt to ensure game integrity (preventing stack fluctuation mid-hand), any chips added mid-hand will not be visible to or usable in the current active hand. The player's updated seat stack will be used when dealing the next hand.
  - `startNextHand`: Flushes pending leaves/joins, evicts busted players, rotates the dealer button (handling the Dead Button rule), and deals in players whose `mustWaitForBB` has cleared.
  - `timeout`: Converts a timed-out player's action to check or fold.
  - `dispatchHandAction`: Forwards standard hand decisions to the underlying `HandState` reducer.

---

## 7. Future Roadmap (Phase 5 Preview)

With Phase 4 (Table Orchestration) fully completed and integrated, the next phase focuses on connection infrastructure:
- **Phase 5: Server Network Sync Layer (Infrastructure)**:
  - WebSocket interface for real-time multiplayer coordination.
  - Strict Client State Sanitization (`sanitizeStateForClient`) to scrub hidden information (hole cards, deck cards) until showdown.
  - Stale timeout action filters and connection time bank management.

