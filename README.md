# Texas Hold'em Poker Platform Monorepo

[![Live Demo](https://img.shields.io/badge/Demo-Live_Site-cyan?style=for-the-badge)](https://poker-arena.example.com)
[![Docker Compose Setup](https://img.shields.io/badge/Local_Setup-Docker_Compose-blueviolet?style=for-the-badge)](#6-local-development-via-docker-compose)

Welcome to the production-grade, real-time Texas Hold'em Poker Platform monorepo. This repository contains the complete Texas Hold'em engine and real-time multiplayer network sync layer, organized as an npm workspaces monorepo.

---

## 1. Monorepo Architecture

This workspace is divided into three distinct, isolated packages under `packages/`:

1. **`poker-core`**: A pure, framework-agnostic library containing all card representations, deterministic deck shufflers, standard 5-to-7 card lexicographical evaluation algorithms, linear hand state transitions, dynamic side-pots calculations, and pure table orchestration logic (seat management, dead button rules, etc.).
2. **`poker-server`**: A real-time synchronization server running on Node.js and Fastify. It integrates the core engine logic with a PostgreSQL database for transaction-safe balance adjustments, a Redis cache/pub-sub cluster for state coordination and cross-node sync, WebSockets (Socket.io) for multi-player client communication, and Pino for structured JSON/human-readable logging.
3. **`poker-client`**: A premium, real-time single-page web app built with React, TypeScript, and Vite. It links directly to the real-time server via WebSockets, utilizing split Zustand state stores (session, table state, and high-frequency timer ticks) to optimize layout rendering.

### System Data Flow
```mermaid
graph TD
    Client[poker-client React/Vite] <-->|HTTP / WebSockets| Nginx[Nginx Reverse Proxy]
    Nginx <-->|Proxy to Port 3000| Server[poker-server Node.js]
    Server <-->|Caching & Pub/Sub| Redis[(Redis Cluster)]
    Server <-->|Balances & Hand History| Postgres[(PostgreSQL DB)]
```

### Folder Layout
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

## 2. Key Technical Decisions

### A. Pure Functional Reducer Engine (`poker-core`)
The Texas Hold'em game engine is built as a pure, side-effect-free state reducer. It accepts a table state and a game action, and deterministically returns the next state. There are no databases, timers, or network concerns inside `poker-core`. This enables:
- **100% Test Coverage**: The game engine can be tested exhaustively via automated unit and property-based test suites.
- **Easy Replayability**: Any hand can be replayed from any state by feeding it the sequence of actions.

### B. 3-Tier Card Visibility Model (Authoritative Sanitization)
To prevent client-side hacks (like memory inspection or network packet decoding), opponent hole cards are masked. The server maintains a 3-Tier Card Visibility state:
1. **Own Cards**: Only visible to the player holding them.
2. **Tabled Showdown Cards**: Visible to all players once the hand enters showdown.
3. **Hidden Opponent Cards**: Masked as null prior to showdown.
Sanitization is computed authoritatively on the server *before* serializing and transmitting state payloads, ensuring clients never receive sensitive information about opponents' hands.

### C. Redis Pub/Sub Horizontal Scaling
State updates and active hand timers are synchronized across server processes via Redis Pub/Sub. When an action occurs on any server node, the updated table state is published to Redis. Connected backend nodes subscribe to the channel, receive the state change, and immediately broadcast it to their local socket connections.

### D. Stale Sequence (TOCTOU) Prevention
To prevent Time-of-Check to Time-of-Use (TOCTOU) race conditions—such as a player checking a fraction of a second after their turn times out and auto-folds—each state update carries an incrementing `stateVersion` (sequence count). Inbound game actions must supply the `handActionSeq` matching the version they acted upon. Stale actions are automatically rejected.

### E. Untrusted Payload Type Narrowing & Validation
Although the backend utilizes TypeScript types (such as `TableAction`) to declare compile-time schema bounds, incoming Socket.IO network payloads are untrusted JSON structures at runtime. To maintain type boundary integrity and block clients from invoking restricted internal operations (like injecting `"timeout"` events to auto-fold opponent hands), the server casts raw payloads to `unknown` and runs safe runtime property guards before handling them. This prevents malicious clients from bypassing network protocol boundaries.

---

## 3. Getting Started (Manual Install)

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
Execute the comprehensive test suites:
```bash
# Run all tests across the monorepo workspace (poker-core and poker-server)
npm run test
```

### Running the Server Locally
Start the real-time server in development mode:
```bash
npm run dev --workspace=packages/poker-server
```

---

## 4. Local Development via Docker Compose

You can build and spin up the entire multi-service architecture locally using a single command:

> [!WARNING]
> **Database Schema Migration (Phase 8)**: Since the database schema was updated to introduce password hashing support via a mandatory `password_hash` column on the `players` table, any existing Docker PostgreSQL data volumes from previous runs must be dropped to ensure the correct schema is generated. Execute:
> ```bash
> docker compose down -v
> ```

```bash
docker compose up --build
```

This command orchestrates:
- **`postgres`** (`5432`): Database initialization and automatic schema execution.
- **`redis`** (`6379`): Cache and broker.
- **`poker-server`** (`3000`): Real-time Fastify server running Pino structured logs. It automatically waits for postgres and redis healthchecks before starting.
- **`poker-client`** (`8080`): The React web application served by Nginx, routing WebSocket upgrades and HTTP requests back to the server.

Navigate to [http://localhost:8080](http://localhost:8080) to start playing.

---

## 5. Server & Client Configuration & Environment

### A. Real-Time Server Environment Variables
The server uses the following environment variables (configured via `.env` in `packages/poker-server/`):

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP Server port | `3000` |
| `REDIS_URL` | Redis server connection URI | `redis://localhost:6379` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/poker` |
| `ACTION_TIMEOUT_SECONDS` | Standard action window per player | `15` |
| `TIME_BANK_DEFAULT_SECONDS` | Default extra time-bank allocated per player | `30` |
| `DISCONNECT_GRACE_PAUSE_SECONDS`| Delay before acting on a disconnected player | `5` |
| `AUTH_SECRET` | HMAC signature key for player tokens | `poker-server-secret-key-12345` |

### B. Client Build-Time Environment Variables
Vite compiles these variables into the static SPA bundle at build-time. They are declared as stage-scoped `ARG` variables inside `packages/poker-client/Dockerfile` and passed via `docker-compose.yml` build configurations:

| Variable | Description | Default / Fallback |
| :--- | :--- | :--- |
| `VITE_SOCKET_URL` | Socket.io server connection origin URL | `window.location.origin` (proxied via Nginx) |
| `VITE_API_URL` | API auth server base path / origin prefix | `""` (relative prefix proxied via Nginx) |

---

## 6. REST & WebSockets API Protocol

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
     "isPaused": false,
     "maxTimeLeft": 15
   }
   ```
3. **`error`**: Emitted if an action is rejected or invalid (e.g., `{ "message": "Out of sync action sequence" }`).
