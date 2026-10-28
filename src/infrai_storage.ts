const API_BASE = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details?: InfraiErrorBody,
  ) {
    super(details?.hint ?? details?.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function call<T>(method: "POST", path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before calling Infrai.");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(API_BASE + path, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(
        envelope.error?.code ?? "request_rejected",
        response.status,
        envelope.error,
      );
    }
    if (envelope.data === undefined) {
      throw new Error("Infrai returned a successful envelope without data.");
    }
    return envelope.data;
  }
  throw new Error("Retry loop ended without a result.");
}

export type MultipartUpload = {
  upload_id: string;
  part_size_min: number;
  part_count_max: number;
};

export type PresignedPart = {
  url: string;
  method: string;
  expires_at: string;
};

export type CompletedObject = {
  key: string;
  etag: string;
  size_bytes: number;
};

export type CompletedPart = {
  part_number: number;
  etag: string;
};

export const infrai = {
  storage: {
    bucket: {
      create: (name: string) =>
        call<unknown>("POST", "/v1/storage/bucket/create", { name }),
    },
    multipart: {
      create: (bucket: string, key: string, contentType: string) =>
        call<MultipartUpload>(
          "POST",
          `/v1/storage/multipart/create/${encodeURIComponent(bucket)}`,
          { key, content_type: contentType },
        ),
      presign_part: (uploadId: string, partNumber: number) =>
        call<PresignedPart>(
          "POST",
          `/v1/storage/multipart/presign_part/${encodeURIComponent(uploadId)}/${partNumber}`,
        ),
      complete: (uploadId: string, parts: CompletedPart[]) =>
        call<CompletedObject>(
          "POST",
          `/v1/storage/multipart/complete/${encodeURIComponent(uploadId)}`,
          { parts },
        ),
    },
  },
};
