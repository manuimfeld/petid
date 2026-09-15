import type { FastifyInstance } from "fastify";
import {
  downloadQrBatchSvgs,
  getAuditLogs,
  getMetrics,
  getQrBatches,
  getQrs,
  postQrBatch,
} from "../controller/admin.controller.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/api/v1/admin/qrs", getQrs);
  app.get("/api/v1/admin/qrs/batches", getQrBatches);
  app.get("/api/v1/admin/qrs/batches/:batch/svg", downloadQrBatchSvgs);
  app.post(
    "/api/v1/admin/qrs/batches",
    { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } },
    postQrBatch,
  );
  app.post(
    "/api/v1/admin/qrs/generate",
    { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } },
    postQrBatch,
  );
  app.get("/api/v1/admin/metrics", getMetrics);
  app.get("/api/v1/admin/audit-logs", getAuditLogs);
}
