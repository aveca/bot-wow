#!/usr/bin/env node
/**
 * package-zip.mjs — lecteur d'entrées ZIP partagé par les tests du packaging
 * BOT-WOW (extrait de distribution-package.test.mjs pour que installation,
 * fulfillment et distribution utilisent EXACTEMENT la même lecture d'archive
 * : aucune duplication de la logique ZIP entre suites).
 *
 * Répond à la même exigence que le reste du paquet : pas de dépendance npm
 * (pure stdlib node:zlib), lecture brute des headers locaux ZIP (PK\x03\x04).
 */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

export function readZipEntries(zipPath) {
  const zip = readFileSync(zipPath);
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const uncompressedSize = zip.readUInt32LE(offset + 22);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = zip.toString('utf8', nameStart, nameStart + nameLength);
    const dataStart = nameStart + nameLength + extraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Buffer.from(compressed)
      : method === 8 ? inflateRawSync(compressed)
        : (() => { throw new Error('ZIP compression method unsupported: ' + method); })();
    if (data.length !== uncompressedSize) throw new Error('ZIP entry size mismatch: ' + name);
    entries.set(name, data);
    offset = dataStart + compressedSize;
  }
  return entries;
}
