import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyError } from "fastify";
import { env, trustedOrigins } from "./config.js";
import { adminRoutes } from "./modules/admin/routes/admin.routes.js";
import { authRoutes } from "./modules/auth/routes/auth.routes.js";
import { healthRoutes } from "./modules/health/routes/health.routes.js";
import { petRoutes } from "./modules/pets/routes/pet.routes.js";
import { uploadRoutes } from "./modules/uploads/routes/upload.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 1_000_000,
    trustProxy: env.NODE_ENV === "production",
    requestTimeout: 15_000,
  });

  await app.register(cors, {
    origin: trustedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(petRoutes);
  await app.register(uploadRoutes);
  await app.register(adminRoutes);

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ error: "NOT_FOUND" });
  });
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ error }, "Unhandled request error");
    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : error.code ?? "REQUEST_ERROR",
    });
  });

  return app;
}
