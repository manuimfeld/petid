import type { FastifyInstance } from "fastify";
import {
  getMyPets,
  getPublicPetProfile,
  patchMyPet,
  postActivateQr,
  postActivationDraft,
  postMarkPetLost,
  postMarkPetRecovered,
} from "../controller/pet.controller.js";

export async function petRoutes(app: FastifyInstance) {
  app.get("/api/v1/pets/:id/public", getPublicPetProfile);
  app.post(
    "/api/v1/activation-drafts",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    postActivationDraft,
  );
  app.post(
    "/api/v1/qrs/:id/activate",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    postActivateQr,
  );
  app.get("/api/v1/me/pets", getMyPets);
  app.patch("/api/v1/me/pets/:id", patchMyPet);
  app.post("/api/v1/me/pets/:id/lost", postMarkPetLost);
  app.post("/api/v1/me/pets/:id/recovered", postMarkPetRecovered);
}
