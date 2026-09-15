import { nanoid } from "nanoid";
import { db, pool } from "./index.js";
import { availableQrs } from "./schema.js";

const TEST_QR_IDS = ["PETIDTEST001", "PETIDTEST002", "PETIDTEST003"];

async function seed() {
  await db
    .insert(availableQrs)
    .values([
      ...TEST_QR_IDS.map((id) => ({ id, batch: "local-demo" })),
      { id: nanoid(12), batch: "local-generated" },
    ])
    .onConflictDoNothing();

  console.log("Seed complete. Test available QRs:", TEST_QR_IDS.join(", "));
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
