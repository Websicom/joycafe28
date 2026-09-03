import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!filename.startsWith(root) || !existsSync(filename) || statSync(filename).isDirectory()) filename = path.join(root, '404.html');
  const isNotFound = filename.endsWith('404.html') && pathname !== '/404.html';
  const extension = path.extname(filename);
  const shouldCompress = /gzip/.test(request.headers['accept-encoding'] || '') && ['.html', '.css', '.js', '.json', '.xml', '.txt', '.svg', '.webmanifest'].includes(extension);
  const headers = { 'Content-Type': types[extension] || 'application/octet-stream', 'Cache-Control': 'no-store' };
  if (shouldCompress) {
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  response.writeHead(isNotFound ? 404 : 200, headers);
  const file = createReadStream(filename);
  if (shouldCompress) file.pipe(createGzip()).pipe(response);
  else file.pipe(response);
});

server.listen(5173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:5173/'));
