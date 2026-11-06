#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const compat = JSON.parse(readFileSync(new URL("assets/compat.json", root), "utf8"));
const script = readFileSync(new URL("assets/compatibility.js", root), "utf8");
const en = readFileSync(new URL("compatibility.html", root), "utf8");
const fr = readFileSync(new URL("fr/compatibility.html", root), "utf8");

assert.equal(compat.schema_version, 1);
assert.ok(Array.isArray(compat.records));
assert.ok(compat.records.length >= 5);
for (const record of compat.records) {
  if (record.status === "tested") {
    assert.ok(typeof record.server === "string" && record.server.trim(), `missing server for ${record.id}`);
    assert.match(record.test_date || "", /^\d{4}-\d{2}-\d{2}$/, `missing test date for ${record.id}`);
  }
}
assert.match(script, /record\.status === "tested"/);
assert.match(script, /record\.server\.trim\(\)\.length > 0/);
for (const page of [en, fr]) {
  assert.match(page, /id="compatibility-rows"/);
  assert.match(page, /compatibility\.js/);
  assert.doesNotMatch(page, /<span class="st st-ok">/);
}
console.log("COMPATIBILITY DATA: OK");
