import { z } from "zod";
import { normalizeWhatsapp } from "../../../shared/security/security.js";

export const qrIdSchema = z.string().length(12).regex(/^[A-Za-z0-9_-]+$/);

export const petInputSchema = z.object({
  qrId: qrIdSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional(),
  address: z.string().trim().min(5).max(300),
  googlePlaceId: z.string().trim().min(3).max(255),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  whatsapp: z.string().transform(normalizeWhatsapp).pipe(z.string().min(8).max(20)),
  imageKey: z.string().max(500).optional(),
  acceptsPublicData: z.literal(true),
});

export const editPetSchema = petInputSchema
  .omit({ qrId: true, acceptsPublicData: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")
  .superRefine((value, context) => {
    const locationFields = [value.address, value.googlePlaceId, value.latitude, value.longitude];
    const supplied = locationFields.filter((field) => field !== undefined).length;
    if (supplied !== 0 && supplied !== locationFields.length) {
      context.addIssue({
        code: "custom",
        path: ["address"],
        message: "Address, Google Place ID, latitude and longitude must be updated together",
      });
    }
  });

export const activateQrSchema = z.object({
  draftToken: z.string().min(20).max(100),
});

export type PetInput = z.infer<typeof petInputSchema>;
export type EditPetInput = z.infer<typeof editPetSchema>;
