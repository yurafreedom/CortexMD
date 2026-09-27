# NV-0 BrainCanvas seams and characterization

> **CURRENT PRODUCT CHARACTERIZATION — NOT A TARGET RENDERER, SCIENTIFIC VALIDATION, OR ATLAS MAPPING**

## Start state

NV-0 started from `main` at accepted Wave 2 commit `d3e5451c73b46849d203055ff0b7455e587e09a5`; `origin/main` and annotated tag `phase-1-wave2-accepted` resolved to the same commit and the working tree was clean. The implementation is intentionally left uncommitted for human review.

`BrainCanvas.tsx` was 690 lines with five direct import sources. It used no React state, but owned 14 refs, three effects and two stable DOM callbacks. It combined the public React contract, mutable prop synchronization, renderer/camera/controls/lights, eager GLTF loading, material replacement, wireframe duplication, procedural fallback, particles, legacy markers and tracts, pharmacology-ID visual activation, marker raycasting, viewport resize, continuous animation, opacity updates, DOM ownership, and partial teardown.

## Seams introduced

| Seam | File | Current responsibility |
|---|---|---|
| React controller | `src/components/Brain3D/BrainCanvas.tsx` | Keeps `BrainCanvasProps`, latest-prop synchronization, component lifetime, panel-transition resize triggers, overlay-state forwarding, and the container element. |
| Renderer lifecycle | `src/visualization/brain/core/renderer-lifecycle.ts` | Creates the instance-local scene, camera, renderer, controls, lights and clock; orchestrates current asset, overlays, picking, viewport listener and frame loop; owns top-level teardown. |
| Current asset adapter | `src/visualization/brain/core/current-asset-adapter.ts` | Eagerly requests `/brain.glb`, preserves the imported-model transform and material replacement, adds the same wireframe/particles, and retains the procedural load-error fallback. |
| Current illustrative overlays | `src/visualization/brain/core/current-illustrative-overlays.ts` | Creates and updates the current markers, hitboxes, rings and tracts from the unchanged legacy `RG`/`TR` inputs and hard-coded current visual activation rules. |
| Picking | `src/visualization/brain/core/current-picking.ts` | Owns marker-only raycasts, pointer/click listeners, hover cursor, selected-region toggle, and screen-position projection. |
| Continuous frame owner | `src/visualization/brain/core/render-scheduler.ts` | Owns exactly one current always-on RAF chain and cancels its latest handle. It is deliberately not a demand scheduler. |

After extraction, `BrainCanvas.tsx` is 91 lines with two direct import sources, no React state, three refs and three effects. It remains the React integration boundary; it does not import Three.js or legacy region data directly. The public barrel and `BrainCanvasProps` remain unchanged.

## React and Three boundary

React owns component lifetime, application props/callbacks, latest-prop synchronization, panel transition notifications, and attachment of one runtime to one container. The extracted client runtime owns Three.js scene mechanics and resources. Runtime modules contain no React hooks, global scene singleton, V1/V2 store import, Supabase, AI, TVB, simulation, or patient-data dependency.

The route still statically imports the Brain3D barrel, the barrel still statically exports `BrainCanvas`, and the runtime still statically imports Three.js, OrbitControls and GLTFLoader. There is no dynamic import, Suspense boundary, intent gate, or delayed asset request in NV-0.

## Resource ownership

| Resource | Created by | Owned/updated by | Current teardown |
|---|---|---|---|
| `WebGLRenderer` and canvas | renderer lifecycle | renderer lifecycle; size and render calls are runtime-owned | `renderer.dispose()` and canvas removal |
| `Scene` | renderer lifecycle | renderer lifecycle; child objects are attached by asset/overlay seams | reference released; no scene-wide resource traversal |
| `PerspectiveCamera` | renderer lifecycle | resize changes aspect/projection; OrbitControls changes transform | no explicit disposal exists |
| `OrbitControls` | renderer lifecycle | updated every frame | `controls.dispose()` |
| Clock | renderer lifecycle | continuous frame callback | reference released |
| GLTF loader/scene and loaded meshes | current asset adapter | adapter transforms and attaches the model | no abort and no scene traversal/disposal |
| Loaded geometry | GLTFLoader/current asset adapter | rendered by loaded meshes and shared wireframe clones | not explicitly disposed |
| Replacement brain materials | current asset adapter | opacity updated each frame | not explicitly disposed |
| Imported GLTF materials/textures | GLTFLoader | replaced for display; texture is not used by the replacement material | not explicitly disposed |
| Wireframe geometry/material | current asset adapter | geometry is shared with the source mesh; material is adapter-created | not explicitly disposed |
| Particle geometry/material/object | current asset adapter | rotation and opacity shimmer updated each frame | not explicitly disposed |
| Marker/hitbox/ring geometry and materials | illustrative overlays | overlay state and per-frame pulse/billboard updates | not explicitly disposed |
| Tract geometry/material/objects | illustrative overlays | state activation and per-frame opacity pulse | not explicitly disposed |
| Resize listener | renderer lifecycle | calls the instance resize function | removed on runtime disposal |
| Click/mousemove listeners | picking runtime | marker raycast and callbacks | removed on picking disposal |
| RAF handle | continuous frame owner | schedules the next frame before current updates, matching the prior loop | latest handle cancelled on runtime disposal |

NV-0 deliberately does not introduce new geometry/material/texture disposal semantics. Complete loaded-resource disposal belongs to NV-2 after it is paired with asset lifecycle and remount measurements.

## Current frame lifecycle

Mount creates the runtime, starts the eager GLTF request, installs one viewport listener and two canvas pointer listeners, performs the initial resize, and starts one continuous RAF loop. The first frame still renders synchronously while scheduling the next frame.

Each frame reads the latest React-provided state, reads elapsed time, updates OrbitControls, pulses eligible markers/rings/active tracts, rotates and shimmers particles when present, propagates brain opacity, and renders the scene. Unmount cancels RAF first, removes the resize and pointer listeners, disposes controls/renderer, and removes the canvas.

There is no idle state, invalidation API, hidden-tab pause, reduced-motion policy, narrative scheduler, or numeric playback scheduler.

## Asset lifecycle and error characterization

- Asset path remains `/brain.glb` and loading starts during runtime creation at `BrainCanvas` mount.
- `public/brain.glb` remains 43,191,068 bytes with SHA-256 `8f0babae064319fd8d9520148ca5d31ce70938b2edd4db2dced960e4caffe8cf`.
- Successful load preserves bounding-box centering, maximum-dimension scale `2`, `+0.1` Y offset, material values, per-mesh wireframe clones, largest-mesh particle source, and overlay initialization timing.
- GLB load error still creates the procedural fallback brain and then initializes overlays; there is no user-visible error message.
- WebGL renderer construction failure is not handled locally and remains an error boundary/runtime gap.
- A loaded mesh selected for particles is still assumed to have a position attribute. No invalid-geometry recovery was added.
- A missing React container causes the mount effect to return without creating a runtime.
- GLTF loading is not abortable here. A callback arriving after unmount may populate the detached scene; this is documented debt rather than a silent lifecycle change.

## Interaction lifecycle

Picking still raycasts only the marker group, including invisible child hitboxes and rings; it does not pick GLB vertices. Hover sets the body cursor and delegates the legacy region ID. Click toggles an already-selected region, clears on empty space, and projects the hit object to the same canvas-relative screen coordinate used by the existing popup. Camera configuration, damping, distance limits, target, resize behavior and panel-transition delay are unchanged.

## Legacy illustrative semantics

The current region coordinates are **legacy/illustrative product coordinates**, not atlas-backed scientific regions. The 15 region keys, raw XYZ values and 11 tract records in `src/data/brainRegions.ts` are byte-identical to the accepted start state.

Current tracts are illustrative product paths. Their visibility is driven by the existing hard-coded drug-ID lists, not measured structural/functional connectivity. Current particles are a random outward-offset surface effect, not measured activity, neural signal, or simulation output. Any positive active drug still raises every marker's current visual intensity. NV-0 adds no semantic region ID, atlas mapping, scientific truth vocabulary, receptor map, mechanism graph, or simulation meaning.

## What remains intentionally unchanged

Appearance, scale, position, camera, controls, lighting, transparent background, opacity, wireframe, particles, markers, tracts, selection, hover, conflicts, deficit dimming, resize behavior, route integration, eager dependency reachability, eager GLB request, continuous animation, public props, barrel exports, surrounding controls, product copy, CSS, the GLB bytes, and pharmacology behavior are intentionally unchanged.

The accepted bundle baseline remains 498,316 bytes normalized initial-route gzip with Three.js present in the initial graph. Two clean NV-0 builds produced an identical 498,784-byte result: a 468-byte (+0.094%) structural-layout delta, within the unchanged 5,120-byte allowance, with one Three.js initial asset. The accepted fixture is not rewritten. Historical audit measurements—60 draw calls, approximately 2.34 million triangles, approximately 3.50 million lines and approximately 16.2 FPS—remain historical and were not re-measured as fresh performance results.

## Later replacement points

- NV-1 can replace the current eager-loading and continuous-frame orchestration through the runtime/frame seams without changing `BrainCanvasProps`.
- NV-2 can replace the current asset adapter and implement a reviewed asset manifest, optimization and complete resource disposal.
- NV-3 must introduce reviewed semantic region/atlas contracts and mappings; it must not reinterpret `RG` coordinates automatically.

NV-0 does not create a `LayerHost`, renderer redesign, optimized asset, atlas, mechanism model, timeline, simulation contract, TVB integration, receptor atlas, patient feature, pharmacology consumer migration, or accessible 3D table equivalent.

## Rollback

The extracted functions can be inlined behind the unchanged `BrainCanvasProps` and Brain3D barrel. No asset, route, persistence, API, dependency, locale, CSS, or data migration requires reversal.
