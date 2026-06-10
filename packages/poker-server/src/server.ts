import { createServer } from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { seedStaticTables, redisClient } from "./services/redisService.js";
import { registerSocketHandlers } from "./sockets/socketHandlers.js";

const httpServer = createServer((req, res) => {
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
