import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_storage.js";
import {
  completeFieldMediaUpload,
  startFieldMediaUpload,
} from "./field_media_workflow.js";

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export function clientStatus(error: unknown): number {
  if (error instanceof ZodError || error instanceof SyntaxError) return 400;
  if (error instanceof RangeError) return 413;
  if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
    return error.status;
  }
  return 502;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method !== "POST") {
      send(response, 405, { error: "method_not_allowed" });
      return;
    }
    const body = await readJson(request);
    if (request.url === "/uploads/start") {
      send(response, 201, await startFieldMediaUpload(body));
      return;
    }
    if (request.url === "/uploads/complete") {
      send(response, 200, await completeFieldMediaUpload(body));
      return;
    }
    send(response, 404, { error: "route_not_found" });
  } catch (error) {
    send(response, clientStatus(error), {
      error: error instanceof Error ? error.message : "request_failed",
    });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Field media service listening on ${port}`));
