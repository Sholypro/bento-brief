// Serveur local : npm run dev puis http://localhost:3000
// Lit .env s'il existe. Sur le même Wi-Fi, ouvre http://<IP-du-Mac>:3000 sur l'iPhone.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { default: handler } = await import('../api/brief.js');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const pub = join(root, 'public');

http
  .createServer(async (req, res) => {
    if (req.url.startsWith('/api/brief')) return handler(req, res);
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(pub, path === '/' ? 'index.html' : path);
    if (!file.startsWith(pub)) { res.statusCode = 403; return res.end(); }
    try {
      const body = await readFile(file);
      res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  })
  .listen(process.env.PORT || 3000, () => console.log(`Bento sur http://localhost:${process.env.PORT || 3000}`));
