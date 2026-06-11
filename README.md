# Texas Hold'em Poker Platform Monorepo

Welcome to the production-grade, real-time Texas Hold'em Poker Platform monorepo. This repository contains the complete Texas Hold'em engine and real-time multiplayer network sync layer, organized as an npm workspaces monorepo.

---

## 1. Monorepo Architecture

This workspace is divided into three distinct, isolated packages under `packages/`:

1. **`poker-core`**: A pure, framework-agnostic library containing all card representations, deterministic deck shufflers, standard 5-to-7 card lexicographical evaluation algorithms, linear hand state transitions, dynamic side-pots calculations, and pure table orchestration logic (seat management, dead button rules, etc.).
2. **`poker-server`**: A real-time synchronization server running on Node.js. It integrates the core engine logic with a PostgreSQL database for transaction-safe balance adjustments, a Redis cache/pub-sub cluster for state coordination and cross-node sync, and WebSockets (Socket.io) for multi-player client communication.
3. **`poker-client`**: A premium, real-time single-page web app built with React, TypeScript, and Vite. It links directly to the real-time server via WebSockets, utilizing split Zustand state stores (session, table state, and high-frequency timer ticks) to optimize layout rendering.

```
.
├── packages/
│   ├── poker-core/            ← Pure functional engine and table orchestrator
│   ├── poker-server/          ← Real-time server layer (sockets, DB, Redis, timers)
│   └── poker-client/          ← Premium React frontend web app (Zustand, WebSockets)
├── package.json               ← Root npm workspace definitions and tasks
├── tsconfig.base.json         ← Shared compiler configuration rules
└── project_context.md         ← Single source of truth design specifications
```

---

## 2. Getting Started

### Prerequisites
- **Node.js**: v20+ recommended
- **Redis**: An active instance for state persistence and Pub/Sub
- **PostgreSQL**: A database instance containing the schema specified in `packages/poker-server/src/db/schema.sql`

### Installation & Builds

Run all commands from the root directory:

```bash
# Install dependencies for all workspace packages
npm install

# Build all packages (generates dist outputs)
npm run build
```

### Running Tests

Execute the comprehensive test suites (containing 100+ unit and property-based test specs):

```bash
# Run all tests across the monorepo workspace (poker-core and poker-server)
npm run test
```

### Running the Server

Start the real-time server in development mode with hot-reloading:

```bash
npm run dev --workspace=packages/poker-server
```

---

## 3. Server Configuration & Environment

The real-time server uses the following environment variables (configured via `.env` in `packages/poker-server/`):

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP Server port | `3000` |
| `REDIS_URL` | Redis server connection URI | `redis://localhost:6379` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/poker` |
| `ACTION_TIMEOUT_SECONDS` | Standard action window per player | `15` |
| `TIME_BANK_DEFAULT_SECONDS` | Default extra time-bank allocated per player | `30` |
| `DISCONNECT_GRACE_PAUSE_SECONDS`| Delay before acting on an disconnected player | `5` |
| `AUTH_SECRET` | HMAC signature key for player tokens | `poker-server-secret-key-12345` |

---

## 4. REST & WebSockets API Protocol

### A. REST Authentication API
To connect to the poker server, a player must obtain a signed HMAC-SHA256 token.

* **Endpoint**: `POST /api/auth`
* **Content-Type**: `application/json`
* **Request Payload**:
  ```json
  {
    "playerId": "player_123",
    "name": "Jane Doe"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "token": "player_123.3a89045bfae7e..."
  }
  ```
  *The token format is `{playerId}.{signature}`.*

### B. WebSocket Client Events (Inbound)
All client actions must be authorized using the token generated during REST authentication.

1. **`subscribe_table`**: Join a table lobby room and begin observing state.
   ```json
   {
     "tableId": "1",
     "token": "player_123.3a89045bfae7e..."
   }
   ```
2. **`join_table`**: Register for an active seat at the table.
   ```json
   {
     "tableId": "1",
     "token": "player_123.3a89045bfae7e...",
     "name": "Jane Doe",
     "buyIn": 1000,
     "seatIndex": 2,
     "handActionSeq": 0
   }
   ```
3. **`game_action`**: Dispatch a poker decision (or seat/top-up management request).
   ```json
   {
     "tableId": "1",
     "playerId": "player_123",
     "handActionSeq": 12,
     "action": {
       "type": "dispatchHandAction",
       "action": {
         "type": "raise",
         "playerId": "player_123",
         "amount": 200
       }
     }
   }
   ```

### C. WebSocket Server Events (Outbound)
1. **`table_state`**: Broadcasts the current table state.
   - Hidden information (remaining deck, opponents' hole cards) is automatically masked unless the hand is in the `Showdown` round and the player has not folded.
   - Includes `stateVersion` (mirroring `handActionSeq`) to track active updates.
   - Includes `legalActions` (populated with `fold`, `check`, `call`, `raise`, including exact call amounts and min raises) only for the active actor's sanitized view.
2. **`timer_tick`**: Emitted once per second during an active decision:
   ```json
   {
     "playerId": "player_123",
     "timeLeft": 12,
     "timeBankLeft": 30,
     "isTimeBank": false,
     "isPaused": false
   }
   ```
3. **`error`**: Emitted if an action is rejected or invalid (e.g., `{ "message": "Out of sync action sequence" }`).

---

## 5. Security & Invariant Integrity Guarantees

The codebase has built-in protections against common online poker security threats and race conditions:

- **TOCTOU Race Prevention**: The server tracks sequence counts (`handActionSeq`). If a client sends an action with a sequence that does not match the active cached state (e.g., they clicked call a split-second after their action timer expired and triggered a server-side auto-fold), the stale action is safely rejected. The client verifies this using the `stateVersion` property.
- **HMAC Signatures**: Prevents client-side spoofing. Users cannot connect or act on behalf of another player ID without a valid signature matching the server's `AUTH_SECRET`.
- **Cheat-Proof Actions**: The server strips user-supplied fields like `deck` on `startNextHand` actions to prevent clients from seeding predetermined decks.
- **Top-Up Boundary Constraints**: The `addChips` action validates that the amount is strictly positive and that the final seat stack does not exceed the table's `maxBuyIn`.
- **Mid-Hand Balance Lock**: Top-up chips are only integrated into the active hand state between hands to maintain absolute game invariants.
- **Information Leak Protection**: Strict client state sanitization filters hole cards in memory prior to network serialization, mitigating client-side memory inspection hacks. It also restricts the computation of `legalActions` exclusively to the active actor.
- **Store-Isolation Rendering**: The frontend application isolates high-frequency timer ticks from core table states inside separated Zustand stores to prevent rendering lags or layout stuttering.
