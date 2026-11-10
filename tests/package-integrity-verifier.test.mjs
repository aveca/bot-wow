#!/usr/bin/env node
/**
 * Package integrity verifier tests.
 * All archives are synthetic temporary fixtures; no payment, API, R2 or client data.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, mkdirSync, mkdtempSync, readFileSync,
  rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const VERIFIER = join(REPO, 'distribution', 'verify-package.py');
const PYTHON_CANDIDATES = process.platform === 'win32'
  ? [{ command: 'py', prefix: ['-3'] }, { command: 'python', prefix: [] }]
  : [{ command: 'python3', prefix: [] }, { command: 'python', prefix: [] }];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function pythonRun(script, args) {
  let lastError;
  for (const candidate of PYTHON_CANDIDATES) {
    const result = spawnSync(candidate.command, [...candidate.prefix, script, ...args], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.error?.code === 'ENOENT') {
      lastError = result.error;
      continue;
    }
    return result;
  }
  throw new Error('Python 3 is required for package verification tests: ' + String(lastError));
}

function fixture(rights = 'release') {
  const root = mkdtempSync(join(tmpdir(), 'botwow-package-verify-'));
  const packageRoot = join(root, 'package');
  mkdirSync(join(packageRoot, 'addon', 'Casinababe'), { recursive: true });
  mkdirSync(join(packageRoot, 'scripts'), { recursive: true });
  const files = {
    'addon/Casinababe/Casinababe.toc': '## Interface: 20505\n',
    'scripts/fishing_bot.py': 'print("fixture only")\n',
  };
  for (const [relative, content] of Object.entries(files)) {
    writeFileSync(join(packageRoot, ...relative.split('/')), content);
  }
  copyFileSync(VERIFIER, join(packageRoot, 'verify-package.py'));
  writeFileSync(join(root, 'VERSION'), '1.2.2-test\n');

  const manifestFiles = {};
  for (const [relative, content] of Object.entries(files)) {
    manifestFiles[relative] = {
      sha256: sha256(content),
      bytes: Buffer.byteLength(content),
      source: '(fixture)',
    };
  }
  const verifierBytes = readFileSync(join(packageRoot, 'verify-package.py'));
  manifestFiles['verify-package.py'] = {
    sha256: sha256(verifierBytes),
    bytes: verifierBytes.length,
    source: 'distribution/verify-package.py',
  };
  const versionBytes = Buffer.from('1.2.2-test\n');
  manifestFiles.VERSION = {
    sha256: sha256(versionBytes),
    bytes: versionBytes.length,
    source: '(fixture)',
  };
  writeFileSync(join(root, 'MANIFEST.json'), JSON.stringify({
    name: 'casinababe-fishing',
    version: '1.2.2-test',
    distribution: rights === 'release'
      ? {
          mode: 'release',
          eligible: true,
          unresolvedRights: 0,
          sourceRepositoryMatches: true,
          sourceCommitMatches: true,
        }
      : {
          mode: 'qa',
          eligible: false,
          unresolvedRights: 1,
          sourceRepositoryMatches: true,
          sourceCommitMatches: true,
        },
    files: manifestFiles,
  }, null, 2) + '\n');
  return { root, packageRoot };
}

function run(root, args = []) {
  return pythonRun(join(root, 'package', 'verify-package.py'), args);
}

function expectFailure(name, result, text) {
  assert.notEqual(result.status, 0, name + ': expected non-zero exit');
  assert.match(result.stderr, text, name + ': expected diagnostic');
  console.log('  ok   ' + name);
}

const cases = [];
try {
  {
    const f = fixture('release');
    cases.push(f);
    const result = run(f.root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /PACKAGE INTEGRITY OK.*manifest claims release mode/);
    console.log('  ok   valid release archive verifies');
  }
  {
    const f = fixture('release');
    cases.push(f);
    writeFileSync(join(f.packageRoot, 'scripts', 'fishing_bot.py'), 'tampered\n');
    expectFailure('tampered file rejected', run(f.root), /byte count mismatch|SHA-256 mismatch/);
  }
  {
    const f = fixture('release');
    cases.push(f);
    writeFileSync(join(f.packageRoot, 'unexpected.txt'), 'not in manifest\n');
    expectFailure('unmanifested file rejected', run(f.root), /unmanifested files/);
  }
  {
    const f = fixture('release');
    cases.push(f);
    rmSync(join(f.packageRoot, 'addon', 'Casinababe', 'Casinababe.toc'));
    expectFailure('missing manifested file rejected', run(f.root), /missing or unreadable/);
  }
  {
    const f = fixture('qa');
    cases.push(f);
    expectFailure('QA candidate rejected by default', run(f.root), /QA-only package/);
    const allowed = run(f.root, ['--allow-qa']);
    assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
    assert.match(allowed.stdout, /QA ONLY; not authorized/);
    console.log('  ok   explicit QA override never grants release authorization');
  }
  {
    const f = fixture('release');
    cases.push(f);
    const manifestPath = join(f.root, 'MANIFEST.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.distribution.unresolvedRights = false;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    expectFailure('boolean release rights count rejected', run(f.root), /release manifest is not eligible/);
  }
  {
    const f = fixture('qa');
    cases.push(f);
    const manifestPath = join(f.root, 'MANIFEST.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.distribution.unresolvedRights = true;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    expectFailure('boolean QA rights count rejected even with override', run(f.root, ['--allow-qa']), /QA manifest has inconsistent rights status/);
  }
  {
    const f = fixture('release');
    cases.push(f);
    const manifestPath = join(f.root, 'MANIFEST.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.distribution.unresolvedRights = 0;
    const serialized = JSON.stringify(manifest, null, 2).replace('"unresolvedRights": 0,', '"unresolvedRights": 0.0,');
    writeFileSync(manifestPath, serialized);
    expectFailure('float release rights count rejected', run(f.root), /release manifest is not eligible/);
  }
  {
    const f = fixture('release');
    cases.push(f);
    const outside = join(f.root, 'outside.txt');
    writeFileSync(outside, 'outside\n');
    const manifestPath = join(f.root, 'MANIFEST.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.files['../outside.txt'] = {
      sha256: sha256('outside\n'),
      bytes: Buffer.byteLength('outside\n'),
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    expectFailure('path traversal rejected', run(f.root), /unsafe manifest path|path traversal|non-canonical/);
  }
  {
    const f = fixture('release');
    cases.push(f);
    const outside = join(f.root, 'outside.txt');
    writeFileSync(outside, 'outside\n');
    const link = join(f.packageRoot, 'scripts', 'escape.txt');
    try {
      symlinkSync(outside, link);
      const manifestPath = join(f.root, 'MANIFEST.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.files['scripts/escape.txt'] = {
        sha256: sha256('outside\n'),
        bytes: Buffer.byteLength('outside\n'),
      };
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      expectFailure('symbolic link rejected', run(f.root), /symbolic link/);
    } catch (error) {
      if (error.code !== 'EPERM' && error.code !== 'EACCES' && error.code !== 'ENOTSUP') throw error;
      console.log('  SKIP symbolic-link fixture unsupported by this host');
    }
  }
} finally {
  for (const f of cases) rmSync(f.root, { recursive: true, force: true });
}

console.log('PACKAGE INTEGRITY VERIFIER: OK');
