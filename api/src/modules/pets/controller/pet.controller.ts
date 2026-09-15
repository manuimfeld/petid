import type { FastifyReply, FastifyRequest } from "fastify";
import { getSession } from "../../auth/service/auth.service.js";
import { hashIp } from "../../../shared/security/security.js";
import {
  activateQrSchema,
  editPetSchema,
  petInputSchema,
  qrIdSchema,
} from "../schemas/pet.schemas.js";
import {
  activatePet,
  changePetStatus,
  createActivationDraft,
  getPublicPet,
  listOwnedPets,
  recordQrScan,
  updateOwnedPet,
} from "../service/pet.service.js";

function validationError(reply: FastifyReply, details: unknown) {
  return reply.status(422).send({ error: "VALIDATION_ERROR", details });
}

function parsePetId(request: FastifyRequest, reply: FastifyReply) {
  const parsed = qrIdSchema.safeParse((request.params as { id: string }).id);
  if (!parsed.success) {
    validationError(reply, parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

export async function getPublicPetProfile(request: FastifyRequest, reply: FastifyReply) {
  const id = parsePetId(request, reply);
  if (!id) return;

  const result = await getPublicPet(id);
  if (result.state === "not_found") {
    return reply.status(404).send({ error: "QR_NOT_FOUND" });
  }
  if (result.state === "disabled") {
    return reply.status(410).send({ state: "disabled" });
  }

  void recordQrScan(id, {
    ipHash: hashIp(request.ip),
    userAgent: request.headers["user-agent"]?.slice(0, 500),
    referrer: request.headers.referer?.slice(0, 500),
  }).catch((error) => request.log.warn({ error }, "Could not record QR scan"));

  if (result.state === "inconsistent") {
    request.log.error({ qrId: id }, "Activated QR has no pet");
    return reply.status(500).send({ error: "INCONSISTENT_QR_STATE" });
  }
  if (result.state === "available") {
    return { state: "available", id: result.id };
  }
  return { state: "activated", pet: result.pet };
}

export async function postActivationDraft(request: FastifyRequest, reply: FastifyReply) {
  const input = petInputSchema.safeParse(request.body);
  if (!input.success) return validationError(reply, input.error.flatten());

  const result = await createActivationDraft(input.data);
  if ("error" in result) {
    const status = result.error === "QR_NOT_FOUND"
      ? 404
      : result.error === "IMAGE_STORAGE_UNAVAILABLE"
        ? 503
        : result.error === "INVALID_IMAGE"
          ? 422
          : 409;
    return reply.status(status).send({ error: result.error });
  }
  return reply.status(201).send(result);
}

export async function postActivateQr(request: FastifyRequest, reply: FastifyReply) {
  const session = await getSession(request);
  if (!session) return reply.status(401).send({ error: "UNAUTHORIZED" });

  const id = parsePetId(request, reply);
  if (!id) return;
  const body = activateQrSchema.safeParse(request.body);
  if (!body.success) return validationError(reply, body.error.flatten());

  const result = await activatePet(id, body.data.draftToken, session.user.id);
  if ("error" in result) {
    const status = result.error === "DRAFT_NOT_FOUND" ? 404 : 409;
    return reply.status(status).send({ error: result.error });
  }
  return reply.status(201).send(result);
}

export async function getMyPets(request: FastifyRequest, reply: FastifyReply) {
  const session = await getSession(request);
  if (!session) return reply.status(401).send({ error: "UNAUTHORIZED" });
  return { pets: await listOwnedPets(session.user.id) };
}

export async function patchMyPet(request: FastifyRequest, reply: FastifyReply) {
  const session = await getSession(request);
  if (!session) return reply.status(401).send({ error: "UNAUTHORIZED" });

  const id = parsePetId(request, reply);
  if (!id) return;
  const input = editPetSchema.safeParse(request.body);
  if (!input.success) return validationError(reply, input.error.flatten());

  const pet = await updateOwnedPet(id, session.user.id, input.data);
  if (!pet) return reply.status(404).send({ error: "PET_NOT_FOUND" });
  if ("error" in pet) {
    const status = pet.error === "IMAGE_STORAGE_UNAVAILABLE" ? 503 : 422;
    return reply.status(status).send({ error: pet.error });
  }
  return { pet };
}

async function updateStatus(
  request: FastifyRequest,
  reply: FastifyReply,
  status: "lost" | "active",
) {
  const session = await getSession(request);
  if (!session) return reply.status(401).send({ error: "UNAUTHORIZED" });

  const id = parsePetId(request, reply);
  if (!id) return;
  const pet = await changePetStatus(id, session.user.id, status);
  if (!pet) return reply.status(404).send({ error: "PET_NOT_FOUND" });
  return { pet };
}

export function postMarkPetLost(request: FastifyRequest, reply: FastifyReply) {
  return updateStatus(request, reply, "lost");
}

export function postMarkPetRecovered(request: FastifyRequest, reply: FastifyReply) {
  return updateStatus(request, reply, "active");
}
