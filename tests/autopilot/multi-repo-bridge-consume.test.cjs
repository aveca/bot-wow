#!/usr/bin/env node
/**
 * multi-repo-bridge-consume.test.cjs — tests déterministes (sans réseau, sans
 * écriture dans le dépôt) du cycle de consommation du pont BOT-WOW.
 *
 * Couvre :
 *   1. claimNext : réclame une opportunité 'new', puis une 'failed' dont le
 *      retry est dû, retourne null sinon.
 *   - doClaim : marque 'claimed' avec lockId / claimedAt / claimedBy.
 *   - acknowledge : completed / failed (retry puis quarantaine), rejette si non
 *      réclamée, publie les statuts via publishStatus injecté.
 *   - recoverOrphanedLocks : réinitialise à 'new' les 'claimed' trop anciens.
 *   - canExecute : humanGate / moneyPath bloquent.
 *   - executeTask : sans AUTOPILOT_EXEC_CMD => succès simulé ; bloqué => blocked.
 *   - runConsumeCycle : claim + persistance saveQueue + libération du verrou ;
 *      verrou occupé => claimed: false.
 *   - acquireLock / releaseLock : exclusivité 'wx' sur fichier temp, libération
 *      seulement par le détenteur.
 *   - tryStealOrphanLock : révoque pid mort et TTL dépassé, garde pid vivant.
 *   - quarantineOpportunity : quarantaine manuelle.
 *
 * Aucun appel `gh` réel : publishStatus est injecté. Aucune écriture dans le
 * dépôt : la queue est en mémoire, le verrou utilise un fichier temp, le journal
 * utilise un log injecté.
 */

'use strict';

const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

const bridge = require('../../scripts/autopilot/multi-repo-bridge.cjs');

const noopLog = () => {};

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log('  ok   ' + name);
  else {
    failures += 1;
    console.log('  FAIL ' + name + ' ' + detail);
  }
}

function opp(overrides = {}) {
  return {
    id: 'T-1',
    task_id: 'T-1',
    title: 'Tâche de test',
    mode: 'agent',
    source: 'chatgpt',
    priority: 'high',
    confidence: 'observed',
    evidence: 'preuve',
    rollback: 'revert du commit',
    humanGate: false,
    moneyPath: false,
    acceptance: 'critères ok',
    repository_full_name: 'aveca/bot-wow',
    issue_number: 1336,
    fingerprint: 'chatb-issue|aveca/bot-wow|1336|T-1',
    status: 'new',
    ...overrides,
  };
}

function queueWith(opportunities) {
  return { opportunities: [...opportunities] };
}

function depsWith(extra = {}) {
  return { runnerId: 'runner-1', log: noopLog, ...extra };
}

// ── 1. claimNext ────────────────────────────────────────────────────────────

{
  const q = queueWith([opp({ id: 'T-1', status: 'new' })]);
  const claimed = bridge.claimNext(q, depsWith());
  check('claimNext réclame une opp "new"', claimed && claimed.opp.id === 'T-1', claimed ? JSON.stringify(claimed) : 'null');
  check('claimNext marque "claimed"', claimed && claimed.opp.status === 'claimed');
  check('claimNext pose lockId et claimedBy', claimed && typeof claimed.lockId === 'string' && claimed.opp.claimedBy === 'runner-1' && typeof claimed.opp.claimedAt === 'string');
}

{
  const q = queueWith([opp({ id: 'T-1', status: 'failed', retryCount: 1, nextRetryAt: new Date(0).toISOString(), maxRetries: 3 })]);
  const claimed = bridge.claimNext(q, depsWith());
  check('claimNext réclame une "failed" dont le retry est dû', claimed && claimed.opp.id === 'T-1');
}

{
  const q = queueWith([opp({ id: 'T-1', status: 'failed', retryCount: 1, nextRetryAt: new Date(Date.now() + 86400000).toISOString(), maxRetries: 3 })]);
  const claimed = bridge.claimNext(q, depsWith());
  check('claimNext ne réclame pas une "failed" en attente de backoff', claimed === null);
}

{
  const q = queueWith([opp({ id: 'T-1', status: 'completed' })]);
  const claimed = bridge.claimNext(q, depsWith());
  check('claimNext retourne null sans opp réclamable', claimed === null);
}

// ── 2. acknowledge ──────────────────────────────────────────────────────────

{
  const published = [];
  const q = queueWith([opp({ id: 'T-1', status: 'claimed', repository_full_name: 'aveca/bot-wow', issue_number: 1336, fingerprint: 'f', task_id: 'T-1' })]);
  const res = bridge.acknowledge(q, 'T-1', 'completed', 'tout va bien', depsWith({
    publishStatus: (repo, issue, status, detail, opts) => published.push({ repo, issue, status, detail, opts }),
  }));
  check('acknowledge completed ok', res.ok === true);
  check('acknowledge completed passe status "completed"', q.opportunities[0].status === 'completed');
  check('acknowledge completed publié', published.length === 1 && published[0].status === 'completed');
  check('acknowledge completed efface error/nextRetryAt', q.opportunities[0].error === undefined && q.opportunities[0].nextRetryAt === undefined);
}

{
  const published = [];
  const q = queueWith([opp({ id: 'T-1', status: 'claimed', retryCount: 0, maxRetries: 3, repository_full_name: 'aveca/bot-wow', issue_number: 1336, fingerprint: 'f', task_id: 'T-1' })]);
  const res = bridge.acknowledge(q, 'T-1', 'failed', 'erreur temporaire', depsWith({
    publishStatus: (repo, issue, status, detail, opts) => published.push({ status }),
  }));
  check('acknowledge failed ok', res.ok === true);
  check('acknowledge failed passe status "failed"', q.opportunities[0].status === 'failed');
  check('acknowledge failed incrémente retryCount', q.opportunities[0].retryCount === 1);
  check('acknowledge failed pose nextRetryAt', typeof q.opportunities[0].nextRetryAt === 'string');
  check('acknowledge failed publie "failed"', published.length === 1 && published[0].status === 'failed');
}

{
  const published = [];
  const q = queueWith([opp({ id: 'T-1', status: 'claimed', retryCount: 2, maxRetries: 3, repository_full_name: 'aveca/bot-wow', issue_number: 1336, fingerprint: 'f', task_id: 'T-1' })]);
  const res = bridge.acknowledge(q, 'T-1', 'failed', 'encore échec', depsWith({
    publishStatus: (repo, issue, status, detail, opts) => published.push({ status }),
  }));
  check('acknowledge failed au-delà maxRetries -> quarantined', q.opportunities[0].status === 'quarantined');
  check('acknowledge quarantined posee quarantineReason', typeof q.opportunities[0].quarantineReason === 'string');
  check('acknowledge quarantined publie "failed"', published.length === 1 && published[0].status === 'failed');
}

{
  const q = queueWith([opp({ id: 'T-1', status: 'new', task_id: 'T-1' })]);
  const res = bridge.acknowledge(q, 'T-1', 'completed', 'x', depsWith());
  check('acknowledge rejette une opp non réclamée', res.ok === false && /n'est pas réclamée/.test(res.error));
}

{
  const res = bridge.acknowledge(queueWith([]), 'INCONNU', 'completed', 'x', depsWith());
  check('acknowledge rejette une opp introuvable', res.ok === false && /introuvable/.test(res.error));
}

{
  const res = bridge.acknowledge(queueWith([opp({ id: 'T-1', status: 'claimed', task_id: 'T-1' })]), 'T-1', 'toto', 'x', depsWith());
  check('acknowledge rejette outcome invalide', res.ok === false && /invalide/.test(res.error));
}

// ── 3. recoverOrphanedLocks ─────────────────────────────────────────────────

{
  const old = new Date(Date.now() - 40 * 60 * 1000).toISOString(); // 40 min > 30 min timeout
  const recent = new Date().toISOString();
  const q = queueWith([
    opp({ id: 'T-1', status: 'claimed', claimedAt: old }),
    opp({ id: 'T-2', status: 'claimed', claimedAt: recent }),
    opp({ id: 'T-3', status: 'new' }),
  ]);
  const recovered = bridge.recoverOrphanedLocks(q, depsWith({ orphanTimeoutMs: 30 * 60 * 1000 }));
  check('recoverOrphanedLocks récupère 1 verrou', recovered === 1);
  check('recoverOrphanedLocks réinitialise l ancien à "new"', q.opportunities[0].status === 'new' && q.opportunities[0].claimedAt === undefined);
  check('recoverOrphanedLocks garde le récent "claimed"', q.opportunities[1].status === 'claimed');
}

// ── 4. canExecute ───────────────────────────────────────────────────────────

{
  check('canExecute autorise par défaut', bridge.canExecute(opp({})).executable === true);
  check('canExecute bloque humanGate', bridge.canExecute(opp({ humanGate: true })).executable === false);
  check('canExecute bloque moneyPath', bridge.canExecute(opp({ moneyPath: true })).executable === false);
}

// ── 5. executeTask ──────────────────────────────────────────────────────────

{
  const res = bridge.executeTask(opp({}), { log: noopLog });
  check('executeTask simulé sans execCmd', res.ok === true && res.exitCode === 0 && res.blocked !== true);
}

{
  const res = bridge.executeTask(opp({ humanGate: true }), { log: noopLog });
  check('executeTask bloqué humanGate', res.blocked === true && res.ok === false);
}

// ── 6. runConsumeCycle ──────────────────────────────────────────────────────

{
  const saved = [];
  const q = queueWith([opp({ id: 'T-1', status: 'new' })]);
  const result = bridge.runConsumeCycle(q, depsWith({
    saveQueue: (qq) => saved.push(qq),
    acquireLock: () => ({ fd: 1, lockId: 'lock-test' }),
    releaseLock: () => {},
  }));
  check('runConsumeCycle claim reussi', result.claimed === true && result.opp.id === 'T-1');
  check('runConsumeCycle persiste le claim via saveQueue', saved.length === 1 && saved[0].opportunities[0].status === 'claimed');
}

{
  let saveCalled = false;
  const q = queueWith([opp({ id: 'T-1', status: 'new' })]);
  const result = bridge.runConsumeCycle(q, depsWith({
    saveQueue: () => { saveCalled = true; },
    acquireLock: () => null,
    releaseLock: () => {},
  }));
  check('runConsumeCycle verrou occupe => claimed false', result.claimed === false && /verrou/.test(result.reason));
  check('runConsumeCycle verrou occupe => saveQueue non appele', saveCalled === false);
}

// ── 7. acquireLock / releaseLock (fichier temp) ─────────────────────────────

{
  const lockPath = path.join(os.tmpdir(), `botwow-lock-test-${process.pid}.lock`);
  try { fs.unlinkSync(lockPath); } catch (_) {}

  const a1 = bridge.acquireLock({ lockPath, log: noopLog });
  check('acquireLock obtient le verrou', a1 && a1.fd && typeof a1.lockId === 'string');

  const a2 = bridge.acquireLock({ lockPath, log: noopLog });
  check('acquireLock refuse le second processus', a2 === null);

  bridge.releaseLock(a1, a1.lockId, { lockPath, log: noopLog });

  const a3 = bridge.acquireLock({ lockPath, log: noopLog });
  check('acquireLock reprend le verrou apres liberation', a3 && a3.fd);
  bridge.releaseLock(a3, a3.lockId, { lockPath, log: noopLog });

  try { fs.unlinkSync(lockPath); } catch (_) {}
}

// ── 8. tryStealOrphanLock ───────────────────────────────────────────────────

{
  const TTL = 60 * 1000;
  const lockPath = path.join(os.tmpdir(), `botwow-steal-test-${process.pid}.lock`);
  try { fs.unlinkSync(lockPath); } catch (_) {}

  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, lockId: 'x', acquiredAt: new Date().toISOString() }), 'utf8');
  check('tryStealOrphanLock garde le verrou d un pid vivant', bridge.tryStealOrphanLock(lockPath, {}, { log: noopLog }) === false);

  fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999999, lockId: 'x', acquiredAt: new Date().toISOString() }), 'utf8');
  check('tryStealOrphanLock revoque un pid mort', bridge.tryStealOrphanLock(lockPath, {}, { log: noopLog }) === true);
  check('tryStealOrphanLock supprime le fichier', !fs.existsSync(lockPath));

  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, lockId: 'x', acquiredAt: new Date(Date.now() - 2 * TTL).toISOString() }), 'utf8');
  check('tryStealOrphanLock revoque un TTL depasse', bridge.tryStealOrphanLock(lockPath, {}, { log: noopLog }) === true);
  try { fs.unlinkSync(lockPath); } catch (_) {}
}

// ── 9. quarantineOpportunity ────────────────────────────────────────────────

{
  const published = [];
  const q = queueWith([opp({ id: 'T-1', status: 'failed', repository_full_name: 'aveca/bot-wow', issue_number: 1336, fingerprint: 'f', task_id: 'T-1' })]);
  const res = bridge.quarantineOpportunity(q, 'T-1', 'raison manuelle', depsWith({
    publishStatus: (repo, issue, status, detail, opts) => published.push({ status }),
  }));
  check('quarantineOpportunity ok', res.ok === true && res.opp.status === 'quarantined');
  check('quarantineOpportunity publie "failed"', published.length === 1 && published[0].status === 'failed');
  check('quarantineOpportunity introuvable', bridge.quarantineOpportunity(queueWith([]), 'INCONNU', 'r', depsWith()).ok === false);
}

console.log(failures === 0 ? 'TOUS LES TESTS CONSOMMATION OK' : `${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
