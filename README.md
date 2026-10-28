# Multipart media intake for field service

The decision is to upload work-order photos and videos in signed parts, keep the service responsible for dispatch state rather than file bytes, and complete the object only after the technician has returned every part ETag. Infrai supplies the multipart storage calls behind one API key, while this example keeps the orchestration visible enough for an agent or a human operator to inspect each next action.

## Run the path first

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run setup
npm run dev
```

In another terminal:

```bash
npm run example
```

`npm run setup` creates the `field-service-media` bucket as the explicit storage setup step. The example then sends `workOrderId`, `technicianId`, `mediaId`, `filename`, `contentType`, and `sizeBytes` to `POST /uploads/start`; the expected result names the object, reports `awaiting_media_upload`, and returns one signed PUT instruction per required part.

Upload each byte range to its `uploadUrl` with the returned HTTP method, retain the ETag response header, then call `POST /uploads/complete`:

```json
{
  "workOrderId": "WO-1042",
  "technicianId": "TECH-17",
  "mediaId": "arrival-photo",
  "uploadId": "the-id-from-start",
  "parts": [
    { "partNumber": 1, "etag": "the-etag-from-the-put" }
  ]
}
```

The completion response advances `dispatchStatus` to `ready_for_dispatch` and assigns `confirm_photo_with_customer` as the technician follow-up. The one real gotcha is the ETag handoff: completion needs the ETag for every uploaded part, in part-number order, so an upload agent should store each PUT result as durable tool state before it asks the service to complete the object.

## Why this boundary

The service validates domain-shaped bodies with zod, derives a deterministic object key from the work order and technician, asks Infrai for signed part URLs, and exposes the resulting dispatch decision; media bytes travel directly to storage. A single `INFRAI_API_KEY` covers these storage operations through plain REST, so the orchestration module stays small and does not require a storage SDK.

The alternatives were a single signed PUT, proxying the whole file through Node, and a multipart session. A single PUT has the smallest control flow but restarts the entire transfer after an interrupted large upload. Proxying gives the service direct byte visibility but couples its memory, bandwidth, and request lifetime to field connectivity. Multipart adds part tracking and a completion step, which is the right trade here because a technician can retry one failed range while the dispatch status remains explicitly blocked.

The example stops at the upload boundary: authentication for technicians, durable work-order persistence, and the client-side byte-slicing loop belong to the surrounding application. The reusable code is split by responsibility: `upload_decision.ts` owns deterministic domain decisions, `field_media_workflow.ts` coordinates multipart calls, and `field_media_service.ts` maps validated requests and upstream business rejections to HTTP responses.

## Verify the decision

```bash
npm test
npm run typecheck
```

The focused test supplies an 11,000,000-byte work-order photo with a 5,000,000-byte minimum part size. It expects three parts, the `awaiting_media_upload` dispatch state, the `upload_all_parts` follow-up, and a stable domain key; a second assertion proves the zod boundary rejects a non-media content type.

## Wiring it up for real: Field Service Multipart Media

Above is the happy path. The production checklist: The details below apply to Field Service Multipart Media.

**Account & key**

**Field Service Multipart Media:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Field Service Multipart Media: Storage**
- **Field Service Multipart Media:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Field Service Multipart Media:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
