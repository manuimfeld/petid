import type { FastifyInstance } from "fastify";
import { getCurrentUser, handleAuthRequest } from "../controller/auth.controller.js";

export async function authRoutes(app: FastifyInstance) {
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    config: {
      rateLimit: { max: 20, timeWindow: "1 minute" },
    },
    handler: handleAuthRequest,
  });

  app.get("/api/v1/me", getCurrentUser);
}
