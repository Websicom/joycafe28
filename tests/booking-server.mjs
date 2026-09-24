// Local browser-test server. All mail delivery is simulated; no customer email is sent.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { handleReservation } from '../workers/reservations.js';

const root = path.resolve(import.meta.dirname, '..');
const env = { GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/browser-test/exec', GOOGLE_APPS_SCRIPT_SECRET: 'test-secret-only-00000000000000000000' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:5174');
    if (url.pathname === '/api/reservations') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const response = await handleReservation(new Request(url, { method: req.method, ...(req.method === 'POST' ? { body } : {}) }), env, {
        fetch: async () => { await new Promise((resolve) => setTimeout(resolve, 500)); return Response.json({ ok: true }); }
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    const filename = path.resolve(root, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
    if (!filename.startsWith(`${root}${path.sep}`)) throw new Error('invalid path');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' };
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(5174, '127.0.0.1', () => console.log('Booking test server: http://127.0.0.1:5174 (simulated email only)'));
