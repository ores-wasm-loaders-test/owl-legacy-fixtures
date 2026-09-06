// Builds the fixture releases: three structurally faithful build trees (a Flutter web
// release, a Leptos islands release, a Dioxus route-chunk release), each with real files
// and real digests, plus the owl-manifest.json that describes it.
//
// The trees imitate the SHAPE of the real toolchains' output — entrypoint roles, the chunk
// graph, the JS fallback Flutter emits — with placeholder bytes of our own. No vendor
// assets are copied.
//
// Run: node tools/build-fixtures.mjs   (writes releases/ and manifests/)
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Deterministic filler so a fixture's digests never change between runs. */
function filler(seed, bytes) {
  const out = Buffer.alloc(bytes);
  let h = createHash('sha256').update(seed).digest();
  for (let i = 0; i < bytes; i += 32) {
    h.copy(out, i, 0, Math.min(32, bytes - i));
    h = createHash('sha256').update(h).digest();
  }
  return out;
}

/** A wasm module fixture starts with the real magic + version so content sniffing is honest. */
function wasmFiller(seed, bytes) {
  const body = filler(seed, Math.max(0, bytes - 8));
  return Buffer.concat([Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]), body]);
}

const RELEASES = [
  {
    appId: 'owl-fixture-flutter',
    releaseId: '2026.09.05-f1a2b3c',
    framework: 'flutter',
    toolchain: 'flutter 3.35.1 (wasm)',
    requiresCrossOriginIsolation: true,
    prepare: { maxBytes: 6_000_000, maxConcurrency: 4, furthestStage: 'fetch' },
    activation: { mode: 'attach-view', hostSelector: '#app-view' },
    files: [
      ['flutter_bootstrap.js', 'text/javascript', 'entry', 'bootstrap', 12_288],
      ['main.dart.wasm', 'application/wasm', 'entry', 'module', 2_400_000],
      ['main.dart.mjs', 'text/javascript', 'entry', 'glue', 96_000],
      ['main.dart.js', 'text/javascript', 'entry', 'fallback', 1_800_000],
      ['assets/AssetManifest.bin.json', 'application/json', 'asset', 'critical', 4_096],
      ['assets/FontManifest.json', 'application/json', 'asset', 'critical', 1_024],
      ['assets/fonts/Placeholder.otf', 'font/otf', 'asset', 'optional', 240_000],
      ['canvaskit/skwasm.wasm', 'application/wasm', 'asset', 'optional', 900_000],
      ['assets/help/onboarding.json', 'application/json', 'asset', 'lazy', 32_000],
    ],
  },
  {
    appId: 'owl-fixture-leptos',
    releaseId: '2026.09.05-9d8e7f6',
    framework: 'leptos',
    toolchain: 'wasm-bindgen 0.2.95 / leptos 0.7 (islands)',
    requiresCrossOriginIsolation: false,
    prepare: { maxBytes: 2_000_000, maxConcurrency: 3, furthestStage: 'compile' },
    activation: { mode: 'hydrate-islands', islands: ['PricingCalculator', 'SignupWizard', 'StatusTicker'] },
    files: [
      ['islands.js', 'text/javascript', 'entry', 'glue', 48_000],
      ['islands_bg.wasm', 'application/wasm', 'entry', 'module', 780_000],
      ['islands.css', 'text/css', 'asset', 'critical', 18_000],
      ['snippets/status-ticker.js', 'text/javascript', 'asset', 'optional', 6_000],
    ],
  },
  {
    appId: 'owl-fixture-dioxus',
    releaseId: '2026.09.05-4c5d6e7',
    framework: 'dioxus',
    toolchain: 'wasm-bindgen 0.2.95 / dioxus 0.6 (route chunks)',
    requiresCrossOriginIsolation: false,
    prepare: { maxBytes: 3_000_000, maxConcurrency: 3, furthestStage: 'compile' },
    activation: { mode: 'mount-route', hostSelector: '#dioxus-root', routes: { '/app': 'chunks/app.wasm', '/app/reports': 'chunks/reports.wasm' } },
    files: [
      ['app.js', 'text/javascript', 'entry', 'glue', 52_000],
      ['app_bg.wasm', 'application/wasm', 'entry', 'module', 640_000],
      ['chunks/app.wasm', 'application/wasm', 'entry', 'chunk', 210_000],
      ['chunks/reports.wasm', 'application/wasm', 'entry', 'chunk', 380_000],
      ['app.css', 'text/css', 'asset', 'critical', 22_000],
    ],
  },
];

function build(spec) {
  const base = `releases/${spec.appId}/${spec.releaseId}/`;
  const entrypoints = [];
  const assets = [];
  for (const [path, contentType, kind, tag, bytes] of spec.files) {
    const buf = contentType === 'application/wasm' ? wasmFiller(`${spec.releaseId}:${path}`, bytes) : filler(`${spec.releaseId}:${path}`, bytes);
    const abs = join(ROOT, base, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, buf);
    const row = { path, contentType, bytes: buf.length, sha256: sha256(buf) };
    if (kind === 'entry') entrypoints.push({ role: tag, ...row });
    else assets.push({ ...row, stage: tag });
  }
  const manifest = {
    contractVersion: '1.0.0',
    appId: spec.appId,
    releaseId: spec.releaseId,
    framework: spec.framework,
    toolchain: spec.toolchain,
    baseUrl: `/${base}`,
    requiresCrossOriginIsolation: spec.requiresCrossOriginIsolation,
    entrypoints,
    assets,
    prepare: spec.prepare,
    activation: spec.activation,
  };
  const out = join(ROOT, base, 'owl-manifest.json');
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  const copy = join(ROOT, 'manifests', `${spec.appId}.json`);
  mkdirSync(dirname(copy), { recursive: true });
  writeFileSync(copy, `${JSON.stringify(manifest, null, 2)}\n`);
  const total = [...entrypoints, ...assets].reduce((a, b) => a + b.bytes, 0);
  console.log(`[fixtures] ${spec.appId} ${spec.releaseId}: ${entrypoints.length} entrypoints, ${assets.length} assets, ${total} bytes`);
  return manifest;
}

const manifests = RELEASES.map(build);
writeFileSync(
  join(ROOT, 'manifests', 'index.json'),
  `${JSON.stringify(manifests.map((m) => ({ appId: m.appId, releaseId: m.releaseId, framework: m.framework, manifest: `${m.baseUrl}owl-manifest.json` })), null, 2)}\n`,
);
console.log(`[fixtures] ${manifests.length} releases built`);

// Sanity: the tree on disk must match every digest we just wrote.
let checked = 0;
for (const m of manifests) {
  for (const f of [...m.entrypoints, ...m.assets]) {
    const abs = join(ROOT, m.baseUrl.replace(/^\//, ''), f.path);
    if (sha256(readFileSync(abs)) !== f.sha256) throw new Error(`digest mismatch for ${f.path}`);
    checked += 1;
  }
}
console.log(`[fixtures] verified ${checked} digests against the tree`);
