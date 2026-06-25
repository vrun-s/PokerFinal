// poker-server/src/middleware/requireAdmin.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { verifyPlayerToken } from "../sockets/socketHandlers.js";
import { executeTransaction, getPlayerByUsername } from "../services/postgresService.js";

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization token" } });
    return reply;
  }

  const token = authHeader.substring(7);
  const playerId = verifyPlayerToken(token);
  if (!playerId) {
    reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid authentication token" } });
    return reply;
  }

  const player = await executeTransaction((client) => getPlayerByUsername(client, playerId));
  if (!player?.is_admin) {
    reply.code(403).send({ error: { code: "FORBIDDEN", message: "Admin access required" } });
    return reply;
  }

  request.playerId = playerId; 
}