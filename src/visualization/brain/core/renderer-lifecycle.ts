import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  loadCurrentBrainAsset,
  type CurrentBrainAssetRuntime,
} from './current-asset-adapter';
import {
  createCurrentIllustrativeOverlays,
  type CurrentIllustrativeOverlayState,
} from './current-illustrative-overlays';
import { createCurrentPickingRuntime } from './current-picking';
import { createContinuousFrameLoop } from './render-scheduler';

export const CURRENT_CAMERA_CONFIG = {
  fov: 45,
  aspect: 1,
  near: 0.1,
  far: 100,
  position: [3.5, 0.2, 0] as const,
  target: [-0.2, -0.1, 0] as const,
};

export const CURRENT_CONTROLS_CONFIG = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 1.5,
  maxDistance: 8,
  target: CURRENT_CAMERA_CONFIG.target,
};

export const CURRENT_LIGHT_CONFIG = {
  ambient: { color: 0x334455, intensity: 0.4 },
  directional: { color: 0x6e8caa, intensity: 0.8, position: [0, 2, 3] as const },
  warm: { color: 0xff6633, intensity: 0.3, distance: 5, position: [0, -1, 1] as const },
  rim: { color: 0x8844ff, intensity: 0.4, distance: 6, position: [0, 0.5, -2] as const },
};

export interface CurrentBrainRuntimeState {
  readonly selectedRegion: string | null;
  readonly selectedDeficit: string | null;
  readonly opacity: number;
  readonly onRegionClick: (id: string | null, screenPos?: { x: number; y: number }) => void;
  readonly onRegionHover: (id: string | null, event?: MouseEvent) => void;
}

export interface CurrentBrainRuntime {
  resize(): void;
  updateOverlays(state: CurrentIllustrativeOverlayState): void;
  dispose(): void;
}

interface RendererSceneFactories {
  createRenderer(options: THREE.WebGLRendererParameters): THREE.WebGLRenderer;
  createControls(camera: THREE.PerspectiveCamera, domElement: HTMLElement): OrbitControls;
}

export interface RendererSceneRuntime {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly clock: THREE.Clock;
  resize(): void;
  dispose(): void;
}

interface CurrentViewportTarget {
  addEventListener(type: 'resize', listener: () => void): void;
  removeEventListener(type: 'resize', listener: () => void): void;
}

const defaultFactories: RendererSceneFactories = {
  createRenderer: (options) => new THREE.WebGLRenderer(options),
  createControls: (camera, domElement) => new OrbitControls(camera, domElement),
};

export function attachCurrentViewportResize(
  resize: () => void,
  target: CurrentViewportTarget = window,
) {
  target.addEventListener('resize', resize);
  resize();
  return {
    dispose() {
      target.removeEventListener('resize', resize);
    },
  };
}

/** Creates and owns the current renderer, camera, lights, controls and canvas. */
export function createRendererScene(
  container: HTMLDivElement,
  factories: RendererSceneFactories = defaultFactories,
): RendererSceneRuntime {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    CURRENT_CAMERA_CONFIG.fov,
    CURRENT_CAMERA_CONFIG.aspect,
    CURRENT_CAMERA_CONFIG.near,
    CURRENT_CAMERA_CONFIG.far,
  );
  camera.position.set(...CURRENT_CAMERA_CONFIG.position);
  camera.lookAt(...CURRENT_CAMERA_CONFIG.target);

  const renderer = factories.createRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  container.appendChild(renderer.domElement);

  const controls = factories.createControls(camera, renderer.domElement);
  controls.enableDamping = CURRENT_CONTROLS_CONFIG.enableDamping;
  controls.dampingFactor = CURRENT_CONTROLS_CONFIG.dampingFactor;
  controls.minDistance = CURRENT_CONTROLS_CONFIG.minDistance;
  controls.maxDistance = CURRENT_CONTROLS_CONFIG.maxDistance;
  controls.target.set(...CURRENT_CONTROLS_CONFIG.target);

  scene.add(new THREE.AmbientLight(
    CURRENT_LIGHT_CONFIG.ambient.color,
    CURRENT_LIGHT_CONFIG.ambient.intensity,
  ));
  const directional = new THREE.DirectionalLight(
    CURRENT_LIGHT_CONFIG.directional.color,
    CURRENT_LIGHT_CONFIG.directional.intensity,
  );
  directional.position.set(...CURRENT_LIGHT_CONFIG.directional.position);
  scene.add(directional);
  const warm = new THREE.PointLight(
    CURRENT_LIGHT_CONFIG.warm.color,
    CURRENT_LIGHT_CONFIG.warm.intensity,
    CURRENT_LIGHT_CONFIG.warm.distance,
  );
  warm.position.set(...CURRENT_LIGHT_CONFIG.warm.position);
  scene.add(warm);
  const rim = new THREE.PointLight(
    CURRENT_LIGHT_CONFIG.rim.color,
    CURRENT_LIGHT_CONFIG.rim.intensity,
    CURRENT_LIGHT_CONFIG.rim.distance,
  );
  rim.position.set(...CURRENT_LIGHT_CONFIG.rim.position);
  scene.add(rim);

  return {
    scene,
    camera,
    renderer,
    controls,
    clock: new THREE.Clock(),
    resize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width <= 0 || height <= 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    },
    dispose() {
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    },
  };
}

/** Orchestrates the current eager asset, interaction, viewport and RAF runtimes. */
export function createCurrentBrainRuntime(
  container: HTMLDivElement,
  getState: () => CurrentBrainRuntimeState,
): CurrentBrainRuntime {
  const rendererScene = createRendererScene(container);
  const overlays = createCurrentIllustrativeOverlays(rendererScene.scene);
  let asset: CurrentBrainAssetRuntime | null = null;

  loadCurrentBrainAsset({
    scene: rendererScene.scene,
    getOpacity: () => getState().opacity,
    onReady: (loadedAsset) => {
      asset = loadedAsset;
      overlays.initialize();
    },
  });

  const viewportResize = attachCurrentViewportResize(() => rendererScene.resize());

  const picking = createCurrentPickingRuntime({
    domElement: rendererScene.renderer.domElement,
    camera: rendererScene.camera,
    markerGroup: overlays.markerGroup,
    callbacks: {
      getSelectedRegion: () => getState().selectedRegion,
      onRegionClick: (id, screenPos) => getState().onRegionClick(id, screenPos),
      onRegionHover: (id, event) => getState().onRegionHover(id, event),
    },
  });

  const frameLoop = createContinuousFrameLoop(() => {
    const state = getState();
    const elapsedTime = rendererScene.clock.getElapsedTime();
    rendererScene.controls.update();
    overlays.updateFrame(elapsedTime, rendererScene.camera, state.selectedDeficit);
    asset?.updateFrame(state.opacity);
    rendererScene.renderer.render(rendererScene.scene, rendererScene.camera);
  });
  frameLoop.start();

  return {
    resize: () => rendererScene.resize(),
    updateOverlays: (state) => overlays.update(state),
    dispose() {
      frameLoop.stop();
      viewportResize.dispose();
      picking.dispose();
      rendererScene.dispose();
    },
  };
}
