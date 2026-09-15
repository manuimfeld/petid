import { and, eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../../db/index.js";
import {
  activationDrafts,
  auditLogs,
  availableQrs,
  pets,
  qrScans,
} from "../../../db/schema.js";
import { sha256 } from "../../../shared/security/security.js";
import {
  deletePetImage,
  petImageUrl,
  validatePetImage,
} from "../../uploads/service/upload.service.js";
import type { EditPetInput, PetInput } from "../schemas/pet.schemas.js";

export interface ScanData {
  ipHash: string;
  userAgent?: string;
  referrer?: string;
}

export async function getPublicPet(qrId: string) {
  const [qr] = await db
    .select()
    .from(availableQrs)
    .where(eq(availableQrs.id, qrId))
    .limit(1);

  if (!qr) return { state: "not_found" as const };
  if (qr.status === "disabled") return { state: "disabled" as const };
  if (qr.status !== "activated") {
    return { state: "available" as const, id: qr.id };
  }

  const [pet] = await db.select().from(pets).where(eq(pets.id, qr.id)).limit(1);
  if (!pet) return { state: "inconsistent" as const };

  return {
    state: "activated" as const,
    pet: {
      id: pet.id,
      name: pet.name,
      description: pet.description,
      imageUrl: pet.imageKey ? petImageUrl(pet.imageKey) : pet.imageUrl,
      address: pet.address,
      province: pet.province,
      locality: pet.locality,
      street: pet.street,
      streetNumber: pet.streetNumber,
      googlePlaceId: pet.googlePlaceId,
      latitude: pet.latitude,
      longitude: pet.longitude,
      whatsapp: pet.whatsapp,
      status: pet.status,
      lostAt: pet.lostAt,
      recoveredAt: pet.recoveredAt,
    },
  };
}

export async function recordQrScan(qrId: string, scan: ScanData) {
  await db.insert(qrScans).values({ qrId, ...scan });
}

export async function createActivationDraft(input: PetInput) {
  const [qr] = await db
    .select({ id: availableQrs.id, status: availableQrs.status })
    .from(availableQrs)
    .where(eq(availableQrs.id, input.qrId))
    .limit(1);

  if (!qr) return { error: "QR_NOT_FOUND" as const };
  if (qr.status !== "available") return { error: "QR_NOT_AVAILABLE" as const };

  let imageKey: string | undefined;
  if (input.imageKey) {
    const image = await validatePetImage(input.qrId, input.imageKey);
    if ("error" in image) return image;
    imageKey = image.imageKey;
  }

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db.insert(activationDrafts).values({
    qrId: input.qrId,
    temporaryTokenHash: sha256(token),
    name: input.name,
    description: input.description,
    address: input.address,
    province: input.province,
    locality: input.locality,
    street: input.street,
    streetNumber: input.streetNumber,
    googlePlaceId: input.googlePlaceId,
    latitude: input.latitude?.toString(),
    longitude: input.longitude?.toString(),
    whatsapp: input.whatsapp,
    imageKey,
    expiresAt,
  });

  return { draftToken: token, expiresAt };
}

export async function activatePet(qrId: string, draftToken: string, ownerId: string) {
  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(activationDrafts)
      .where(
        and(
          eq(activationDrafts.qrId, qrId),
          eq(activationDrafts.temporaryTokenHash, sha256(draftToken)),
          gt(activationDrafts.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!draft) return { error: "DRAFT_NOT_FOUND" as const };

    const [claimed] = await tx
      .update(availableQrs)
      .set({ status: "activated", activatedAt: new Date() })
      .where(and(eq(availableQrs.id, qrId), eq(availableQrs.status, "available")))
      .returning({ id: availableQrs.id });

    if (!claimed) return { error: "QR_NOT_AVAILABLE" as const };

    const [pet] = await tx
      .insert(pets)
      .values({
        id: qrId,
        ownerId,
        name: draft.name,
        description: draft.description,
        address: draft.address,
        province: draft.province,
        locality: draft.locality,
        street: draft.street,
        streetNumber: draft.streetNumber,
        googlePlaceId: draft.googlePlaceId,
        latitude: draft.latitude,
        longitude: draft.longitude,
        whatsapp: draft.whatsapp,
        imageKey: draft.imageKey,
        imageUrl: draft.imageKey ? petImageUrl(draft.imageKey) : null,
      })
      .returning();

    await tx.delete(activationDrafts).where(eq(activationDrafts.id, draft.id));
    await tx.insert(auditLogs).values({
      actorUserId: ownerId,
      action: "pet.activated",
      entityType: "pet",
      entityId: qrId,
    });

    return { pet };
  });
}

export async function listOwnedPets(ownerId: string) {
  return db.select().from(pets).where(eq(pets.ownerId, ownerId));
}

export async function updateOwnedPet(
  petId: string,
  ownerId: string,
  input: EditPetInput,
) {
  const [currentPet] = await db
    .select({ imageKey: pets.imageKey })
    .from(pets)
    .where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)))
    .limit(1);
  if (!currentPet) return null;

  let nextImage:
    | { imageKey: string; imageUrl: string }
    | undefined;
  if (input.imageKey) {
    const image = await validatePetImage(petId, input.imageKey);
    if ("error" in image) return image;
    nextImage = image;
  }

  const values = {
    ...input,
    latitude: input.latitude?.toString(),
    longitude: input.longitude?.toString(),
    ...(nextImage ?? {}),
  };
  const [pet] = await db
    .update(pets)
    .set(values)
    .where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)))
    .returning();

  if (pet) {
    await db.insert(auditLogs).values({
      actorUserId: ownerId,
      action: "pet.updated",
      entityType: "pet",
      entityId: petId,
      metadata: { fields: Object.keys(input) },
    });
    if (nextImage && currentPet.imageKey && currentPet.imageKey !== nextImage.imageKey) {
      void deletePetImage(currentPet.imageKey);
    }
  }

  return pet;
}

export async function changePetStatus(
  petId: string,
  ownerId: string,
  nextStatus: "lost" | "active",
) {
  const action = nextStatus === "lost" ? "lost" : "recovered";
  const now = new Date();
  const [pet] = await db
    .update(pets)
    .set(
      nextStatus === "lost"
        ? { status: "lost", lostAt: now, recoveredAt: null }
        : { status: "active", recoveredAt: now },
    )
    .where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)))
    .returning();

  if (pet) {
    await db.insert(auditLogs).values({
      actorUserId: ownerId,
      action: `pet.${action}`,
      entityType: "pet",
      entityId: petId,
    });
  }

  return pet;
}
