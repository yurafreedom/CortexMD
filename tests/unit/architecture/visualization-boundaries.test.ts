import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const coreDirectory = path.join(root, 'src/visualization/brain/core');

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function sha256(relativePath: string) {
  return createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex');
}

describe('NV-0 visualization boundaries', () => {
  it('keeps the BrainCanvas public barrel and eager page reachability unchanged', () => {
    const barrel = read('src/components/Brain3D/index.ts');
    const page = read('src/app/page.tsx');
    const canvas = read('src/components/Brain3D/BrainCanvas.tsx');

    expect(barrel).toContain("export { default as BrainCanvas } from './BrainCanvas';");
    expect(barrel).toContain("export type { BrainCanvasProps } from './BrainCanvas';");
    expect(page).toContain("import { BrainCanvas } from '@/components/Brain3D';");
    expect(canvas).toContain("from '@/visualization/brain/core/renderer-lifecycle'");
    expect(`${page}\n${canvas}`).not.toMatch(/\b(?:dynamic|lazy)\s*\(|<Suspense|import\s*\(/);
  });

  it('keeps the accepted asset and legacy region input byte-identical', () => {
    expect(sha256('public/brain.glb'))
      .toBe('8f0babae064319fd8d9520148ca5d31ce70938b2edd4db2dced960e4caffe8cf');
    expect(fs.statSync(path.join(root, 'public/brain.glb')).size).toBe(43_191_068);
    expect(sha256('src/data/brainRegions.ts'))
      .toBe('1ba34e3d0ba7d5f819a644ddf33b5093201b9fabb85b02f65eb7800817b8a5e0');
  });

  it('keeps the instance-local Three runtime free of forbidden application dependencies', () => {
    const files = fs.readdirSync(coreDirectory).sort();
    expect(files).toEqual([
      'current-asset-adapter.ts',
      'current-illustrative-overlays.ts',
      'current-picking.ts',
      'render-scheduler.ts',
      'renderer-lifecycle.ts',
    ]);

    for (const file of files) {
      const source = fs.readFileSync(path.join(coreDirectory, file), 'utf8');
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)]
        .map((match) => match[1]);
      expect(imports, file).not.toEqual(expect.arrayContaining([
        expect.stringMatching(/pharmacology|drugs(?:\.v2)?|supabase|anthropic|tvb|simulation|patient/i),
      ]));
      expect(source, file).not.toMatch(/\b(?:dynamic|lazy)\s*\(|import\s*\(/);
    }
  });

  it('keeps the machine characterization synchronized with source-owned invariants', () => {
    const artifact = JSON.parse(read('docs/visualization/nv-0-characterization.json'));
    const canvasLoc = read('src/components/Brain3D/BrainCanvas.tsx').trimEnd().split('\n').length;
    const propsHash = createHash('sha256')
      .update(JSON.stringify(artifact.brainCanvas.publicProps))
      .digest('hex');

    expect(artifact.brainCanvas.locBefore).toBe(690);
    expect(artifact.brainCanvas.locAfter).toBe(canvasLoc);
    expect(artifact.brainCanvas.publicPropsSha256).toBe(propsHash);
    expect(artifact.asset).toEqual(expect.objectContaining({
      path: '/brain.glb',
      rawBytes: 43_191_068,
      sha256: sha256('public/brain.glb'),
      changed: false,
    }));
    expect(artifact.initialReachability).toEqual(expect.objectContaining({
      threeBefore: true,
      threeAfter: true,
      changed: false,
    }));
    expect(artifact.currentOverlayClassifications).toEqual(expect.objectContaining({
      regionCoordinates: 'LEGACY_ILLUSTRATIVE_PRODUCT_COORDINATES',
      regionCount: 15,
      tractCount: 11,
      atlasBacked: false,
      simulationOutput: false,
    }));
  });
});
