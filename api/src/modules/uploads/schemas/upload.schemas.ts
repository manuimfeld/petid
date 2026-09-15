import { z } from "zod";

export const petImageSignatureSchema = z.object({
  qrId: z.string().length(12).regex(/^[A-Za-z0-9_-]+$/),
});

export type PetImageSignatureInput = z.infer<typeof petImageSignatureSchema>;
