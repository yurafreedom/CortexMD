#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function parseGlb(buffer) {
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error('Invalid GLB magic');
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}`);
  if (declaredLength !== buffer.length) throw new Error(`GLB length mismatch: header=${declaredLength}, file=${buffer.length}`);

  let offset = 12;
  let document;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) document = JSON.parse(chunk.toString('utf8').replace(/\u0000+$/u, '').trim());
    offset += 8 + chunkLength;
  }
  if (!document) throw new Error('GLB has no JSON chunk');
  return { version, document };
}

function triangleCount(primitive, accessors) {
  const count = primitive.indices === undefined
    ? (accessors[primitive.attributes?.POSITION]?.count ?? 0)
    : (accessors[primitive.indices]?.count ?? 0);
  const mode = primitive.mode ?? 4;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function inspect(buffer) {
  const { version, document } = parseGlb(buffer);
  const accessors = document.accessors ?? [];
  const meshes = document.meshes ?? [];
  const primitives = meshes.flatMap((mesh) => mesh.primitives ?? []);
  const geometryAccessors = new Set();

  for (const primitive of primitives) {
    if (primitive.indices !== undefined) geometryAccessors.add(primitive.indices);
    for (const index of Object.values(primitive.attributes ?? {})) geometryAccessors.add(index);
    for (const target of primitive.targets ?? []) {
      for (const index of Object.values(target)) geometryAccessors.add(index);
    }
  }

  const decodedGeometryBytes = [...geometryAccessors].reduce((total, index) => {
    const accessor = accessors[index];
    if (!accessor) return total;
    const componentBytes = COMPONENT_BYTES[accessor.componentType] ?? 0;
    const components = TYPE_COMPONENTS[accessor.type] ?? 0;
    return total + accessor.count * componentBytes * components;
  }, 0);

  return {
    format: 'glTF Binary',
    version,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    rawBytes: buffer.length,
    scenes: (document.scenes ?? []).length,
    nodes: (document.nodes ?? []).length,
    meshes: meshes.length,
    primitives: primitives.length,
    materials: (document.materials ?? []).length,
    textures: (document.textures ?? []).length,
    images: (document.images ?? []).length,
    vertices: primitives.reduce((total, primitive) => total + (accessors[primitive.attributes?.POSITION]?.count ?? 0), 0),
    triangles: primitives.reduce((total, primitive) => total + triangleCount(primitive, accessors), 0),
    extensionsUsed: [...(document.extensionsUsed ?? [])].sort(),
    extensionsRequired: [...(document.extensionsRequired ?? [])].sort(),
    decodedGeometryBytesEstimate: decodedGeometryBytes,
  };
}

const root = process.cwd();
const assetPath = path.join(root, 'public', 'brain.glb');
const baselinePath = path.join(root, 'tests', 'fixtures', 'brain', 'brain-baseline.json');
const report = inspect(await readFile(assetPath));

console.log(JSON.stringify(report, null, 2));

if (process.argv.includes('--no-gate')) process.exit(0);

const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));

const comparableBaseline = baseline.metrics;
const mismatches = Object.keys(comparableBaseline).filter(
  (key) => JSON.stringify(report[key]) !== JSON.stringify(comparableBaseline[key]),
);

if (mismatches.length) {
  console.error(`Brain baseline mismatch: ${mismatches.join(', ')}`);
  process.exit(1);
}

console.log('Brain baseline gate passed: public/brain.glb matches the declared Phase 0 hash, size, and geometry metrics.');
