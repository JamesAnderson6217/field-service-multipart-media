import { z } from "zod";

export const startUploadBody = z.object({
  workOrderId: z.string().trim().min(1).max(80),
  technicianId: z.string().trim().min(1).max(80),
  mediaId: z.string().trim().min(1).max(80),
  filename: z.string().trim().min(1).max(160),
  contentType: z.string().regex(/^(image|video)\/[a-z0-9.+-]+$/i),
  sizeBytes: z.number().int().positive(),
});

export const completeUploadBody = z.object({
  workOrderId: z.string().trim().min(1).max(80),
  technicianId: z.string().trim().min(1).max(80),
  mediaId: z.string().trim().min(1).max(80),
  uploadId: z.string().trim().min(1),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        etag: z.string().trim().min(1),
      }),
    )
    .min(1)
    .refine(
      (parts) => new Set(parts.map((part) => part.partNumber)).size === parts.length,
      "Part numbers must be unique.",
    ),
});

export type StartUploadInput = z.infer<typeof startUploadBody>;

function keySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function planMediaUpload(input: StartUploadInput, partSizeMin: number) {
  const partCount = Math.ceil(input.sizeBytes / partSizeMin);
  return {
    objectKey: [
      "work-orders",
      keySegment(input.workOrderId),
      "technicians",
      keySegment(input.technicianId),
      `${keySegment(input.mediaId)}-${keySegment(input.filename)}`,
    ].join("/"),
    partCount,
    dispatchStatus: "awaiting_media_upload" as const,
    technicianFollowUp: "upload_all_parts" as const,
  };
}
