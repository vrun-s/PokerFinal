import { Redis } from "ioredis";
import { config } from "../config.js";
import { TableState, createTable } from "@poker-platform/poker-core";

export const redisClient = new Redis(config.REDIS_URL, {
  lazyConnect: true,
});

export async function seedStaticTables(): Promise<void> {
  const defaultTableConfig = {
    maxSeats: 6 as const,
    minBuyIn: 100,
    maxBuyIn: 1000,
    smallBlind: 10,
    bigBlind: 20,
  };

  const initialTable = createTable(defaultTableConfig);
  const staticTables = ["table:1", "table:2"];

  for (const key of staticTables) {
    const exists = await redisClient.exists(key);
    if (!exists) {
      await redisClient.set(key, JSON.stringify(initialTable));
    }
  }
}

export async function getTableState(tableId: string): Promise<TableState | null> {
  const data = await redisClient.get(`table:${tableId}`);
  if (!data) return null;
  return JSON.parse(data) as TableState;
}

export async function saveTableState(tableId: string, state: TableState): Promise<void> {
  await redisClient.set(`table:${tableId}`, JSON.stringify(state));
}
