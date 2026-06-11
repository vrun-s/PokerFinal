import pg from "pg";
const { Pool } = pg;
import { config } from "../config.js";
import { TableState } from "@poker-platform/poker-core";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

export const pgPool = new Pool({
  connectionString: config.DATABASE_URL,
});

export async function executeTransaction<T>(
  queryFn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const result = await queryFn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPlayerBalance(client: pg.PoolClient, playerId: string): Promise<number> {
  const res = await client.query("SELECT balance FROM players WHERE id = $1", [playerId]);
  if (res.rows.length === 0) {
    throw new Error(`Player ${playerId} not found in database`);
  }
  return res.rows[0].balance as number;
}

export async function deductPlayerBalance(client: pg.PoolClient, playerId: string, amount: number): Promise<void> {
  const balance = await getPlayerBalance(client, playerId);
  if (balance < amount) {
    throw new Error("Insufficient balance in database");
  }
  await client.query("UPDATE players SET balance = balance - $1 WHERE id = $2", [amount, playerId]);
}

export async function creditPlayerBalance(client: pg.PoolClient, playerId: string, amount: number): Promise<void> {
  await client.query("UPDATE players SET balance = balance + $1 WHERE id = $2", [amount, playerId]);
}

export async function upsertPlayer(client: pg.PoolClient, id: string, name: string, balance: number): Promise<void> {
  await client.query(
    `INSERT INTO players (id, name, balance) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET name = $2, balance = $3`,
    [id, name, balance]
  );
}

export async function logHandHistory(
  client: pg.PoolClient,
  tableId: string,
  handNumber: number,
  state: TableState
): Promise<void> {
  await client.query(
    "INSERT INTO hand_histories (table_id, hand_number, state_log) VALUES ($1, $2, $3)",
    [tableId, handNumber, JSON.stringify(state)]
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabaseSchema(): Promise<void> {
  const schemaPath = path.join(__dirname, "../db/schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const client = await pgPool.connect();
  try {
    await client.query(schemaSql);
    console.log("Database schema initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
    throw error;
  } finally {
    client.release();
  }
}
