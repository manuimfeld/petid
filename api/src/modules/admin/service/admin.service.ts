import { count, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../../db/index.js";
import { auditLogs, availableQrs, pets, qrScans, user } from "../../../db/schema.js";
import type { AdminListQuery, CreateQrBatchInput, ListQrsQuery } from "../schemas/admin.schemas.js";

export async function listQrs({ status, limit }: ListQrsQuery) {
  if (status) {
    return db
      .select()
      .from(availableQrs)
      .where(eq(availableQrs.status, status))
      .orderBy(desc(availableQrs.createdAt))
      .limit(limit);
  }

  return db
    .select()
    .from(availableQrs)
    .orderBy(desc(availableQrs.createdAt))
    .limit(limit);
}

export async function createQrBatch(input: CreateQrBatchInput, actorUserId: string) {
  const batch = input.batch ?? `petid-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}`;

  return db.transaction(async (tx) => {
    const created: (typeof availableQrs.$inferSelect)[] = [];
    while (created.length < input.quantity) {
      const rows = Array.from({ length: input.quantity - created.length }, () => ({
        id: nanoid(12),
        batch,
      }));
      const inserted = await tx
        .insert(availableQrs)
        .values(rows)
        .onConflictDoNothing()
        .returning();
      created.push(...inserted);
    }

    await tx.insert(auditLogs).values({
      actorUserId,
      action: "qr.batch_created",
      entityType: "qr_batch",
      entityId: batch,
      metadata: { quantity: created.length },
    });

    return { batch, qrs: created };
  });
}

export async function getQrMetrics() {
  const [qrs, userRows, petRows, scanRows, scansByDay] = await Promise.all([
    db
    .select({ status: availableQrs.status, total: count() })
    .from(availableQrs)
    .groupBy(availableQrs.status),
    db.select({ total: count() }).from(user),
    db.select({
      total: count(),
      lost: sql<number>`count(*) filter (where ${pets.status} = 'lost')::int`,
    }).from(pets),
    db.select({ total: count() }).from(qrScans),
    db.select({
      day: sql<string>`to_char(date_trunc('day', ${qrScans.scannedAt}), 'YYYY-MM-DD')`,
      total: count(),
    })
      .from(qrScans)
      .where(sql`${qrScans.scannedAt} >= now() - interval '6 days'`)
      .groupBy(sql`date_trunc('day', ${qrScans.scannedAt})`)
      .orderBy(sql`date_trunc('day', ${qrScans.scannedAt})`),
  ]);
  const users = userRows[0];
  const petTotals = petRows[0];
  const scanTotals = scanRows[0];

  return {
    qrs,
    totals: {
      users: users?.total ?? 0,
      pets: petTotals?.total ?? 0,
      lostPets: petTotals?.lost ?? 0,
      scans: scanTotals?.total ?? 0,
      qrs: qrs.reduce((sum, item) => sum + Number(item.total), 0),
    },
    scansByDay,
  };
}

export async function listQrBatches({ limit }: AdminListQuery) {
  return db
    .select({
      batch: availableQrs.batch,
      total: count(),
      available: sql<number>`count(*) filter (where ${availableQrs.status} = 'available')::int`,
      activated: sql<number>`count(*) filter (where ${availableQrs.status} = 'activated')::int`,
      createdAt: sql<Date>`min(${availableQrs.createdAt})`,
    })
    .from(availableQrs)
    .where(sql`${availableQrs.batch} is not null`)
    .groupBy(availableQrs.batch)
    .orderBy(desc(sql`min(${availableQrs.createdAt})`))
    .limit(limit);
}

export async function listAuditLogs({ limit }: AdminListQuery) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actor: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(auditLogs)
    .leftJoin(user, eq(auditLogs.actorUserId, user.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function recordAdminAction(
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await db.insert(auditLogs).values({
    actorUserId,
    action,
    entityType,
    entityId,
    metadata,
  });
}
