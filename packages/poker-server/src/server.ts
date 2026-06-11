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
import { executeTransaction, upsertPlayer, initializeDatabaseSchema } from "./services/postgresService.js";

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

// API Auth endpoint
app.post("/api/auth", async (request, reply) => {
  try {
    const { playerId, name } = request.body as { playerId?: string; name?: string };
    if (!playerId || !name) {
      reply.code(400).send({ error: "Missing playerId or name" });
      return;
    }
    // Register/Upsert player in PG database with initial balance
    await executeTransaction(async (client) => {
      await upsertPlayer(client, playerId, name, 10000);
    });
    const token = generatePlayerToken(playerId);
    reply.send({ token });
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
