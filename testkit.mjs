// The shared test kit: a document stub, a scripted environment, and the fixture manifests.
//
// It lives in the test org so the production packages test against one environment stub
// instead of each keeping a slightly different copy that drifts.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;

export const manifests = Object.fromEntries(
  readdirSync(join(here, 'manifests'))
    .filter((f) => f !== 'index.json')
    .map((f) => {
      const m = JSON.parse(readFileSync(join(here, 'manifests', f), 'utf8'));
      return [m.framework, m];
    }),
);

/** A document stub that records what a loader put in the page. */
export function fakeDocument() {
  const head = {
    children: [],
    appendChild(el) {
      this.children.push(el);
    },
  };
  return {
    head,
    visibilityState: 'visible',
    defaultView: { crossOriginIsolated: true },
    createElement: (tag) => ({
      tag,
      setAttribute(k, v) {
        this[k] = v;
      },
    }),
    querySelector: (selector) => {
      const m = selector.match(/href="([^"]+)"/);
      return m ? head.children.find((c) => c.href === m[1]) ?? null : null;
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

/**
 * An environment whose fetch is scripted, so every byte a loader moves is visible to the
 * test. `.wasm` responses carry the real magic, because a loader is entitled to check it.
 */
export function testEnv({ document = fakeDocument(), wasm = null, latencyMs = 0, fail = new Set(), bodyBytes = 1024 } = {}) {
  let clock = 0;
  const requests = [];
  return {
    requests,
    now: () => (clock += 1),
    document,
    wasm,
    idle: (cb) => cb(),
    log: undefined,
    async fetch(url, init = {}) {
      requests.push({ url, credentials: init.credentials, mode: init.mode });
      if (init.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      if (latencyMs) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, latencyMs);
          init.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          }, { once: true });
        });
      }
      if ([...fail].some((f) => url.includes(f))) return { ok: false, status: 503, url };
      const isWasm = url.endsWith('.wasm');
      const body = new Uint8Array(bodyBytes);
      if (isWasm) body.set(WASM_MAGIC, 0);
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: (h) => (h.toLowerCase() === 'content-type' ? (isWasm ? 'application/wasm' : 'text/javascript') : null) },
        arrayBuffer: async () => body.buffer,
        json: async () => ({}),
      };
    },
  };
}
