import * as THREE from 'three';

export interface CurrentPickingCallbacks {
  getSelectedRegion(): string | null;
  onRegionClick(id: string | null, screenPos?: { x: number; y: number }): void;
  onRegionHover(id: string | null, event?: MouseEvent): void;
}

export interface CurrentPickingRuntime {
  dispose(): void;
}

interface CurrentPickingOptions {
  readonly domElement: HTMLCanvasElement;
  readonly camera: THREE.Camera;
  readonly markerGroup: THREE.Group;
  readonly callbacks: CurrentPickingCallbacks;
}

function regionHit(
  event: MouseEvent,
  domElement: HTMLCanvasElement,
  camera: THREE.Camera,
  markerGroup: THREE.Group,
) {
  const rect = domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 0.05 };
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(markerGroup.children, true)[0];
  if (!hit) return { id: null, object: null, rect };

  let object: THREE.Object3D | null = hit.object;
  while (object && !object.userData.rid && object.parent) object = object.parent;
  const id = object?.userData.rid;
  return {
    id: typeof id === 'string' ? id : null,
    object,
    rect,
  };
}

/** Owns the current marker-only raycast and its DOM listeners. */
export function createCurrentPickingRuntime({
  domElement,
  camera,
  markerGroup,
  callbacks,
}: CurrentPickingOptions): CurrentPickingRuntime {
  const handleClick = (event: MouseEvent) => {
    const hit = regionHit(event, domElement, camera, markerGroup);
    if (!hit.id || !hit.object) {
      callbacks.onRegionClick(null);
      return;
    }

    const projected = new THREE.Vector3();
    hit.object.getWorldPosition(projected);
    projected.project(camera);
    const screenPos = {
      x: (projected.x * 0.5 + 0.5) * hit.rect.width + hit.rect.left,
      y: (-projected.y * 0.5 + 0.5) * hit.rect.height + hit.rect.top,
    };

    if (callbacks.getSelectedRegion() === hit.id) {
      callbacks.onRegionClick(null);
    } else {
      callbacks.onRegionClick(hit.id, screenPos);
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    const hit = regionHit(event, domElement, camera, markerGroup);
    if (hit.id) {
      document.body.style.cursor = 'pointer';
      callbacks.onRegionHover(hit.id, event);
    } else {
      document.body.style.cursor = 'default';
      callbacks.onRegionHover(null);
    }
  };

  domElement.addEventListener('click', handleClick);
  domElement.addEventListener('mousemove', handleMouseMove);

  return {
    dispose() {
      domElement.removeEventListener('click', handleClick);
      domElement.removeEventListener('mousemove', handleMouseMove);
    },
  };
}
