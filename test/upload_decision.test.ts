import assert from "node:assert/strict";
import test from "node:test";
import { planMediaUpload, startUploadBody } from "../src/upload_decision.js";

test("a large work-order photo becomes three upload parts and blocks dispatch", () => {
  const input = startUploadBody.parse({
    workOrderId: "WO 1042",
    technicianId: "TECH/17",
    mediaId: "arrival photo",
    filename: "compressor panel.jpg",
    contentType: "image/jpeg",
    sizeBytes: 11_000_000,
  });

  assert.deepEqual(planMediaUpload(input, 5_000_000), {
    objectKey:
      "work-orders/WO_1042/technicians/TECH_17/arrival_photo-compressor_panel.jpg",
    partCount: 3,
    dispatchStatus: "awaiting_media_upload",
    technicianFollowUp: "upload_all_parts",
  });
});

test("the request boundary rejects non-media content", () => {
  const result = startUploadBody.safeParse({
    workOrderId: "WO-1042",
    technicianId: "TECH-17",
    mediaId: "notes",
    filename: "notes.txt",
    contentType: "text/plain",
    sizeBytes: 42,
  });

  assert.equal(result.success, false);
});
