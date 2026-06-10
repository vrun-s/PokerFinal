import { createServer } from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import {
  seedStaticTables,
  redisClient,
  initializePubSub,
  registerTableUpdateListener,
} from "./services/redisService.js";
import { registerSocketHandlers, broadcastTableState, generatePlayerToken } from "./sockets/socketHandlers.js";
import { syncTimerForTableState } from "./services/timeoutManager.js";
import { executeTransaction, upsertPlayer } from "./services/postgresService.js";

const httpServer = createServer((req, res) => {
  // CORS Headers for REST API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { playerId, name } = JSON.parse(body);
        if (!playerId || !name) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing playerId or name" }));
          return;
        }
        // Register/Upsert player in PG database with initial balance
        await executeTransaction(async (client) => {
          await upsertPlayer(client, playerId, name, 10000);
        });
        const token = generatePlayerToken(playerId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token }));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Authentication failed" }));
      }
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Poker Server");
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

registerSocketHandlers(io);

async function start() {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");

    // Wire up Redis Pub/Sub table change listener to update all sockets on this server instance
    registerTableUpdateListener(async (tableId, state) => {
      await broadcastTableState(io, tableId, state);
      await syncTimerForTableState(io, state, tableId);
    });
    await initializePubSub();
    console.log("Connected Redis Pub/Sub");

    await seedStaticTables();
    console.log("Static tables seeded");

    httpServer.listen(config.PORT, () => {
      console.log(`Server listening on port ${config.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  start();
}

export { httpServer, io };
