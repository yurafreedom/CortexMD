import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCurrentPickingRuntime } from '@/visualization/brain/core/current-picking';

afterEach(() => {
  document.body.style.cursor = '';
});

describe('current marker picking', () => {
  it('delegates hover, selection, deselection and empty-space clicks with screen coordinates', () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({
      x: 10,
      y: 20,
      top: 20,
      right: 110,
      bottom: 120,
      left: 10,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const markerGroup = new THREE.Group();
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial(),
    );
    marker.userData = { rid: 'dlPFC' };
    markerGroup.add(marker);
    markerGroup.updateMatrixWorld(true);

    let selectedRegion: string | null = null;
    const onRegionClick = vi.fn();
    const onRegionHover = vi.fn();
    const picking = createCurrentPickingRuntime({
      domElement: canvas,
      camera,
      markerGroup,
      callbacks: {
        getSelectedRegion: () => selectedRegion,
        onRegionClick,
        onRegionHover,
      },
    });

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 70 }));
    expect(document.body.style.cursor).toBe('pointer');
    expect(onRegionHover).toHaveBeenLastCalledWith('dlPFC', expect.any(MouseEvent));

    canvas.dispatchEvent(new MouseEvent('click', { clientX: 60, clientY: 70 }));
    expect(onRegionClick).toHaveBeenLastCalledWith('dlPFC', { x: 60, y: 70 });

    selectedRegion = 'dlPFC';
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 60, clientY: 70 }));
    expect(onRegionClick).toHaveBeenLastCalledWith(null);

    canvas.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 20 }));
    expect(onRegionClick).toHaveBeenLastCalledWith(null);

    const callsBeforeDispose = onRegionClick.mock.calls.length;
    picking.dispose();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 60, clientY: 70 }));
    expect(onRegionClick).toHaveBeenCalledTimes(callsBeforeDispose);
  });
});
