import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RG, TR } from '@/data/brainRegions';
import { createCurrentIllustrativeOverlays } from '@/visualization/brain/core/current-illustrative-overlays';

const expectedRegionIds = [
  'dlPFC',
  'vmPFC',
  'ofc',
  'acc',
  'insula',
  'nac',
  'vta',
  'lc',
  'amygdala',
  'hippo',
  'parietal',
  'cerebellum',
  'brainstem',
  'raphe',
  'spinal',
];

const expectedTracts = [
  { f: 'vta', t: 'nac', nt: 'DA' },
  { f: 'vta', t: 'dlPFC', nt: 'DA' },
  { f: 'lc', t: 'dlPFC', nt: 'NA' },
  { f: 'lc', t: 'amygdala', nt: 'NA' },
  { f: 'lc', t: 'insula', nt: 'NA' },
  { f: 'lc', t: 'parietal', nt: 'NA' },
  { f: 'raphe', t: 'dlPFC', nt: '5-HT' },
  { f: 'raphe', t: 'amygdala', nt: '5-HT' },
  { f: 'raphe', t: 'hippo', nt: '5-HT' },
  { f: 'raphe', t: 'vta', nt: '5-HT' },
  { f: 'dlPFC', t: 'amygdala', nt: 'NA' },
];

describe('current legacy/illustrative overlays', () => {
  it('freezes the current static region and tract inputs', () => {
    expect(Object.keys(RG)).toEqual(expectedRegionIds);
    expect(TR).toEqual(expectedTracts);
    expect(RG.dlPFC.p).toEqual([0.15, 0.45, 0.35]);
    expect(RG.spinal.p).toEqual([0, -0.65, -0.28]);
  });

  it('creates the current marker, hitbox, ring and tract objects', () => {
    const scene = new THREE.Scene();
    const overlays = createCurrentIllustrativeOverlays(scene);

    expect(overlays.markerGroup.children).toHaveLength(0);
    overlays.initialize();

    expect(Object.keys(overlays.markers)).toEqual(expectedRegionIds);
    expect(overlays.markerGroup.children).toHaveLength(expectedRegionIds.length * 2);
    expect(overlays.tracts).toHaveLength(expectedTracts.length);
    expect(overlays.markers.dlPFC.children).toHaveLength(1);
    expect(overlays.markers.dlPFC.userData).toEqual({ rid: 'dlPFC' });
    expect(overlays.markers.dlPFC.position.toArray()).toEqual(RG.dlPFC.p);
  });

  it('preserves marker selection, deficit/conflict highlighting and hard-coded tract activation', () => {
    const overlays = createCurrentIllustrativeOverlays(new THREE.Scene());
    overlays.initialize();

    overlays.update({
      activeDrugs: {},
      selectedRegion: null,
      selectedDeficit: null,
      conflictZones: [],
    });
    expect(overlays.markers.dlPFC.scale.x).toBe(0.5);
    expect((overlays.markers.dlPFC.material as THREE.MeshPhysicalMaterial).opacity).toBe(0.3);
    expect(overlays.tracts.every(
      (tract) => (tract.material as THREE.LineBasicMaterial).opacity === 0,
    )).toBe(true);

    overlays.update({
      activeDrugs: { bupropion: 150 },
      selectedRegion: 'dlPFC',
      selectedDeficit: 'attention',
      conflictZones: ['amygdala'],
    });
    const selectedMaterial = overlays.markers.dlPFC.material as THREE.MeshPhysicalMaterial;
    const conflictMaterial = overlays.markers.amygdala.material as THREE.MeshPhysicalMaterial;
    expect(selectedMaterial.opacity).toBe(0.3);
    expect(conflictMaterial.emissive.getHex()).toBe(0xef4444);
    expect(conflictMaterial.emissiveIntensity).toBe(2.5);
    expect(overlays.markers.amygdala.scale.x).toBe(1.3);

    const activeNeurotransmitters = overlays.tracts
      .filter((tract) => (tract.material as THREE.LineBasicMaterial).opacity === 0.4)
      .map((tract) => tract.userData.tr.nt);
    expect(new Set(activeNeurotransmitters)).toEqual(new Set(['DA', 'NA']));
  });
});
