#!/usr/bin/env node
/**
 * serve.mjs — serveur statique local, sans dependance.
 *
 * Sert l'artefact construit (`_site`) pour verifier une modification
 * dans un vrai navigateur avant publication.
 *
 * Usage : node scripts/serve.mjs [port] [racine]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const PORT = Number(process.argv[2] || 8099);
const ROOT = path.resolve(process.argv[3] || '_site');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
  '.zip': 'application/zip',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('403'); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      /* Cloudflare Pages sert les URL propres : /compare -> /compare.html.
         On reproduit ce comportement pour que la verification locale soit
         fidele a la production. */
      if (!path.extname(file)) {
        for (const cand of [`${file}.html`, path.join(file, 'index.html')]) {
          if (fs.existsSync(cand)) {
            res.writeHead(200, {
              'content-type': TYPES[path.extname(cand).toLowerCase()] || 'text/html; charset=utf-8',
              'cache-control': 'no-store',
            });
            res.end(fs.readFileSync(cand));
            return;
          }
        }
      }
      // fallback : 404.html du site si present
      const nf = path.join(ROOT, '404.html');
      if (fs.existsSync(nf)) {
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(nf));
      } else { res.writeHead(404); res.end('404'); }
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serveur statique : http://127.0.0.1:${PORT}/  (racine ${ROOT})`);
});
