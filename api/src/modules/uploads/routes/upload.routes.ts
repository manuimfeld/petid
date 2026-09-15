import type { FastifyInstance } from "fastify";
import { postPetImageSignature } from "../controller/upload.controller.js";

export async function uploadRoutes(app: FastifyInstance) {
  app.post(
    "/api/v1/uploads/pet-images/signature",
    { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } },
    postPetImageSignature,
  );
}
