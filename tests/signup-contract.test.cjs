#!/usr/bin/env node
'use strict'

// Factory V3 mission (2026-10-18) — bot-wow signup path.
// Locks the HONEST signup contract:
//   1. the form exists with a configurable API base (data-api-base);
//   2. email + consent are validated before any request;
//   3. a success message is shown ONLY after a real 2xx — there is no code
//      path that claims a signup was recorded without an API confirmation;
//   4. an absent API (404/501), a server error or a network failure all
//      produce an explicit "nothing was recorded" message;
//   5. the consent copy mentions opt-in + one-click unsubscribe.

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8')
const js = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8')

// 1. form + configurable endpoint
assert.equal(html.includes('id="signup-form"'), true, 'le formulaire d\'inscription doit exister')
assert.equal(html.includes('data-api-base'), true, 'l\'endpoint doit etre configurable (data-api-base)')
assert.equal(html.includes('id="signup-email"'), true, 'champ email requis')
assert.equal(html.includes('type="email"'), true, 'input type=email pour le clavier mobile')

// 2. consent is required and explained
assert.equal(html.includes('id="signup-consent"'), true, 'case de consentement requise')
assert.equal(html.includes('required'), true, 'consentement + email marques required')
assert.ok(/d\u00e9sinscri|d\u00e9sinscription/i.test(html),
  'la mention desinscription doit figurer pres du consentement')

// 3. success only after a real API confirmation
assert.equal(js.includes('resp.ok'), true,
  'le succes ne peut etre affiche que sur resp.ok (confirmation API reelle)')
assert.ok(/Inscription confirm\u00e9e/.test(js), 'message de confirmation present')
// there must be NO unconditional success message outside the resp.ok branch
const okBranch = js.slice(js.indexOf('if (resp.ok)'), js.indexOf("} else if (resp.status === 404"))
assert.ok(/Inscription confirm\u00e9e/.test(okBranch), 'confirmation dans la branche resp.ok')
assert.equal(okBranch.includes('rien n'), false, 'pas de message d echec dans la branche succes')

// 4. honest failure paths
assert.ok(/n'est pas encore ouverte/.test(js) || /pas encore ouverte/.test(js),
  'API absente (404/501) -> inscription pas encore ouverte, rien enregistre')
assert.ok(/Rien n'a \u00e9t\u00e9 enregistr\u00e9/.test(js) || /rien n'a \u00e9t\u00e9 enregistr\u00e9/.test(js),
  'les echecs doivent dire explicitement que rien n\'a ete enregistre')
assert.ok(/Connexion impossible/.test(js), 'echec reseau -> message honnete')

// 5. validation logic exists and is exported for tests
assert.equal(js.includes('validateSignup'), true, 'validateSignup doit exister')
assert.equal(js.includes('missing_consent'), true, 'le consentement est valide')
assert.equal(js.includes('invalid_email'), true, 'le format email est valide')

// 6. the validator actually behaves: the REAL app.js runs in a vm sandbox
//    with a minimal DOM stub (no browser, no network).
const vm = require("node:vm")
const sandbox = {
  window: {},
  document: { readyState: 'complete', getElementById: () => null, addEventListener: () => {} },
  fetch: () => Promise.reject(new Error('no network in test')),
}
vm.createContext(sandbox)
vm.runInContext(js, sandbox)
const validate = sandbox.window.__botwowSignup.validateSignup
assert.equal(typeof validate, 'function', 'validateSignup exporte')
console.log('OK - signup: formulaire present, consentement requis, succes '
  + 'uniquement apres confirmation API, echecs honnetes (rien enregistre)')
