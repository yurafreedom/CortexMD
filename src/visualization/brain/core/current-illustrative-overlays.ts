import * as THREE from 'three';
import { NTC, RG, TR, type BrainRegion, type Tract } from '@/data/brainRegions';

const DA_DRUGS = [
  'bupropion', 'pramipexole', 'cariprazine', 'aripiprazole', 'brexpiprazole',
  'methylphenidate', 'lisdexamfetamine', 'modafinil', 'selegiline_oral',
  'amisulpride_low', 'levodopa', 'auvelity',
];
const NA_DRUGS = [
  'atomoxetine', 'bupropion', 'duloxetine', 'guanfacine', 'desipramine',
  'nortriptyline', 'protriptyline', 'reboxetine', 'milnacipran',
  'levomilnacipran', 'venlafaxine', 'desvenlafaxine', 'quetiapine',
  'lisdexamfetamine', 'brexpiprazole',
];
const SERT_DRUGS = [
  'sertraline', 'vortioxetine', 'duloxetine', 'escitalopram', 'fluvoxamine',
  'fluoxetine', 'venlafaxine', 'desvenlafaxine', 'milnacipran',
  'levomilnacipran', 'amitriptyline', 'dextromethorphan',
];

export interface CurrentIllustrativeOverlayState {
  readonly activeDrugs: Readonly<Record<string, number>>;
  readonly selectedRegion: string | null;
  readonly selectedDeficit: string | null;
  readonly conflictZones: readonly string[];
}

export interface CurrentIllustrativeOverlays {
  readonly markerGroup: THREE.Group;
  readonly markers: Readonly<Record<string, THREE.Mesh>>;
  readonly tracts: readonly THREE.Line[];
  initialize(): void;
  update(state: CurrentIllustrativeOverlayState): void;
  updateFrame(elapsedTime: number, camera: THREE.Camera, selectedDeficit: string | null): void;
}

/**
 * Current product overlays only. Region XYZ values, tract activation and
 * marker effects remain legacy/illustrative and are not atlas semantics.
 */
export function createCurrentIllustrativeOverlays(scene: THREE.Scene): CurrentIllustrativeOverlays {
  const markerGroup = new THREE.Group();
  const markers: Record<string, THREE.Mesh> = {};
  const tracts: THREE.Line[] = [];
  scene.add(markerGroup);

  return {
    markerGroup,
    markers,
    tracts,
    initialize() {
      (Object.entries(RG) as [string, BrainRegion][]).forEach(([id, region]) => {
        const markerRadius = 0.09;
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(markerRadius, 16, 16),
          new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(region.c),
            emissive: new THREE.Color(region.c),
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.95,
            roughness: 0.2,
          }),
        );
        marker.position.set(region.p[0], region.p[1], region.p[2]);
        marker.userData = { rid: id };
        markerGroup.add(marker);
        markers[id] = marker;

        const hitbox = new THREE.Mesh(
          new THREE.SphereGeometry(markerRadius * 2.5, 8, 8),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hitbox.userData = { rid: id };
        marker.add(hitbox);

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.07, 0.1, 32),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(region.c),
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
          }),
        );
        ring.position.copy(marker.position);
        ring.userData = { rid: id, isR: true };
        markerGroup.add(ring);
      });

      (TR as Tract[]).forEach((tract) => {
        const from = RG[tract.f] as BrainRegion | undefined;
        const to = RG[tract.t] as BrainRegion | undefined;
        if (!from || !to) return;
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(from.p[0], from.p[1], from.p[2]),
          new THREE.Vector3(
            (from.p[0] + to.p[0]) / 2,
            (from.p[1] + to.p[1]) / 2 + 0.12,
            (from.p[2] + to.p[2]) / 2,
          ),
          new THREE.Vector3(to.p[0], to.p[1], to.p[2]),
        );
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
        const material = new THREE.LineBasicMaterial({
          color: new THREE.Color(NTC[tract.nt] || '#666'),
          transparent: true,
          opacity: 0,
        });
        const line = new THREE.Line(geometry, material);
        line.userData = { tr: tract };
        scene.add(line);
        tracts.push(line);
      });
    },
    update({ activeDrugs, selectedRegion, selectedDeficit, conflictZones }) {
      Object.entries(markers).forEach(([id, marker]) => {
        const material = marker.material as THREE.MeshPhysicalMaterial;
        const region = RG[id] as BrainRegion;
        const isSelected = selectedRegion === id;
        let totalIntensity = 0;

        Object.keys(activeDrugs).forEach((drugId) => {
          if (activeDrugs[drugId] > 0) totalIntensity += 1;
        });

        if (totalIntensity > 0) {
          marker.scale.setScalar(1 + totalIntensity * 0.06);
          material.emissiveIntensity = isSelected ? 2 : 0.5 + totalIntensity * 0.1;
          material.opacity = isSelected ? 1 : 0.85;
        } else {
          marker.scale.setScalar(0.5);
          material.emissive.set(region.c);
          material.emissiveIntensity = 0.1;
          material.opacity = 0.3;
        }

        if (selectedDeficit && !isSelected) {
          material.opacity *= 0.4;
          material.emissiveIntensity *= 0.3;
        }

        if (conflictZones.length > 0) {
          if (conflictZones.includes(id)) {
            material.emissive.set(0xef4444);
            material.emissiveIntensity = 2.5;
            material.opacity = 1;
            marker.scale.setScalar(1.3);
          } else {
            material.opacity *= 0.3;
            material.emissiveIntensity *= 0.2;
          }
        }
      });

      const activeIds = Object.keys(activeDrugs);
      tracts.forEach((line) => {
        const tract = line.userData.tr as Tract;
        let active = false;
        if (tract.nt === 'DA') active = activeIds.some((id) => DA_DRUGS.includes(id));
        if (tract.nt === 'NA') active = activeIds.some((id) => NA_DRUGS.includes(id));
        if (tract.nt === '5-HT') active = activeIds.some((id) => SERT_DRUGS.includes(id));
        (line.material as THREE.LineBasicMaterial).opacity = active ? 0.4 : 0;
      });
    },
    updateFrame(elapsedTime, camera, selectedDeficit) {
      if (!selectedDeficit) {
        Object.values(markers).forEach((marker) => {
          const material = marker.material as THREE.MeshPhysicalMaterial;
          if (material.emissiveIntensity > 0.3) {
            material.emissiveIntensity += Math.sin(elapsedTime * 3) * 0.015;
          }
        });
      }

      markerGroup.children.forEach((child) => {
        if (!child.userData.isR) return;
        child.lookAt(camera.position);
        const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.opacity = 0.2 + Math.sin(elapsedTime * 2) * 0.08;
      });

      tracts.forEach((line) => {
        const material = line.material as THREE.LineBasicMaterial;
        if (material.opacity > 0) material.opacity = 0.2 + Math.sin(elapsedTime * 2) * 0.15;
      });
    },
  };
}
