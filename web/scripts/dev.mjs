import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

http.createServer((req, res) => {
  const requested = decodeURIComponent((req.url || "/").split("?")[0]);
  const safe = normalize(requested).replace(/^([.][.][\/\\])+/, "");
  let file = join(root, safe === "/" ? "index.html" : safe);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
  res.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => {
  console.log(`TrọƠi web: http://localhost:${port}`);
});
