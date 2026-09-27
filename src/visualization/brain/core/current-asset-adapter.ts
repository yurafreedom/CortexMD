import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const CURRENT_BRAIN_ASSET_PATH = '/brain.glb';

export interface CurrentBrainAssetRuntime {
  readonly root: THREE.Object3D;
  readonly materials: readonly THREE.MeshPhysicalMaterial[];
  readonly particles: THREE.Points | null;
  updateFrame(opacity: number): void;
}

export interface CurrentBrainAssetLoader {
  load(
    url: string,
    onLoad: (gltf: GLTF) => void,
    onProgress?: (event: ProgressEvent<EventTarget>) => void,
    onError?: (error: unknown) => void,
  ): unknown;
}

interface CurrentBrainAssetOptions {
  readonly scene: THREE.Scene;
  readonly getOpacity: () => number;
  readonly onReady: (asset: CurrentBrainAssetRuntime) => void;
  readonly loader?: CurrentBrainAssetLoader;
}

function createParticles(
  scene: THREE.Scene,
  positions: THREE.BufferAttribute,
  parent: THREE.Object3D,
) {
  const particleCount = Math.min(positions.count, 2000);
  const step = Math.max(1, Math.floor(positions.count / particleCount));
  const geometry = new THREE.BufferGeometry();
  const values = new Float32Array(particleCount * 3);
  for (let i = 0, j = 0; i < positions.count && j < particleCount; i += step, j++) {
    values[j * 3] = positions.getX(i);
    values[j * 3 + 1] = positions.getY(i);
    values[j * 3 + 2] = positions.getZ(i);
  }
  for (let index = 0; index < particleCount * 3; index += 3) {
    const x = values[index];
    const y = values[index + 1];
    const z = values[index + 2];
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length > 0) {
      const expansion = 1 + Math.random() * 0.15 + 0.05;
      values[index] *= expansion;
      values[index + 1] *= expansion;
      values[index + 2] *= expansion;
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(values, 3));
  const material = new THREE.PointsMaterial({
    color: 0xddeeff,
    size: 0.005,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(geometry, material);
  particles.position.copy(parent.position);
  particles.rotation.copy(parent.rotation);
  particles.scale.copy(parent.scale);
  scene.add(particles);
  return particles;
}

function assetRuntime(
  root: THREE.Object3D,
  materials: THREE.MeshPhysicalMaterial[],
  particles: THREE.Points | null,
): CurrentBrainAssetRuntime {
  return {
    root,
    materials,
    particles,
    updateFrame(opacity) {
      if (particles) {
        particles.rotation.y += 0.0003;
        (particles.material as THREE.PointsMaterial).opacity =
          0.3 + Math.sin(Date.now() * 0.001) * 0.1;
      }
      materials.forEach((material) => {
        material.opacity = opacity;
      });
    },
  };
}

function createFallbackBrain(
  scene: THREE.Scene,
  getOpacity: () => number,
): CurrentBrainAssetRuntime {
  const geometry = new THREE.SphereGeometry(1, 64, 48);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index) * 0.75;
    let y = positions.getY(index);
    const z = positions.getZ(index) * 0.9;
    if (y < -0.3) y *= 0.5;
    const noise = Math.sin(x * 8) * Math.cos(z * 6) * 0.03;
    const radius = Math.sqrt(x * x + y * y + z * z);
    positions.setXYZ(
      index,
      x + (x / radius) * noise,
      y + (y / radius) * noise,
      z + (z / radius) * noise,
    );
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xc0c8d4,
    transparent: true,
    opacity: getOpacity(),
    roughness: 0.6,
    metalness: 0.15,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const brain = new THREE.Mesh(geometry, material);

  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    wireframe: true,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
  });
  const wireframe = new THREE.Mesh(geometry, wireMaterial);
  wireframe.scale.multiplyScalar(1.002);
  scene.add(wireframe);
  scene.add(brain);

  return assetRuntime(brain, [material], createParticles(scene, positions, brain));
}

function useLoadedBrain(
  gltf: GLTF,
  scene: THREE.Scene,
  getOpacity: () => number,
): CurrentBrainAssetRuntime {
  const model = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 2 / Math.max(size.x, size.y, size.z);
  model.position.sub(center);
  model.scale.setScalar(scale);
  model.position.y += 0.1;

  const meshes: THREE.Mesh[] = [];
  const materials: THREE.MeshPhysicalMaterial[] = [];
  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    meshes.push(mesh);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xc0c8d4,
      transparent: true,
      opacity: getOpacity(),
      roughness: 0.6,
      metalness: 0.15,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    mesh.material = material;
    materials.push(material);

    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0xccddee,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    });
    const wireframe = mesh.clone();
    wireframe.material = wireMaterial;
    wireframe.scale.multiplyScalar(1.002);
    model.add(wireframe);
  });

  scene.add(model);
  const particleMesh = meshes.reduce<THREE.Mesh | null>((largest, mesh) => {
    if (!largest) return mesh;
    return (mesh.geometry.attributes.position?.count ?? 0)
      > (largest.geometry.attributes.position?.count ?? 0)
      ? mesh
      : largest;
  }, null);
  const particles = particleMesh
    ? createParticles(
        scene,
        particleMesh.geometry.attributes.position as THREE.BufferAttribute,
        model,
      )
    : null;
  return assetRuntime(model, materials, particles);
}

/** Starts the same eager GLTF request used before NV-0. */
export function loadCurrentBrainAsset({
  scene,
  getOpacity,
  onReady,
  loader = new GLTFLoader(),
}: CurrentBrainAssetOptions): void {
  loader.load(
    CURRENT_BRAIN_ASSET_PATH,
    (gltf) => onReady(useLoadedBrain(gltf, scene, getOpacity)),
    undefined,
    () => onReady(createFallbackBrain(scene, getOpacity)),
  );
}
