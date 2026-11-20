// Vice Panel Studio — local preview server.
//
// A development convenience only: it serves the static files under app/ so
// the cover maker can be opened in a browser with no build step:
//
//   node serve.ts                 →  http://localhost:8080
//   node serve.ts --port 9000     →  http://localhost:9000
//
// Requests are confined to app/ (anything reaching outside it is refused),
// directory URLs land on index.html, and responses carry the content types a
// browser needs for the app's pages, modules, styles, fonts and images.
// Node 22 standard library throughout.

import { createReadStream, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(fileURLToPath(new URL('./app', import.meta.url)));

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.bin': 'application/octet-stream',
};

/** The port to listen on: --port when it names a usable one, else 8080. */
function chosenPort(argv: string[]): number {
  const at = argv.indexOf('--port');
  const candidate = at === -1 ? 8080 : Number(argv[at + 1]);
  return Number.isInteger(candidate) && candidate > 0 && candidate < 65536 ? candidate : 8080;
}

/** Maps a request URL to a file inside app/, or null when it escapes or names nothing. */
function fileFor(url: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url, 'http://preview.invalid').pathname);
  } catch {
    return null;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(APP_ROOT, normalize(path)));
  return file === APP_ROOT || file.startsWith(APP_ROOT + sep) ? file : null;
}

function handle(request: IncomingMessage, response: ServerResponse): void {
  const file = fileFor(request.url ?? '/');
  if (file === null) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size: number;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('directory');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}

const port = chosenPort(process.argv.slice(2));
createServer(handle).listen(port, '127.0.0.1', () => {
  console.log(`Vice Panel Studio is open at http://localhost:${port}`);
});
