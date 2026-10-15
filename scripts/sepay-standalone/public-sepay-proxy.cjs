// Loopback-only public gateway. Ngrok may publish this proxy; never publish demo/login.
const http = require('node:http');
const { URL } = require('node:url');

const TARGET_PORT = 3101;
const PUBLIC_PORT = 3102;
const MAX_BYTES = 256 * 1024;

function allowedRoute(method, rawUrl) {
  let path;
  try { path = new URL(rawUrl, 'http://localhost').pathname; }
  catch { return false; }
  if (method === 'POST' && path === '/api/v1/finance/checkouts/sepay/ipn') return true;
  if ((method === 'GET' || method === 'POST') &&
      path === '/api/v1/finance/checkouts/sepay/handoff') return true;
  return method === 'GET' &&
    /^\/api\/v1\/finance\/checkouts\/sepay\/return\/(success|error|cancel)$/.test(path);
}

function startProxy() {
  const server = http.createServer((req, res) => {
    if (!allowedRoute(req.method, req.url || '')) {
      res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
      res.end('Not found');
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        res.writeHead(413, { 'content-type': 'text/plain' });
        res.end('Request too large');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      const body = Buffer.concat(chunks);
      const headers = { ...req.headers, host: '127.0.0.1:' + TARGET_PORT };
      delete headers.connection;
      delete headers['transfer-encoding'];
      headers['content-length'] = String(body.length);
      const upstream = http.request({
        hostname: '127.0.0.1', port: TARGET_PORT,
        path: req.url, method: req.method, headers, timeout: 15000
      }, upstreamRes => {
        const forwarded = { ...upstreamRes.headers };
        delete forwarded['set-cookie'];
        res.writeHead(upstreamRes.statusCode || 502, forwarded);
        upstreamRes.pipe(res);
      });
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end('Upstream unavailable');
      });
      upstream.on('timeout', () => upstream.destroy());
      upstream.end(body);
    });
  });
  server.listen(PUBLIC_PORT, '127.0.0.1', () =>
    console.log('SePay route-restricted public proxy ready on 127.0.0.1:' + PUBLIC_PORT));
  return server;
}

if (require.main === module) startProxy();
module.exports = { allowedRoute, startProxy };
