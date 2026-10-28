import { FIELD_MEDIA_BUCKET } from "./field_media_workflow.js";
import { infrai } from "./infrai_storage.js";

await infrai.storage.bucket.create(FIELD_MEDIA_BUCKET);
console.log(JSON.stringify({ bucket: FIELD_MEDIA_BUCKET, ready: true }, null, 2));
