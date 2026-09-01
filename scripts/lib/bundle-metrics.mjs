import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { phase0Environment } from './phase0-environment.mjs';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function unique(values) {
  return [...new Set(values)];
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function payloadSetSha256(assets) {
  return sha256(assets.map((asset) => `${asset.rawBytes}:${asset.sha256}`).sort().join('\n'));
}

function normalizeHtml(html) {
  return html
    .replace(/\\"b\\":\\"[A-Za-z0-9_-]+\\"/g, '\\"b\\":\\"[build-id]\\"')
    .replace(/\/_next\/static\/chunks\/[^?"']+\.(js|css)/g, '/_next/static/chunks/[content-hash].$1')
    .replace(/\/_next\/static\/(?!chunks\/|media\/)[^/"']+\//g, '/_next/static/[build-id]/');
}

async function waitForServer(url, child) {
  let lastError;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Next.js server exited with code ${child.exitCode}`);
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return response;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
}

export async function measureInitialRoute({ root = process.cwd(), port = 3199, includeNormalizedHtml = false } = {}) {
  const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
    cwd: root,
    env: phase0Environment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  child.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  try {
    const response = await waitForServer(`http://127.0.0.1:${port}/`, child);
    const html = await response.text();
    if (!response.ok) throw new Error(`Initial route returned HTTP ${response.status}\n${serverOutput}`);

    const assetUrls = unique([...html.matchAll(/["'](\/_next\/static\/[^"']+\.(?:js|css))(?:\?[^"']*)?["']/g)].map((match) => match[1])).sort();
    const assets = [];

    for (const url of assetUrls) {
      const relativePath = url.replace(/^\/_next\//, '');
      const file = path.join(root, '.next', relativePath);
      const bytes = await readFile(file);
      assets.push({
        url,
        kind: url.endsWith('.css') ? 'css' : 'js',
        rawBytes: bytes.length,
        gzipBytes: gzipSync(bytes, { level: 9, mtime: 0 }).length,
        sha256: sha256(bytes),
        hasThreeRuntime: /WebGLRenderer|OrbitControls|GLTFLoader/.test(bytes.toString('utf8')),
      });
    }

    const js = assets.filter((asset) => asset.kind === 'js');
    const css = assets.filter((asset) => asset.kind === 'css');
    const normalizedHtml = normalizeHtml(html);
    const htmlBytes = Buffer.byteLength(html);
    const htmlGzipBytes = gzipSync(Buffer.from(html), { level: 9, mtime: 0 }).length;
    const normalizedHtmlGzipBytes = gzipSync(Buffer.from(normalizedHtml), { level: 9, mtime: 0 }).length;
    const jsRawBytes = js.reduce((total, asset) => total + asset.rawBytes, 0);
    const jsGzipBytes = js.reduce((total, asset) => total + asset.gzipBytes, 0);
    const cssRawBytes = css.reduce((total, asset) => total + asset.rawBytes, 0);
    const cssGzipBytes = css.reduce((total, asset) => total + asset.gzipBytes, 0);

    return {
      route: '/',
      httpStatus: response.status,
      jsRawBytes,
      jsGzipBytes,
      cssRawBytes,
      cssGzipBytes,
      jsPayloadSetSha256: payloadSetSha256(js),
      cssPayloadSetSha256: payloadSetSha256(css),
      initialAssetPayloadSetSha256: payloadSetSha256(assets),
      htmlBytes,
      htmlGzipBytes,
      normalizedHtmlGzipBytes,
      initialAssetsGzipBytes: jsGzipBytes + cssGzipBytes + normalizedHtmlGzipBytes,
      assetCount: assets.length,
      jsAssetCount: js.length,
      cssAssetCount: css.length,
      threeInInitialGraph: assets.some((asset) => asset.hasThreeRuntime),
      threeAssetCount: assets.filter((asset) => asset.hasThreeRuntime).length,
      assets,
      normalization: [
        'HTML build identifiers are replaced before deterministic gzip comparison.',
        'HTML chunk content-hash filenames are replaced before deterministic gzip comparison.',
        'JavaScript and CSS payload bytes are never normalized.',
      ],
      ...(includeNormalizedHtml ? { normalizedHtml } : {}),
    };
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      sleep(2_000),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

export function comparableBundleMetrics(report) {
  const {
    route,
    httpStatus,
    jsRawBytes,
    jsGzipBytes,
    cssRawBytes,
    cssGzipBytes,
    jsPayloadSetSha256,
    cssPayloadSetSha256,
    initialAssetPayloadSetSha256,
    htmlBytes,
    normalizedHtmlGzipBytes,
    initialAssetsGzipBytes,
    assetCount,
    jsAssetCount,
    cssAssetCount,
    threeInInitialGraph,
    threeAssetCount,
  } = report;
  return {
    route,
    httpStatus,
    jsRawBytes,
    jsGzipBytes,
    cssRawBytes,
    cssGzipBytes,
    jsPayloadSetSha256,
    cssPayloadSetSha256,
    initialAssetPayloadSetSha256,
    htmlBytes,
    normalizedHtmlGzipBytes,
    initialAssetsGzipBytes,
    assetCount,
    jsAssetCount,
    cssAssetCount,
    threeInInitialGraph,
    threeAssetCount,
  };
}
