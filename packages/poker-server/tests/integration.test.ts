import { describe, it, beforeAll, afterAll, expect, vi } from "vitest";
import { AddressInfo } from "net";
import { io as ClientIO, Socket as ClientSocket } from "socket.io-client";
import { createTable, TableState } from "@poker-platform/poker-core";

// 1. Mock ioredis in-memory before importing server (including Pub/Sub channels mapping)
const mockStore = new Map<string, string>();
const mockSubscribers = new Map<string, Array<(channel: string, message: string) => void>>();

vi.mock("ioredis", () => {
  return {
    Redis: class MockRedis {
      private eventListeners = new Map<string, any[]>();
      constructor() {}
      async connect() {}
      async exists(key: string) {
        return mockStore.has(key);
      }
      async get(key: string) {
        return mockStore.get(key) || null;
      }
      async set(key: string, value: string) {
        mockStore.set(key, value);
      }
      async publish(channel: string, message: string) {
        const list = mockSubscribers.get(channel) || [];
        for (const cb of list) {
          cb(channel, message);
        }
      }
      async subscribe(channel: string) {
        if (!mockSubscribers.has(channel)) {
          mockSubscribers.set(channel, []);
        }
        mockSubscribers.get(channel)!.push((chan, msg) => {
          this.emit("message", chan, msg);
        });
      }
      on(event: string, callback: any) {
        if (!this.eventListeners.has(event)) {
          this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
      }
      emit(event: string, ...args: any[]) {
        const list = this.eventListeners.get(event) || [];
        for (const cb of list) {
          cb(...args);
        }
      }
    }
  };
});

// 2. Mock pg in-memory to handle database transaction hooks during actions
const mockBalances = new Map<string, number>();
mockBalances.set("P0", 10000);
mockBalances.set("P1", 10000);

vi.mock("pg", () => {
  return {
    default: {
      Pool: class MockPool {
        constructor() {}
        async connect() {
          return {
            query: async (sql: string, params?: any[]) => {
              if (sql.includes("SELECT id, name, password_hash, balance FROM players")) {
                const playerId = params![0];
                const balance = mockBalances.get(playerId) || 0;
                return { rows: [{ id: playerId, name: playerId, password_hash: "mocked_hash", balance }] };
              }
              if (sql.includes("SELECT balance")) {
                const playerId = params![0];
                const balance = mockBalances.get(playerId) || 0;
                return { rows: [{ balance }] };
              }
              if (sql.includes("UPDATE players SET balance = balance -")) {
                const amount = params![0];
                const playerId = params![1];
                const current = mockBalances.get(playerId) || 0;
                mockBalances.set(playerId, current - amount);
                return { rows: [] };
              }
              if (sql.includes("UPDATE players SET balance = balance +")) {
                const amount = params![0];
                const playerId = params![1];
                const current = mockBalances.get(playerId) || 0;
                mockBalances.set(playerId, current + amount);
                return { rows: [] };
              }
              if (sql.includes("SELECT hand_number, state_log, created_at FROM hand_histories")) {
                return { rows: [{ hand_number: 1, state_log: { currentHandState: { pots: [{ amount: 100 }], players: [{ id: "P0", name: "Alice", status: "active", cards: [{ rank: "A", suit: "hearts" }, { rank: "K", suit: "diamonds" }] }], communityCards: [] } }, created_at: new Date() }] };
              }
              if (sql.includes("SELECT id, name, balance FROM players ORDER BY balance")) {
                return { rows: [{ id: "P0", name: "Alice", balance: 10000 }, { id: "P1", name: "Bob", balance: 10000 }] };
              }
              if (sql.includes("BEGIN") || sql.includes("COMMIT") || sql.includes("ROLLBACK")) {
                return { rows: [] };
              }
              return { rows: [] };
            },
            release: () => {},
          };
        }
      }
    }
  };
});

// Import server now that mock environments are configured
import { app, httpServer, io } from "../src/server.js";
import {
  initializePubSub,
  registerTableUpdateListener,
} from "../src/services/redisService.js";
import { broadcastTableState, generatePlayerToken } from "../src/sockets/socketHandlers.js";

describe("Socket Server Integration", () => {
  let port: number;
  let client1: ClientSocket;
  let client2: ClientSocket;

  beforeAll(async () => {
    // Seed initial table 1 state in mock Redis
    const initialTable = createTable({
      maxSeats: 6,
      minBuyIn: 100,
      maxBuyIn: 1000,
      smallBlind: 10,
      bigBlind: 20,
    });
    mockStore.set("table:1", JSON.stringify(initialTable));
    mockStore.set("table:2", JSON.stringify(initialTable));
    mockStore.set("table:3", JSON.stringify(initialTable));

    // Initialize Pub/Sub subscriber client and channel listeners for tests
    registerTableUpdateListener(async (tableId, state) => {
      await broadcastTableState(io, tableId, state);
    });
    await initializePubSub();

    // Listen on random free port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    if (client1) client1.disconnect();
    if (client2) client2.disconnect();
    httpServer.close();
  });

  it("should support subscribing, joining table, and sanitizing player views", () => {
    const aliceToken = generatePlayerToken("P0");
    const bobToken = generatePlayerToken("P1");

    return new Promise<void>((resolve, reject) => {
      client1 = ClientIO(`http://localhost:${port}`, { autoConnect: false });
      client2 = ClientIO(`http://localhost:${port}`, { autoConnect: false });

      let client1States: any[] = [];
      let client2States: any[] = [];
      let client1Balances: any[] = [];

      client1.connect();
      client2.connect();

      // Alice connects and subscribes to Table 1
      client1.on("connect", () => {
        client1.emit("subscribe_table", { tableId: "1", token: aliceToken });
      });

      // Bob connects and subscribes to Table 1
      client2.on("connect", () => {
        client2.emit("subscribe_table", { tableId: "1", token: bobToken });
      });

      client1.on("account_balance", (data: any) => {
        client1Balances.push(data.balance);
      });

      client1.on("table_state", (state: any) => {
        client1States.push(state);

        // Once Alice receives initial state, she sits down at Seat 0
        if (client1States.length === 1) {
          expect(state.handActionSeq).toBe(0);
          client1.emit("join_table", {
            tableId: "1",
            token: aliceToken,
            name: "Alice",
            buyIn: 500,
            seatIndex: 0,
            handActionSeq: 0,
          });
        }

        // When hand is started
        if (client1States.length === 4) {
          expect(state.handActionSeq).toBe(3);
          expect(state.currentHandState).not.toBeNull();

          // Alice (P0) should see her own cards
          expect(state.currentHandState.players[0].id).toBe("P0");
          expect(state.currentHandState.players[0].cards[0]).not.toBeNull();

          // Alice should NOT see Bob's (P1) cards
          expect(state.currentHandState.players[1].id).toBe("P1");
          expect(state.currentHandState.players[1].cards).toEqual([null, null]);

          // Now let's verify sequence clock error handling by Alice emitting a stale action (handActionSeq = 0)
          client1.emit("game_action", {
            tableId: "1",
            playerId: "P0",
            action: { type: "dispatchHandAction", action: { type: "fold", playerId: "P0" } },
            handActionSeq: 0, // stale
          });
        }
      });

      client2.on("table_state", (state: any) => {
        client2States.push(state);

        // Verify Bob sees Alice sitting in Seat 0
        if (client2States.length === 2) {
          expect(state.seats[0].playerId).toBe("P0");
          expect(state.seats[0].name).toBe("Alice");
          expect(state.handActionSeq).toBe(1);

          // Bob joins at Seat 1 using the current sequence 1
          client2.emit("join_table", {
            tableId: "1",
            token: bobToken,
            name: "Bob",
            buyIn: 500,
            seatIndex: 1,
            handActionSeq: 1,
          });
        }

        // After Bob joins, let's verify both clients see the seats occupied
        if (client2States.length === 3) {
          expect(state.handActionSeq).toBe(2);
          expect(state.seats[0].playerId).toBe("P0");
          expect(state.seats[1].playerId).toBe("P1");

          // Let's start the next hand (Alice acts as dealer, starts hand)
          client1.emit("game_action", {
            tableId: "1",
            playerId: "P0",
            action: { type: "startNextHand" },
            handActionSeq: 2,
          });
        }
      });

      client1.on("error", (err: any) => {
        const errorMsg = typeof err === "string" ? err : err.message || "";
        const errorCode = typeof err === "object" && err !== null ? err.code : undefined;

        expect(errorMsg).toContain("Out of sync action sequence");
        expect(errorCode).toBe("ACTION_REJECTED");
        // Verify client1 received account balance updates (at subscription and join_table)
        expect(client1Balances.length).toBeGreaterThanOrEqual(2);
        resolve(); // Success: we validated seating, sanitization, actions, sequence check, and balance emissions!
      });
    });
  });

  describe("Fastify REST API endpoints & Rate Limiting", () => {
    it("should fetch static tables info successfully", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/tables",
      });
      expect(response.statusCode).toBe(200);
      const tables = JSON.parse(response.body);
      expect(tables.length).toBe(3);
      expect(tables[0].name).toContain("Table #1");
      expect(tables[1].playersSeated).toBe(0);
    });

    it("should fetch leaderboard successfully", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/leaderboard",
      });
      expect(response.statusCode).toBe(200);
      const leaders = JSON.parse(response.body);
      expect(leaders.length).toBe(2);
      expect(leaders[0].name).toBe("Alice");
    });

    it("should reject table history requests if unauthenticated", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/tables/1/history",
      });
      expect(response.statusCode).toBe(401);
    });

    it("should fetch table history successfully with valid Bearer token", async () => {
      const token = generatePlayerToken("P0");
      const response = await app.inject({
        method: "GET",
        url: "/api/tables/1/history",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      expect(response.statusCode).toBe(200);
      const history = JSON.parse(response.body);
      expect(history.length).toBe(1);
      expect(history[0].hand_number).toBe(1);
    });

    it("should trigger rate limiting on register under stress", async () => {
      const payload = { username: "rate1", displayName: "Rate Limit Test", password: "some_password" };
      // Inject 5 requests successfully (different user IDs)
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: "POST",
          url: "/api/register",
          payload: { ...payload, username: `rate_${i}` },
        });
      }
      // 6th request triggers rate-limiting (429)
      const response = await app.inject({
        method: "POST",
        url: "/api/register",
        payload,
      });
      expect(response.statusCode).toBe(429);
    });
  });
});
