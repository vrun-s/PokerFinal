import Fastify from "fastify";
import { Server } from "socket.io";
import { config } from "./config.js";
import { logger } from "./services/logger.js";
import {
  seedStaticTables,
  redisClient,
  initializePubSub,
  registerTableUpdateListener,
} from "./services/redisService.js";
import { registerSocketHandlers, broadcastTableState, generatePlayerToken } from "./sockets/socketHandlers.js";
import { syncTimerForTableState } from "./services/timeoutManager.js";
import { executeTransaction, createPlayer, getPlayerByUsername, initializeDatabaseSchema } from "./services/postgresService.js";
import bcrypt from "bcryptjs";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport: process.env.NODE_ENV === "development"
      ? { target: "pino-pretty" }
      : undefined,
  },
});

// Configure CORS Headers for REST API
app.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type");
});

// Auto-handle CORS preflight OPTIONS request
app.options("/*", async (request, reply) => {
  reply.code(204).send();
});

// Register endpoint
app.post("/api/register", async (request, reply) => {
  try {
    const { username, displayName, password } = request.body as {
      username?: string;
      displayName?: string;
      password?: string;
    };

    if (!username || !displayName || !password) {
      reply.code(400).send({ error: "Missing username, displayName, or password" });
      return;
    }

    // Validation: username alphanumeric, 3–20 chars
    const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;
    if (!usernameRegex.test(username)) {
      reply.code(400).send({ error: "Username must be alphanumeric and between 3 and 20 characters" });
      return;
    }

    // Validation: password min 8 chars
    if (password.length < 8) {
      reply.code(400).send({ error: "Password must be at least 8 characters long" });
      return;
    }

    // Validation: displayName non-empty
    if (displayName.trim().length === 0) {
      reply.code(400).send({ error: "Display name cannot be empty" });
      return;
    }

    // Check if username is already taken (duplicate check)
    const existing = await executeTransaction(async (client) => {
      return await getPlayerByUsername(client, username);
    });

    if (existing !== null) {
      reply.code(409).send({ error: "Username is already taken" });
      return;
    }

    // Hash password (only after ensuring username is free)
    const passwordHash = await bcrypt.hash(password, 10);

    // Create player in database
    await executeTransaction(async (client) => {
      await createPlayer(client, username, displayName, passwordHash);
    });

    const token = generatePlayerToken(username);
    reply.send({ token });
  } catch (err: any) {
    reply.code(500).send({ error: err.message || "Registration failed" });
  }
});

// Login endpoint
app.post("/api/login", async (request, reply) => {
  try {
    const { username, password } = request.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      reply.code(400).send({ error: "Missing username or password" });
      return;
    }

    const player = await executeTransaction(async (client) => {
      return await getPlayerByUsername(client, username);
    });

    // Timing & Security: execute dummy compare if player not found to avoid timing attacks
    if (!player) {
      await bcrypt.compare(password, "$2b$10$invalidhashpadding000000000000000000000000000000000000");
      reply.code(401).send({ error: "Invalid username or password" });
      return;
    }

    const isMatch = await bcrypt.compare(password, player.password_hash);
    if (!isMatch) {
      reply.code(401).send({ error: "Invalid username or password" });
      return;
    }

    const token = generatePlayerToken(player.id);
    reply.send({
      token,
      name: player.name,
      balance: player.balance,
    });
  } catch (err: any) {
    reply.code(500).send({ error: err.message || "Authentication failed" });
  }
});

// Root endpoint fallback
app.get("/", async (request, reply) => {
  reply.type("text/plain").send("Poker Server");
});

export const httpServer = app.server;

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

registerSocketHandlers(io);

async function start() {
  try {
    await initializeDatabaseSchema();
    logger.info("Database schema initialized");

    await redisClient.connect();
    logger.info("Connected to Redis");

    // Wire up Redis Pub/Sub table change listener to update all sockets on this server instance
    registerTableUpdateListener(async (tableId, state) => {
      await broadcastTableState(io, tableId, state);
      await syncTimerForTableState(io, state, tableId);
    });
    await initializePubSub();
    logger.info("Connected Redis Pub/Sub");

    await seedStaticTables();
    logger.info("Static tables seeded");

    await app.listen({ port: config.PORT, host: "0.0.0.0" });
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  start();
} else {
  // Compile fastify routes/hooks for integration tests
  await app.ready();
}

export { app, io };
