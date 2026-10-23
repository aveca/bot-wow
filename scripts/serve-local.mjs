#!/usr/bin/env node
/**
 * serve-local.mjs — sert l'artefact `_site/` en HTTP local pour la QA visuelle.
 *
 * Aucune dependance externe : serveur statique Node minimal, avec les types
 * MIME necessaires au site (HTML, CSS, JS, SVG, JSON, TXT).
 * L'API n'est PAS simulee : c'est le site statique reel qui est servi.
 *
 * Usage : node scripts/serve-local.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = join(process.cwd(), '_site');
const PORT = Number(process.argv[2] || 8099);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    // securite : pas de traversee de repertoire
    const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(ROOT, safe);
    let info = await stat(filePath).catch(() => null);
    if (info && info.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      const notFound = join(ROOT, '404.html');
      const body = await readFile(notFound).catch(() => Buffer.from('Not Found'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(body);
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error: ' + e.message);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Site local servi sur http://127.0.0.1:${PORT}/ (racine: ${ROOT})`);
});
