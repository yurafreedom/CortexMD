# Dependency rules for Phase 1+

> **PROPOSED FOR HUMAN REVIEW — NOT IMPLEMENTED BY WAVE 0**

## Direction

Future pharmacology dependencies should point downward only:

```text
raw/curated scientific data
  ↓
normalized domain model + validation
  ↓
derived scientific calculations
  ↓
explicit heuristic/policy models
  ↓
application projections and ports
  ↓
UI / API / AI / persistence adapters
```

Lower layers must not import higher ones. In particular:

- domain model must not import React, Next.js, Supabase, Anthropic, UI labels or storage;
- scientific data must not contain UI formatting or current heuristic output text;
- calculations must not import components;
- repositories/adapters must not import page components;
- server-only modules must not become reachable from client modules except through reviewed framework boundaries such as server actions;
- persistence and AI payloads must be explicit adapters, not the canonical model itself.

## Cohesion

The preferred rule is **one module/file per cohesive responsibility and reason to change**, not one function per file. Split only for a separate domain concept, data/calculation boundary, scientific/heuristic boundary, server/client boundary, persistence/domain boundary, loading-cost boundary, stable reusable interface, or independently testable policy.

File length, function count and import count alone are not reasons to split. Static imports form the build graph; actual cost signals are unexpected client reachability, bundle growth, top-level effects, tree-shaking barriers, cycles, giant barrels and server/client leakage.

## Proposed enforceable boundaries

| Layer | May import | Must not import |
|---|---|---|
| `domains/pharmacology/model` | same-layer value types only | data records, calculations, React, Next, storage, AI |
| `domains/pharmacology/validation` | model | current V1/V2 stores, UI, persistence, external clients |
| curated/raw data | model + validation | calculations, heuristics, UI, persistence |
| derived calculations | model, validated projections | UI, storage, AI, raw version-specific stores |
| heuristic/policy | model, calculations, versioned policy inputs | React/components, direct persistence |
| application projections/ports | domain public interfaces | page/components as dependencies |
| adapters | domain/application ports + external SDK | page/components |
| UI/API/AI serializers | narrow application/domain interfaces | full datasets unless a reviewed loading boundary requires them |

Wave 1 validation should add automated import-boundary checks only after paths and public interfaces are approved. The Wave 0 analyzer is diagnostic, not an enforcement framework.

## Server/client and loading policy

- Canonical records should load server-side by default. Client projections should contain only fields needed for the current view.
- Do not dynamically import merely to make an import list shorter.
- Consider dynamic loading later for route-optional Three.js/3D and simulation viewers, based on measured bundle/runtime evidence.
- Server actions may be imported by clients under Next.js rules, but their dependencies and serialized arguments/results remain an explicit review boundary.
- External SDK clients should not be constructed in modules reachable by arbitrary client graphs.

## Barrel policy

Current barrels are small and may remain. Future policy:

- prefer explicit imports across scientific, server, persistence, heavy-library and legacy-adapter boundaries;
- permit a narrow, reviewed domain public API that exports stable types/functions only;
- never use a giant barrel to expose server-only code, full datasets, heavy libraries or legacy adapters;
- do not re-export private implementation or both canonical and compatibility stores from the same public surface;
- test that client-facing barrels cannot reach server-only modules.

## Documentation convention

Each future domain should have:

- a short domain README covering purpose, ownership, boundaries and dependency direction;
- typed public interfaces;
- JSDoc on exported or non-obvious APIs;
- ADRs for consequential architecture/science-policy decisions;
- tests as executable contracts.

Scientific or heuristic calculations should document purpose, inputs, units, outputs, scientific/heuristic status, method/version, missing-data behavior, assumptions, limitations, evidence expectations and contract tests. Do not use “validated” unless the evidence model supports that statement.
