import { createServer, type ServerResponse } from "node:http";
import { PgStore } from "./pg-store.js";

const port = Number(process.env.INDEXER_PORT ?? 8787);
const store = new PgStore();
const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  response.end(JSON.stringify(body, (_, value) => typeof value === "bigint" ? value.toString() : value));
};

createServer(async (request, response) => {
  const origin = "http://" + (request.headers.host ?? "localhost");
  const url = new URL(request.url ?? "/", origin);
  if (url.pathname === "/health") {
    return json(response, 200, { ok: true, provider: "not-configured", ...(await store.health()), authoritative: false });
  }
  if (url.pathname === "/v1/activity") {
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? 50), 100));
    return json(response, 200, {
      data: await store.activity(url.searchParams.get("subject") ?? "", limit),
      degraded: false,
    });
  }
  return json(response, 404, { error: "not found" });
}).listen(port, "127.0.0.1", () => console.log("norr indexer listening on http://127.0.0.1:" + port));
