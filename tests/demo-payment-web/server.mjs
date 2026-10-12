import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.DEMO_TEST_HOST?.trim() || "127.0.0.1";
const port = parsePort(process.env.DEMO_TEST_PORT, 4177);
const backendBaseUrl = parseBackendBaseUrl(
  process.env.DEMO_TEST_BACKEND_URL || "http://127.0.0.1:3000",
);

const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
]);

const securityHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};

function parsePort(raw, fallback) {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("DEMO_TEST_PORT must be an integer between 1 and 65535");
  }
  return parsed;
}

function parseBackendBaseUrl(raw) {
  const url = new URL(raw);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("DEMO_TEST_BACKEND_URL must use http or https");
  }

  const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error("DEMO_TEST_BACKEND_URL must target a loopback host");
  }

  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url;
}

function writeJson(response, status, payload) {
  response.writeHead(status, {
    ...securityHeaders,
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function collectBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new Error("Request body exceeds 1 MiB");
    }
    chunks.push(chunk);
  }

  return chunks.length === 0 ? undefined : Buffer.concat(chunks);
}

function proxyHeaders(request) {
  const headers = new Headers();
  const allowed = [
    "accept",
    "accept-language",
    "authorization",
    "content-type",
    "idempotency-key",
    "user-agent",
  ];

  for (const name of allowed) {
    const value = request.headers[name];
    if (typeof value === "string") headers.set(name, value);
  }

  return headers;
}

async function proxyApi(request, response, url) {
  const target = new URL(
    url.pathname + url.search,
    backendBaseUrl.origin,
  );

  let body;
  try {
    body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await collectBody(request);
  } catch (error) {
    writeJson(response, 413, { message: error.message });
    return;
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: proxyHeaders(request),
      body,
      redirect: "manual",
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());
    const headers = {
      ...securityHeaders,
      "Content-Type":
        upstream.headers.get("content-type") || "application/octet-stream",
    };

    const location = upstream.headers.get("location");
    if (location) headers.Location = location;

    response.writeHead(upstream.status, headers);
    response.end(responseBody);
  } catch {
    writeJson(response, 502, {
      message: "Backend local không khả dụng",
      backendBaseUrl: backendBaseUrl.origin,
    });
  }
}

async function serveStatic(response, fileName, contentType) {
  try {
    const content = await readFile(path.join(root, fileName));
    response.writeHead(200, {
      ...securityHeaders,
      "Content-Type": contentType,
    });
    response.end(content);
  } catch {
    writeJson(response, 500, { message: "Không đọc được test asset" });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);

  if (request.method === "GET" && url.pathname === "/__config") {
    writeJson(response, 200, {
      backendBaseUrl: backendBaseUrl.origin,
      apiPrefix: "/api/v1",
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    await proxyApi(request, response, url);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    writeJson(response, 405, { message: "Method not allowed" });
    return;
  }

  const staticFile = staticFiles.get(url.pathname);
  if (!staticFile) {
    writeJson(response, 404, { message: "Not found" });
    return;
  }

  await serveStatic(response, staticFile[0], staticFile[1]);
});

server.listen(port, host, () => {
  console.log(`DemoPay test console: http://${host}:${port}`);
  console.log(`Backend proxy target: ${backendBaseUrl.origin}`);
  console.log("Test-only server. Credentials are not persisted or logged.");
});
