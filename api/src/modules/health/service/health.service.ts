import { sql } from "drizzle-orm";
import { db } from "../../../db/index.js";

export async function checkDatabaseConnection() {
  await db.execute(sql`select 1`);
  return { status: "ok" as const, database: "connected" as const };
}
