import { z } from "zod";

export const listQrsQuerySchema = z.object({
  status: z.enum(["available", "reserved", "activated", "disabled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createQrBatchSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(500).default(100),
  batch: z.string().trim().min(1).max(80).optional(),
});

export const qrBatchParamsSchema = z.object({
  batch: z.string().trim().min(1).max(80),
});

export const adminListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListQrsQuery = z.infer<typeof listQrsQuerySchema>;
export type CreateQrBatchInput = z.infer<typeof createQrBatchSchema>;
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
