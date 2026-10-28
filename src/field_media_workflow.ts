import { infrai } from "./infrai_storage.js";
import {
  completeUploadBody,
  planMediaUpload,
  startUploadBody,
} from "./upload_decision.js";

export const FIELD_MEDIA_BUCKET = "field-service-media";

export async function startFieldMediaUpload(body: unknown) {
  const input = startUploadBody.parse(body);
  const provisionalKey = planMediaUpload(input, 1).objectKey;
  const upload = await infrai.storage.multipart.create(
    FIELD_MEDIA_BUCKET,
    provisionalKey,
    input.contentType,
  );
  const decision = planMediaUpload(input, upload.part_size_min);

  if (decision.partCount > upload.part_count_max) {
    throw new RangeError("The media requires more parts than this upload can accept.");
  }

  const parts = await Promise.all(
    Array.from({ length: decision.partCount }, (_, index) =>
      infrai.storage.multipart.presign_part(upload.upload_id, index + 1),
    ),
  );

  return {
    workOrderId: input.workOrderId,
    mediaId: input.mediaId,
    uploadId: upload.upload_id,
    objectKey: decision.objectKey,
    partSizeBytes: upload.part_size_min,
    dispatchStatus: decision.dispatchStatus,
    technicianFollowUp: decision.technicianFollowUp,
    parts: parts.map((part, index) => ({
      partNumber: index + 1,
      uploadUrl: part.url,
      method: part.method,
      expiresAt: part.expires_at,
    })),
  };
}

export async function completeFieldMediaUpload(body: unknown) {
  const input = completeUploadBody.parse(body);
  const object = await infrai.storage.multipart.complete(
    input.uploadId,
    [...input.parts]
      .sort((left, right) => left.partNumber - right.partNumber)
      .map(({ partNumber, etag }) => ({
        part_number: partNumber,
        etag,
      })),
  );

  return {
    workOrderId: input.workOrderId,
    technicianId: input.technicianId,
    mediaId: input.mediaId,
    objectKey: object.key,
    sizeBytes: object.size_bytes,
    dispatchStatus: "ready_for_dispatch" as const,
    technicianFollowUp: "confirm_photo_with_customer" as const,
  };
}
