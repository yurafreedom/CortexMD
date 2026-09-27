import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import {
  CURRENT_BRAIN_ASSET_PATH,
  loadCurrentBrainAsset,
  type CurrentBrainAssetLoader,
  type CurrentBrainAssetRuntime,
} from '@/visualization/brain/core/current-asset-adapter';
import {
  CURRENT_CAMERA_CONFIG,
  CURRENT_CONTROLS_CONFIG,
  CURRENT_LIGHT_CONFIG,
  attachCurrentViewportResize,
  createRendererScene,
} from '@/visualization/brain/core/renderer-lifecycle';

describe('current renderer scene runtime', () => {
  it('binds one resize listener, runs an initial resize, and removes that listener', () => {
    const resize = vi.fn();
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const listener = attachCurrentViewportResize(resize, target);

    expect(target.addEventListener).toHaveBeenCalledOnce();
    expect(target.addEventListener).toHaveBeenCalledWith('resize', resize);
    expect(resize).toHaveBeenCalledOnce();

    listener.dispose();
    expect(target.removeEventListener).toHaveBeenCalledOnce();
    expect(target.removeEventListener).toHaveBeenCalledWith('resize', resize);
  });

  it('isolates renderer creation while preserving camera, controls, lights, viewport and cleanup', () => {
    const container = document.createElement('div');
    Object.defineProperties(container, {
      clientWidth: { value: 800 },
      clientHeight: { value: 400 },
    });
    const canvas = document.createElement('canvas');
    const renderer = {
      domElement: canvas,
      setClearColor: vi.fn(),
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      outputColorSpace: '',
      toneMapping: 0,
      toneMappingExposure: 0,
    };
    const controls = {
      enableDamping: false,
      dampingFactor: 0,
      minDistance: 0,
      maxDistance: 0,
      target: new THREE.Vector3(),
      update: vi.fn(),
      dispose: vi.fn(),
    };
    const createRenderer = vi.fn(() => renderer as unknown as THREE.WebGLRenderer);
    const createControls = vi.fn(() => controls as unknown as never);

    const runtime = createRendererScene(container, { createRenderer, createControls });

    expect(createRenderer).toHaveBeenCalledWith({ antialias: true, alpha: true });
    expect(container).toContainElement(canvas);
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x000000, 0);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(Math.min(devicePixelRatio, 2));
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.5);

    expect(runtime.camera.fov).toBe(CURRENT_CAMERA_CONFIG.fov);
    expect(runtime.camera.aspect).toBe(CURRENT_CAMERA_CONFIG.aspect);
    expect(runtime.camera.near).toBe(CURRENT_CAMERA_CONFIG.near);
    expect(runtime.camera.far).toBe(CURRENT_CAMERA_CONFIG.far);
    expect(runtime.camera.position.toArray()).toEqual([...CURRENT_CAMERA_CONFIG.position]);
    expect(controls.enableDamping).toBe(CURRENT_CONTROLS_CONFIG.enableDamping);
    expect(controls.dampingFactor).toBe(CURRENT_CONTROLS_CONFIG.dampingFactor);
    expect(controls.minDistance).toBe(CURRENT_CONTROLS_CONFIG.minDistance);
    expect(controls.maxDistance).toBe(CURRENT_CONTROLS_CONFIG.maxDistance);
    expect(controls.target.toArray()).toEqual([...CURRENT_CONTROLS_CONFIG.target]);

    expect(runtime.scene.children).toHaveLength(4);
    expect(runtime.scene.children[0]).toBeInstanceOf(THREE.AmbientLight);
    const ambient = runtime.scene.children[0] as THREE.AmbientLight;
    expect(ambient.color.getHex()).toBe(CURRENT_LIGHT_CONFIG.ambient.color);
    expect(ambient.intensity).toBe(CURRENT_LIGHT_CONFIG.ambient.intensity);
    expect(runtime.scene.children[1]).toBeInstanceOf(THREE.DirectionalLight);
    const directional = runtime.scene.children[1] as THREE.DirectionalLight;
    expect(directional.color.getHex()).toBe(CURRENT_LIGHT_CONFIG.directional.color);
    expect(directional.intensity).toBe(CURRENT_LIGHT_CONFIG.directional.intensity);
    expect(directional.position.toArray()).toEqual([...CURRENT_LIGHT_CONFIG.directional.position]);
    expect(runtime.scene.children[2]).toBeInstanceOf(THREE.PointLight);
    const warm = runtime.scene.children[2] as THREE.PointLight;
    expect(warm.color.getHex()).toBe(CURRENT_LIGHT_CONFIG.warm.color);
    expect(warm.intensity).toBe(CURRENT_LIGHT_CONFIG.warm.intensity);
    expect(warm.distance).toBe(CURRENT_LIGHT_CONFIG.warm.distance);
    expect(warm.position.toArray()).toEqual([...CURRENT_LIGHT_CONFIG.warm.position]);
    expect(runtime.scene.children[3]).toBeInstanceOf(THREE.PointLight);
    const rim = runtime.scene.children[3] as THREE.PointLight;
    expect(rim.color.getHex()).toBe(CURRENT_LIGHT_CONFIG.rim.color);
    expect(rim.intensity).toBe(CURRENT_LIGHT_CONFIG.rim.intensity);
    expect(rim.distance).toBe(CURRENT_LIGHT_CONFIG.rim.distance);
    expect(rim.position.toArray()).toEqual([...CURRENT_LIGHT_CONFIG.rim.position]);

    runtime.resize();
    expect(runtime.camera.aspect).toBe(2);
    expect(renderer.setSize).toHaveBeenCalledWith(800, 400);

    runtime.dispose();
    expect(controls.dispose).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(container).not.toContainElement(canvas);
  });
});

describe('current brain asset adapter', () => {
  it('keeps the eager asset path, imported material replacement, wireframe and particles', () => {
    const scene = new THREE.Scene();
    const model = new THREE.Group();
    model.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 3),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    ));
    let requestedPath = '';
    const loader: CurrentBrainAssetLoader = {
      load(path, onLoad) {
        requestedPath = path;
        onLoad({ scene: model } as GLTF);
      },
    };
    let loaded: CurrentBrainAssetRuntime | null = null;

    loadCurrentBrainAsset({
      scene,
      getOpacity: () => 0.15,
      onReady: (asset) => {
        loaded = asset;
      },
      loader,
    });

    expect(CURRENT_BRAIN_ASSET_PATH).toBe('/brain.glb');
    expect(requestedPath).toBe('/brain.glb');
    expect(loaded).not.toBeNull();
    const runtime = loaded as unknown as CurrentBrainAssetRuntime;
    expect(runtime.root).toBe(model);
    expect(runtime.materials).toHaveLength(1);
    expect(runtime.materials[0]).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(runtime.materials[0].opacity).toBe(0.15);
    expect(runtime.particles).toBeInstanceOf(THREE.Points);
    expect(model.children.filter(
      (child) => child instanceof THREE.Mesh
        && (child.material as THREE.MeshBasicMaterial).wireframe,
    )).toHaveLength(1);

    runtime.updateFrame(0.42);
    expect(runtime.materials[0].opacity).toBe(0.42);
  });

  it('preserves the procedural fallback on GLB load error', () => {
    const scene = new THREE.Scene();
    const loader: CurrentBrainAssetLoader = {
      load(_path, _onLoad, _onProgress, onError) {
        onError?.(new Error('fixture load failure'));
      },
    };
    let loaded: CurrentBrainAssetRuntime | null = null;

    loadCurrentBrainAsset({
      scene,
      getOpacity: () => 0.2,
      onReady: (asset) => {
        loaded = asset;
      },
      loader,
    });

    expect(loaded).not.toBeNull();
    const runtime = loaded as unknown as CurrentBrainAssetRuntime;
    expect(runtime.root).toBeInstanceOf(THREE.Mesh);
    expect(runtime.materials[0].opacity).toBe(0.2);
    expect(runtime.particles).toBeInstanceOf(THREE.Points);
  });
});
