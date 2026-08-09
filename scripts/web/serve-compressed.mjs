import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { createGzip } from 'node:zlib';

const root = path.resolve('dist');
const port = Number(process.env.HFM_PROFILE_PORT ?? 49281);
const compressible = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.svg',
  '.wasm',
]);
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url ?? '/', 'http://localhost').pathname,
    );
    let file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${path.sep}`) && file !== root) {
      response.writeHead(403).end();
      return;
    }
    if (await isDirectory(file)) file = path.join(file, 'index.html');
    if (!(await isFile(file))) file = path.join(root, 'index.html');

    const extension = path.extname(file);
    const headers = {
      'Content-Type': mime[extension] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    };
    const gzip =
      compressible.has(extension) &&
      /\bgzip\b/.test(request.headers['accept-encoding'] ?? '');
    response.writeHead(
      200,
      gzip ? { ...headers, 'Content-Encoding': 'gzip' } : headers,
    );
    const stream = createReadStream(file);
    if (gzip) stream.pipe(createGzip({ level: 9 })).pipe(response);
    else stream.pipe(response);
  } catch (error) {
    console.error(error);
    response.writeHead(500).end('Server error');
  }
}).listen(port, '127.0.0.1', () => {
  console.info(`Compressed profile server: http://127.0.0.1:${port}`);
});

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(file) {
  try {
    return (await stat(file)).isDirectory();
  } catch {
    return false;
  }
}
