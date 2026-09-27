# CortexMD current architecture atlas

> **CURRENT ARCHITECTURE CHARACTERIZATION — NOT A TARGET ARCHITECTURE OR SCIENTIFIC VALIDATION**

The historical characterization baseline is `6d98af672fe9c7dc4a8709734fec9b8d9a10cd9b`. The current working-tree snapshot was generated on accepted Wave 2 commit `d3e5451c73b46849d203055ff0b7455e587e09a5` and includes the uncommitted NV-0 BrainCanvas seams; it does not claim that those files are contained in that commit. This atlas describes behavior and dependency reachability, not scientific or clinical validity.

## Scope and reproducibility

- `scripts/audit-current-architecture.mjs --assert --json` parses TypeScript/JavaScript imports with the repository's TypeScript compiler. It resolves aliases, relative imports, re-exports, dynamic imports and `require`, and ignores `.DS_Store` metadata.
- `scripts/audit-pharmacology-completeness.ts --assert` recomputes scientific-completeness facts from the live V1/V2 records.
- `module-catalog.json` is the generated file-level working-tree catalog. Its summary and modules must match the live graph exactly; its characterization baseline and working-tree base commits must remain in current `HEAD` history.
- Import-graph reachability is conservative. A reported risk is a review location, not proof of a runtime defect. Framework conventions and E2E-only coverage can exceed what source imports reveal.

## Current shape

```text
Next.js routes and client page
  ├─ UI components / hooks
  │    ├─ V1 records + V1 heuristic helpers
  │    ├─ V2 records + indicator calculations
  │    ├─ brain/region datasets
  │    └─ localStorage scheme/preset contracts
  ├─ API routes
  │    ├─ Supabase persistence
  │    └─ Anthropic serialization
  └─ assets / locale messages / styles
```

Current production data, calculation, projection, persistence, AI serialization, and UI imports still form a shared dependency cone. Accepted Wave 1 adds the model/validation boundary. Wave 2 adds an unread public repository port and one private V1 compatibility adapter, but no canonical current dataset or production read path.

NV-0 moves current Three.js mechanics from `BrainCanvas.tsx` into five instance-local runtime seams under `src/visualization/brain/core/`. Loading remains eager, the continuous frame loop remains active, the legacy region/tract input remains illustrative, and Three.js remains in the initial client graph.

## Graph baseline

| Measure | Current value |
|---|---:|
| Files catalogued under `src/` | 149 |
| Runtime production modules | 146 |
| Build-time/migration modules under `src/scripts/` | 3 |
| Internal import edges | 286 |
| Direct V1 / V2 / dual production consumers | 14 / 6 / 2 |
| Transitive V1 / V2 / dual production consumers | 19 / 11 / 7 |
| Pharmacology/scientific dependency modules | 46 |
| Runtime circular dependencies | 0 |
| Unresolved internal imports | 0 |
| Server/client reachability review rows | 3 |
| Barrel modules | 4 |
| Heavy-package or full-data client reachability rows | 29 |
| Deep cross-area alias/parent imports | 187 |
| Top-level construction/expression review rows | 14 |
| Static multi-responsibility candidates | 27 |

The V1/V2 counts match the accepted discovery evidence. Type-only edges are catalogued but excluded from runtime cycle and transitive-runtime calculations.

## Boundary, barrel, cost and side-effect findings

- `src/app/admin/(auth)/AdminDashboard.tsx` imports a Next.js server action and therefore reaches `actions.ts`, `admin-session.ts`, and `supabase-server.ts`. The direct server-action import is an expected framework pattern; the three rows are retained as a boundary-review baseline, not declared violations.
- Runtime cycles: none. The apparent `AdminDashboard.tsx` ↔ `page.tsx` loop is type-only in one direction and is not a runtime cycle.
- The existing UI barrels are `src/components/Brain3D/index.ts` and `src/components/IndicatorPopup/index.ts`; both have one consumer (`src/app/page.tsx`). Wave 1 adds the type-focused `src/domains/pharmacology/model/index.ts` surface. Wave 2 adds the type-only `src/domains/pharmacology/repository/index.ts` port. Only the private compatibility adapter consumes the two domain barrels; no outside production module does.
- `src/app/page.tsx` reaches Three.js, Supabase, V1, and V2. `BrainCanvas.tsx` and four extracted visualization-core modules reach Three.js; these are decomposed rows for the same eager client dependency, not additional shipped copies. Twenty-three other client modules reach a full V1 or V2 dataset and/or Supabase. This is a client bundle/reachability risk; import count by itself is not treated as a performance defect.
- Top-level calls are reported for review. Several are deterministic initialization (`next/font` and schema construction), not necessarily side effects. The three `src/scripts/*` rows are build-time only. Wave 2 makes no runtime optimization or dynamic-import change.

## Deep pharmacology dependency cone

Every cone file is listed below. The machine catalog adds exact imports, consumers, exports, import-graph test reach, risks, proposed destination, and wave.

The accepted Wave 1 model/validators and Wave 2 public port remain outside all UI/API/AI/persistence read paths. The private Wave 2 compatibility adapter is the one new member of the legacy dependency cone: it reads V1 only and has no outside production consumer. It defines no V2 importer, canonical current dataset, PK/regional migration, or compatibility precedence change.

| Current file | Distinct current responsibilities / architectural mixing |
|---|---|
| `src/data/drugs.ts` | V1 record source; legacy labels, dose/warning policy, Ki, sigma/CYP flags, and regional narrative payload in one record model. |
| `src/data/drugs.v2.ts` | Generated V2 records; bindings, placeholder PK, CYP, metabolites, region membership, and copied legacy compatibility fields. |
| `src/domains/pharmacology/compatibility/current-read-repository.ts` | Private unread V1-to-canonical projection; exact identities, 90 current-compatible Ki rows, explicit epistemic state, and no V2/CYP-policy activation. |
| `src/types/pharmacology.ts` | V2 drug, binding, PK, metabolite, CYP, receptor and region contracts; model does not express knowledge/evidence state. |
| `src/constants/receptor-weights.ts` | Calculation weights tied to V2 target identifiers. |
| `src/data/regional-density.ts` | Regional target-density facts/conventions used by regional calculations; data plus normalization assumptions. |
| `src/data/brainRegions.ts` | Region metadata used by visual and pharmacology projections. |
| `src/data/acb-scale.ts` | ACB current records used in downstream clinical-looking projections. |
| `src/lib/pharmacology.ts` | V1 lookup, CYP exposure policy, occupancy approximation, regional scoring, and fallbacks: source-data access + heuristic calculation. |
| `src/lib/sigma1.ts` | V1 sigma lookup and balance heuristic. |
| `src/lib/indicators/conditional.ts` | Cross-indicator conditional adjustments and current zero/missing conventions. |
| `src/lib/indicators/dopamine.ts` | Dopamine projection over shared V2 balance. |
| `src/lib/indicators/norepinephrine.ts` | Norepinephrine projection over shared V2 balance. |
| `src/lib/indicators/serotonin.ts` | Serotonin projection over shared V2 balance. |
| `src/lib/indicators/glutamate.ts` | Glutamate projection plus conditional GABA/glutamate behavior. |
| `src/lib/indicators/sigma1.ts` | V2 sigma projection over shared balance. |
| `src/lib/indicators/regionalBalance.ts` | V2 binding projection, manual target aliases, regional-density lookup, and unmapped-target fallback: scientific input + heuristic. |
| `src/app/api/chat/route.ts` | AI request validation, V1 drug lookup/alias resolution, active-scheme serialization, profile context, prompt assembly, and Anthropic call. Model + serialization + external API. |
| `src/hooks/useScheme.ts` | Active scheme state, unversioned localStorage/preset reads/writes, V1 ID validation, and default-dose selection. Domain IDs + persistence. |
| `src/app/page.tsx` | Dashboard orchestration, active-drug materialization, V1/V2 component wiring, profile/brain/UI state, and heavy-client dependencies. |
| `src/app/profile/page.tsx` | Profile route composition that reaches V2 through dashboard/history UI. |
| `src/app/profile/ProfileDashboard.tsx` | Profile UI orchestration and V2 drug-data reachability. |
| `src/app/profile/TreatmentHistoryForm.tsx` | Treatment UI, V2 labels/unit display, and API serialization through legacy `dose_mg`. Persistence + view logic. |
| `src/components/Brain3D/BrainCanvas.tsx` | React lifecycle and current application-state connection for the extracted instance-local Three.js runtime. |
| `src/components/Brain3D/index.ts` | Re-export boundary exposing `BrainCanvas`. |
| `src/visualization/brain/core/current-illustrative-overlays.ts` | Current legacy XYZ marker/tract rendering and hard-coded pharmacology-ID visual activation; explicitly not atlas semantics. |
| `src/visualization/brain/core/renderer-lifecycle.ts` | Current eager renderer/runtime orchestration reaching the illustrative overlay input through its owned seam. |
| `src/components/BrainDeficits/DeficitsModal.tsx` | Deficit UI with V1 drug lookup/labels. |
| `src/components/Deficits/DeficitCard.tsx` | Deficit presentation and V1 ID-to-drug projection. |
| `src/components/Deficits/DeficitList.tsx` | Deficit list orchestration and V1-dependent child graph. |
| `src/components/Drugs/ActiveScheme.tsx` | V1 labels/dose/warning presentation, dose editing, and removal behavior. |
| `src/components/Drugs/ConflictBox.tsx` | V1 scheme materialization plus rule-based conflict presentation. |
| `src/components/Drugs/DoseSlider.tsx` | V1 selectable doses, bounds, warning threshold and persisted selection callback. |
| `src/components/Drugs/DrugCatalog.tsx` | V1 catalog/search/default behavior plus V2 reach; data selection + React projection. |
| `src/components/GlutamateCascade/GlutamateCascadeOverlay.tsx` | V2 active-drug glutamate cascade calculation and visualization. Calculation + UI. |
| `src/components/IndicatorPopup/DopaminePopup.tsx` | Dopamine calculation result formatting and popup UI. Calculation + UI. |
| `src/components/IndicatorPopup/GlutamatePopup.tsx` | Glutamate/GABA result formatting and popup UI. Calculation + UI. |
| `src/components/IndicatorPopup/NorepinephrinePopup.tsx` | Norepinephrine result formatting and popup UI. Calculation + UI. |
| `src/components/IndicatorPopup/SerotoninPopup.tsx` | Serotonin result formatting and popup UI. Calculation + UI. |
| `src/components/IndicatorPopup/index.ts` | Re-export surface for indicator popup implementations. |
| `src/components/Panels/BottomBar.tsx` | Mixed V1 regional/CYP behavior and V2 indicator projection in a client status bar. Dual source + calculation + UI. |
| `src/components/Panels/LeftPanel.tsx` | Drug/deficit panel orchestration; reaches both data versions. |
| `src/components/Panels/RegionalDensityCard.tsx` | V2 regional calculation and formatted percentage display. Calculation + UI. |
| `src/components/Panels/RightPanel.tsx` | V1 regional narratives and V2 density in one panel graph. Semantically distinct regional models + UI. |
| `src/components/Panels/ZonePopup.tsx` | V1 `z` narrative/intensity/harm display with fallback behavior. |
| `src/components/Presets/PresetComparisonModal.tsx` | V1 preset IDs/labels plus V2 multi-indicator calculations and comparison UI. Dual source + calculation + UI. |
| `src/components/Sigma1/CascadeOverlay.tsx` | V1/V2 sigma inputs, pathway projection and visualization. Dual source + heuristic + UI. |

## Persistence and serialization boundaries

| Boundary | Current versionless shape | Risk |
|---|---|---|
| `localStorage:cortexmd_scheme` | `Record<drugId, number>` | No schema/version or unit tag; backward reader discards invalid IDs/values. |
| `cortexmd_preset_*` | `Record<drugId, number>` | Same implicit identity/dose contract. |
| `schemes.drugs` / `scheme_history.drugs` | JSONB | No database schema/version constraint. |
| `user_presets.drugs` | JSONB | API stores the numeric drug map unversioned. |
| `user_treatment_history` | `drug_id`, `dose_mg`, dates and optional outcomes | Non-mg records still flow through `dose_mg`; unit is not stored. |
| AI context | V1 label, aliases, Ki, sigma type, dose options/unit plus versionless active scheme | UI-preserving migration can still alter AI behavior. |

## Scientific completeness snapshot

Current repository evidence: 116/116 IDs with exact parity; 349 parent bindings; 268 have a `source` string, including 261 literal `needs verification`; 81 have no source; 7 contain non-sentinel citation text; 0 are explicitly verified by the schema. There are 11 zero-Ki sentinels and 12 intrinsic-efficacy rows. All 580 main PK numeric fields are zero placeholders across 116 records; PET entries are 0. There are 3 metabolite records (8 bindings, 3 sourced bindings), 111 empty indication arrays, five dose-unit families, four non-mg records, seven target-normalization issue classes, 123 legacy-field divergences, and 23 unresolved `BLOCKS_MIGRATION` decisions.

## Wave 2 working-tree status

Accepted Wave 1 supplies the foundational canonical language and validators. The current reviewable Wave 2 adds a two-operation read port plus one private, schema-validated, deeply frozen V1 projection. Exact identity is case-sensitive and produces explicit `FOUND`, `NOT_FOUND`, or `INVALID_ID` results. No alias, display-name, fuzzy, trim, or lowercasing lookup is implemented.

It projects all 116 current V1 identities and their 90 Ki rows without mapping the 349 V2 bindings, interpreting the 11 zero-Ki rows, migrating 580 PK placeholders, activating the 259 binding-count delta, modeling current regional/metabolite data, or resolving HR-001 through HR-023. V1 CYP policy is quarantined rather than converted into scientific metabolism claims. There is no production consumer, formula, persistence, AI, API, or UI switch.

Before any Wave 3 production read migration, humans must accept this repository boundary and choose a single narrow consumer. Evidence curation, zero-Ki interpretation, dose/warning policy, PK and regional models, active-metabolite design, and all 23 behavior-critical precedence decisions remain unresolved.
