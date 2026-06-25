import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// Mock pg to handle database connection queries in auth tests
const mockPlayers = new Map<string, any>();
const mockQuery = vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
  if (sql.includes("INSERT INTO players")) {
    const [id, name, passwordHash] = params!;
    if (mockPlayers.has(id)) {
      const err = new Error("duplicate key value violates unique constraint");
      (err as any).code = "23505";
      throw err;
    }
    mockPlayers.set(id, { id, name, password_hash: passwordHash, balance: 10000, is_admin: false });
    return { rows: [] };
  }
  if (sql.includes("FROM players WHERE id = $1") && sql.includes("password_hash")) {
    const id = params && params[0];
    const player = id ? mockPlayers.get(id) : null;
    if (!player) return { rows: [] };
    return { rows: [player] };
  }
  return { rows: [] };
});

const mockClient = {
  query: mockQuery,
  release: vi.fn(),
};

vi.mock("pg", () => {
  return {
    default: {
      Pool: class MockPool {
        connect() {
          return Promise.resolve(mockClient);
        }
      }
    }
  };
});

// Mock ioredis
vi.mock("ioredis", () => {
  return {
    Redis: class MockRedis {
      async connect() {}
      async exists() { return false; }
      async get() { return null; }
      async set() {}
      async publish() {}
      async subscribe() {}
      on() {}
    }
  };
});

import { app } from "../src/server.js";
import { verifyPlayerToken } from "../src/sockets/socketHandlers.js";

describe("Authentication Routes API", () => {
  beforeEach(() => {
    mockPlayers.clear();
    vi.clearAllMocks();
  });

  it("should register a player successfully with password hashing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        username: "jane123",
        displayName: "Jane Doe",
        password: "securePassword123"
      }
    });

    if (response.statusCode !== 200) {
      throw new Error("REGISTER FAILED WITH BODY: " + response.body);
    }
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.token).toBeDefined();

    // Verify token validity
    const decodedPlayerId = verifyPlayerToken(body.token);
    expect(decodedPlayerId).toBe("jane123");

    // Verify player is stored in db and password is hashed (not plaintext)
    const stored = mockPlayers.get("jane123");
    expect(stored).toBeDefined();
    expect(stored.name).toBe("Jane Doe");
    expect(stored.password_hash).not.toBe("securePassword123");
  });

  it("should return 409 if username is duplicate, without calling bcrypt.hash", async () => {
    // Spy on bcrypt.hash
    const hashSpy = vi.spyOn(bcrypt, "hash");

    // Register once
    await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        username: "jane123",
        displayName: "Jane Doe",
        password: "securePassword123"
      }
    });

    hashSpy.mockClear();

    // Register again with the duplicate username
    const response = await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        username: "jane123",
        displayName: "Jane Second",
        password: "anotherSecurePassword"
      }
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.error).toContain("already taken");

    // Verify duplicate check prevents wasteful hashing
    expect(hashSpy).not.toHaveBeenCalled();
  });

  it("should login successfully and return token, name, and balance", async () => {
    // Register first
    await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        username: "jane123",
        displayName: "Jane Doe",
        password: "securePassword123"
      }
    });

    // Login
    const response = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: {
        username: "jane123",
        password: "securePassword123"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.token).toBeDefined();
    expect(body.name).toBe("Jane Doe");
    expect(body.balance).toBe(10000);

    const decodedPlayerId = verifyPlayerToken(body.token);
    expect(decodedPlayerId).toBe("jane123");
  });

  it("should return 401 for wrong password, with identical error message", async () => {
    // Register
    await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        username: "jane123",
        displayName: "Jane Doe",
        password: "securePassword123"
      }
    });

    // Login wrong password
    const response = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: {
        username: "jane123",
        password: "wrongPassword"
      }
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Invalid username or password");
  });

  it("should return 401 for unknown username, with identical error message", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: {
        username: "nonexistent",
        password: "somePassword"
      }
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Invalid username or password");
  });
});
