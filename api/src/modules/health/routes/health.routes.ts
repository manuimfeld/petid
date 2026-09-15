import type { FastifyInstance } from "fastify";
import { getHealth } from "../controller/health.controller.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", getHealth);
}
