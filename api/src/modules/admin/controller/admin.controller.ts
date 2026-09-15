import type { FastifyReply, FastifyRequest } from "fastify";
import { getSession } from "../../auth/service/auth.service.js";
import {
  adminListQuerySchema,
  createQrBatchSchema,
  listQrsQuerySchema,
  qrBatchParamsSchema,
} from "../schemas/admin.schemas.js";
import {
  createQrBatch,
  getQrMetrics,
  listAuditLogs,
  listQrBatches,
  listQrs,
  recordAdminAction,
} from "../service/admin.service.js";
import { createQrSvgArchive } from "../service/qr-export.service.js";

async function getAdminSession(request: FastifyRequest, reply: FastifyReply) {
  const session = await getSession(request);
  if (!session) {
    reply.status(401).send({ error: "UNAUTHORIZED" });
    return null;
  }
  if (session.user.role !== "admin") {
    reply.status(403).send({ error: "FORBIDDEN" });
    return null;
  }
  return session;
}

export async function getQrs(request: FastifyRequest, reply: FastifyReply) {
  const session = await getAdminSession(request, reply);
  if (!session) return;

  const query = listQrsQuerySchema.safeParse(request.query);
  if (!query.success) {
    return reply.status(422).send({
      error: "VALIDATION_ERROR",
      details: query.error.flatten(),
    });
  }

  return { qrs: await listQrs(query.data) };
}

export async function postQrBatch(request: FastifyRequest, reply: FastifyReply) {
  const session = await getAdminSession(request, reply);
  if (!session) return;

  const input = createQrBatchSchema.safeParse(request.body ?? {});
  if (!input.success) {
    return reply.status(422).send({
      error: "VALIDATION_ERROR",
      details: input.error.flatten(),
    });
  }

  const result = await createQrBatch(input.data, session.user.id);
  return reply.status(201).send({
    batch: result.batch,
    quantity: result.qrs.length,
    qrs: result.qrs,
  });
}

export async function getMetrics(request: FastifyRequest, reply: FastifyReply) {
  const session = await getAdminSession(request, reply);
  if (!session) return;
  return await getQrMetrics();
}

export async function getQrBatches(request: FastifyRequest, reply: FastifyReply) {
  const session = await getAdminSession(request, reply);
  if (!session) return;
  const query = adminListQuerySchema.safeParse(request.query);
  if (!query.success) return reply.status(422).send({ error: "VALIDATION_ERROR" });
  return { batches: await listQrBatches(query.data) };
}

export async function getAuditLogs(request: FastifyRequest, reply: FastifyReply) {
  const session = await getAdminSession(request, reply);
  if (!session) return;
  const query = adminListQuerySchema.safeParse(request.query);
  if (!query.success) return reply.status(422).send({ error: "VALIDATION_ERROR" });
  return { logs: await listAuditLogs(query.data) };
}

export async function downloadQrBatchSvgs(request: FastifyRequest, reply: FastifyReply) {
  const session = await getAdminSession(request, reply);
  if (!session) return;
  const params = qrBatchParamsSchema.safeParse(request.params);
  if (!params.success) return reply.status(422).send({ error: "VALIDATION_ERROR" });
  const archive = await createQrSvgArchive(params.data.batch);
  if (!archive) return reply.status(404).send({ error: "QR_BATCH_NOT_FOUND" });
  await recordAdminAction(
    session.user.id,
    "qr.svg_exported",
    "qr_batch",
    params.data.batch,
    { quantity: archive.quantity },
  );
  const filename = params.data.batch.replace(/[^a-zA-Z0-9_-]/g, "-");
  return reply
    .header("Content-Type", "application/zip")
    .header("Content-Disposition", `attachment; filename="petid-${filename}-svg.zip"`)
    .header("X-PetID-QR-Count", archive.quantity)
    .send(archive.buffer);
}
