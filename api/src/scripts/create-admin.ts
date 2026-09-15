import { eq, sql } from "drizzle-orm";
import { db, pool } from "../db/index.js";
import { auditLogs, user } from "../db/schema.js";
import { auth } from "../modules/auth/service/auth.service.js";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "PetID Admin";

if (!email || !password || password.length < 8) {
  console.error("Definí ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 8 caracteres).");
  process.exitCode = 1;
} else {
  try {
    let [existing] = await db
      .select()
      .from(user)
      .where(sql`lower(${user.email}) = ${email}`)
      .limit(1);

    if (!existing) {
      await auth.api.signUpEmail({ body: { email, password, name } });
      [existing] = await db
        .select()
        .from(user)
        .where(sql`lower(${user.email}) = ${email}`)
        .limit(1);
    }

    if (!existing) throw new Error("No se pudo crear la cuenta administrativa.");

    await db
      .update(user)
      .set({ role: "admin", emailVerified: true })
      .where(eq(user.id, existing.id));
    await db.insert(auditLogs).values({
      actorUserId: existing.id,
      action: "admin.access_granted",
      entityType: "user",
      entityId: existing.id,
      metadata: { email },
    });

    console.log(`Administrador listo: ${email}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
