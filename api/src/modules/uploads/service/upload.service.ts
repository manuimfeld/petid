import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { v2 as cloudinary } from "cloudinary";
import { cloudinaryEnabled, env } from "../../../config.js";
import { db } from "../../../db/index.js";
import { availableQrs, pets } from "../../../db/schema.js";

const allowedFormats = new Set(["jpg", "jpeg", "png", "webp"]);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
    signature_algorithm: "sha256",
  });
}

export async function canUploadPetImage(qrId: string, userId?: string) {
  const [qr] = await db
    .select({ status: availableQrs.status })
    .from(availableQrs)
    .where(eq(availableQrs.id, qrId))
    .limit(1);

  if (!qr) return { error: "QR_NOT_FOUND" as const };
  if (qr.status === "available") return { allowed: true as const };
  if (qr.status !== "activated") return { error: "QR_NOT_AVAILABLE" as const };
  if (!userId) return { error: "UNAUTHORIZED" as const };

  const [pet] = await db
    .select({ id: pets.id })
    .from(pets)
    .where(and(eq(pets.id, qrId), eq(pets.ownerId, userId)))
    .limit(1);

  return pet ? { allowed: true as const } : { error: "FORBIDDEN" as const };
}

export function createPetImageUploadSignature(qrId: string) {
  if (!cloudinaryEnabled) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${env.CLOUDINARY_FOLDER}/${qrId}/${nanoid(16)}`;
  const params = {
    timestamp,
    public_id: publicId,
    upload_preset: env.CLOUDINARY_UPLOAD_PRESET,
  };
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET!);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: env.CLOUDINARY_API_KEY!,
    signature,
    params,
    maxBytes: env.MAX_IMAGE_BYTES,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  };
}

export function petImageUrl(publicId: string) {
  if (!cloudinaryEnabled) return null;
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 1200, height: 1200, crop: "limit" },
      { quality: "auto:good", fetch_format: "auto" },
    ],
  });
}

export async function validatePetImage(qrId: string, publicId: string) {
  if (!cloudinaryEnabled) return { error: "IMAGE_STORAGE_UNAVAILABLE" as const };
  if (!publicId.startsWith(`${env.CLOUDINARY_FOLDER}/${qrId}/`)) {
    return { error: "INVALID_IMAGE" as const };
  }

  try {
    const resource = await cloudinary.api.resource(publicId, { resource_type: "image" });
    if (
      resource.resource_type !== "image" ||
      !allowedFormats.has(String(resource.format).toLowerCase()) ||
      Number(resource.bytes) > env.MAX_IMAGE_BYTES
    ) {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
      return { error: "INVALID_IMAGE" as const };
    }

    return { imageKey: publicId, imageUrl: petImageUrl(publicId)! };
  } catch {
    return { error: "INVALID_IMAGE" as const };
  }
}

export async function deletePetImage(publicId: string) {
  if (!cloudinaryEnabled || !publicId.startsWith(`${env.CLOUDINARY_FOLDER}/`)) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  } catch (error) {
    console.error("[cloudinary] Could not delete replaced pet image", error);
  }
}
