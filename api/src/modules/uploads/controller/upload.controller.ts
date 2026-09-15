import type { FastifyReply, FastifyRequest } from "fastify";
import { getSession } from "../../auth/service/auth.service.js";
import { petImageSignatureSchema } from "../schemas/upload.schemas.js";
import {
  canUploadPetImage,
  createPetImageUploadSignature,
} from "../service/upload.service.js";

export async function postPetImageSignature(request: FastifyRequest, reply: FastifyReply) {
  const input = petImageSignatureSchema.safeParse(request.body);
  if (!input.success) {
    return reply.status(422).send({
      error: "VALIDATION_ERROR",
      details: input.error.flatten(),
    });
  }

  const session = await getSession(request);
  const permission = await canUploadPetImage(input.data.qrId, session?.user.id);
  if ("error" in permission) {
    const status = permission.error === "QR_NOT_FOUND"
      ? 404
      : permission.error === "UNAUTHORIZED"
        ? 401
        : 403;
    return reply.status(status).send({ error: permission.error });
  }

  const upload = createPetImageUploadSignature(input.data.qrId);
  if (!upload) return reply.status(503).send({ error: "IMAGE_STORAGE_UNAVAILABLE" });
  return upload;
}
