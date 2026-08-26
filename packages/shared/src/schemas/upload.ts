import { z } from 'zod';
import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES } from '../constants';
import { AssetKind } from '../enums';

export const presignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ACCEPTED_MIME_TYPES, {
    errorMap: () => ({ message: 'Upload a PDF, PNG, JPG or HEIC file' }),
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, 'File must be 10MB or smaller'),
  kind: z.nativeEnum(AssetKind),
});
export type PresignRequest = z.infer<typeof presignRequestSchema>;

export const presignResponseSchema = z.object({
  assetId: z.string(),
  storageKey: z.string(),
  uploadUrl: z.string().url(),
  expiresInSeconds: z.number().int(),
  /** Headers the browser MUST replay on the PUT or the signature will not match. */
  requiredHeaders: z.record(z.string()),
});
export type PresignResponse = z.infer<typeof presignResponseSchema>;

/** Called after the browser's PUT succeeds, to promote the asset to "uploaded". */
export const confirmUploadSchema = z.object({
  assetId: z.string(),
  pageCount: z.number().int().positive().optional(),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const assetSchema = z.object({
  id: z.string(),
  kind: z.nativeEnum(AssetKind),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  pageCount: z.number().int().nullable(),
  storageKey: z.string(),
  uploaded: z.boolean(),
  createdAt: z.string(),
});
export type Asset = z.infer<typeof assetSchema>;
