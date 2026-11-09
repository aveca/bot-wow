#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

function fail(message) {
  console.error('PACKAGE ARCHIVE: FAIL — ' + message);
  process.exit(1);
}

const zipPath = process.argv[2];
const expectedVersion = process.argv[3];
const expectedCommit = process.argv[4];
if (!zipPath || !expectedVersion || !expectedCommit) {
  fail('usage: node verify-package-archive.cjs <zip> <version> <source-commit>');
}

const zip = fs.readFileSync(zipPath);
function u16(offset) { return zip.readUInt16LE(offset); }
function u32(offset) { return zip.readUInt32LE(offset); }

let eocd = -1;
for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65558); i--) {
  if (u32(i) === 0x06054b50) { eocd = i; break; }
}
if (eocd < 0) fail('ZIP end-of-central-directory missing');

const entryCount = u16(eocd + 10);
let cursor = u32(eocd + 16);
const entries = new Map();

for (let i = 0; i < entryCount; i++) {
  if (u32(cursor) !== 0x02014b50) fail('invalid central-directory entry #' + i);
  const method = u16(cursor + 10);
  const compressedSize = u32(cursor + 20);
  const uncompressedSize = u32(cursor + 24);
  const nameLength = u16(cursor + 28);
  const extraLength = u16(cursor + 30);
  const commentLength = u16(cursor + 32);
  const localOffset = u32(cursor + 42);
  const name = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength);

  if (u32(localOffset) !== 0x04034b50) fail('invalid local header: ' + name);
  const localNameLength = u16(localOffset + 26);
  const localExtraLength = u16(localOffset + 28);
  const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
  const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);
  let data;
  if (method === 0) data = Buffer.from(compressed);
  else if (method === 8) data = zlib.inflateRawSync(compressed);
  else fail('unsupported compression method ' + method + ': ' + name);
  if (data.length !== uncompressedSize) fail('size mismatch: ' + name);
  entries.set(name, data);
  cursor += 46 + nameLength + extraLength + commentLength;
}

const required = [
  'MANIFEST.json',
  'VERSION',
  'package/INSTALL.md',
  'package/THIRD_PARTY_NOTICES.md',
  'package/config.example.json',
  'package/addon/Casinobabe/Casinobabe.toc',
  'package/scripts/fishing_bot.py',
];
for (const name of required) if (!entries.has(name)) fail('required file missing: ' + name);

const forbidden = [...entries.keys()].filter((name) =>
  /(^|\/)(LibStub\.lua|LibDBIcon-1\.0\.lua|background\.tga)$/i.test(name)
  || /(^|\/)(state|reports|logs)\//i.test(name)
  || /mem-.*\.jsonl$/i.test(name));
if (forbidden.length) fail('forbidden content: ' + forbidden.join(', '));

const manifest = JSON.parse(entries.get('MANIFEST.json').toString('utf8'));
if (manifest.version !== expectedVersion) fail('version mismatch: ' + manifest.version);
if (!manifest.source || manifest.source.repository !== 'aveca/Casinobabe') fail('source repository not verified');
if (manifest.source.ref !== 'feat/fishing-route-intelligence-v2') fail('source ref mismatch: ' + manifest.source.ref);
if (manifest.source.commit !== expectedCommit) fail('source commit mismatch: ' + manifest.source.commit);
if (manifest.source.provenanceVerified !== true) fail('source provenance is not verified');

const missing = [];
const mismatched = [];
for (const [name, info] of Object.entries(manifest.files || {})) {
  const bytes = entries.get(name);
  if (!bytes) { missing.push(name); continue; }
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== info.sha256) mismatched.push(name);
}
if (missing.length) fail('manifest files missing from ZIP: ' + missing.join(', '));
if (mismatched.length) fail('manifest SHA-256 mismatch: ' + mismatched.join(', '));

const digest = crypto.createHash('sha256').update(zip).digest('hex');
console.log('PACKAGE ARCHIVE: PASS');
console.log('version=' + manifest.version);
console.log('source=' + manifest.source.repository + '@' + manifest.source.commit);
console.log('entries=' + entries.size);
console.log('manifest_files=' + Object.keys(manifest.files).length);
console.log('zip_bytes=' + zip.length);
console.log('zip_sha256=' + digest);
