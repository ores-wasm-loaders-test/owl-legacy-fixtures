import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { manifests, testEnv, fakeDocument } from '../index.mjs';
import { resolvePackage } from '../resolve.mjs';

const interfaces = await import(resolvePackage('owl-interfaces', 'ores-wasm-loaders'));

const root = join(new URL('.', import.meta.url).pathname, '..');

test('the release trees are reproducible from the committed generator', () => {
  const before = readFileSync(join(root, 'manifests/owl-fixture-leptos.json'), 'utf8');
  execFileSync('node', [join(root, 'tools/build-fixtures.mjs')], { stdio: 'pipe' });
  const after = readFileSync(join(root, 'manifests/owl-fixture-leptos.json'), 'utf8');
  assert.equal(after, before, 'regenerating the fixtures changed a manifest: they must be deterministic');
});

test('every fixture manifest satisfies the contract', () => {
  assert.deepEqual(Object.keys(manifests).sort(), ['dioxus', 'flutter', 'leptos']);
  for (const manifest of Object.values(manifests)) {
    assert.deepEqual(interfaces.checkManifest(manifest, interfaces.manifestSchema), [], manifest.appId);
  }
});

test('the digests in each manifest match the files on disk', () => {
  let checked = 0;
  for (const manifest of Object.values(manifests)) {
    for (const item of [...manifest.entrypoints, ...manifest.assets]) {
      const path = join(root, manifest.baseUrl.replace(/^\//, ''), item.path);
      assert.ok(existsSync(path), `${item.path} is missing — run \`node tools/build-fixtures.mjs\``);
      const bytes = readFileSync(path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
      assert.equal(bytes.length, item.bytes, item.path);
      checked += 1;
    }
  }
  assert.ok(checked >= 18, `expected the whole tree to be checked, checked ${checked}`);
});

test('wasm fixtures start with the real magic, so a loader may check it', () => {
  for (const manifest of Object.values(manifests)) {
    for (const item of [...manifest.entrypoints, ...manifest.assets].filter((i) => i.contentType === 'application/wasm')) {
      const bytes = readFileSync(join(root, manifest.baseUrl.replace(/^\//, ''), item.path));
      assert.deepEqual([...bytes.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d], item.path);
    }
  }
});

test('the test kit models a browser closely enough to be worth testing against', async () => {
  const env = testEnv({ document: fakeDocument() });
  const response = await env.fetch('/x/module_bg.wasm', { credentials: 'omit' });
  assert.equal(response.headers.get('content-type'), 'application/wasm');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer()).subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d]);
  assert.equal(env.requests[0].credentials, 'omit');

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => env.fetch('/x/module_bg.wasm', { signal: controller.signal }), /aborted/);
});
