# Proposed module-boundary plan

> **FUTURE PLAN FOR HUMAN REVIEW. NO SPLIT OR READ SWITCH WAS IMPLEMENTED IN WAVE 0.**

The groups below cover the high-risk pharmacology cone and all import-graph multi-responsibility candidates in the Wave 0 catalog. They are cohesive boundary proposals, not a request to create one file per function.

## 1. Canonical identity, evidence, quantity and data

**CURRENT FILES:** `src/types/pharmacology.ts`, `src/data/drugs.ts`, `src/data/drugs.v2.ts`, `src/constants/receptor-weights.ts`, `src/data/regional-density.ts`

**CURRENT RESPONSIBILITIES:** V1 legacy contracts; generated V2 data; scientific bindings; compatibility dose/warning fields; PK placeholders; evidence strings; CYP/metabolites; target/region identifiers; calculation policy weights and densities.

**PROBLEM:** Facts, unknown/sentinel states, compatibility policy and calculation inputs are structurally co-located. V2 activation can introduce 259 unreviewed bindings and cannot distinguish reviewed, unresolved, missing or placeholder states.

**IMPLEMENTED WAVES 1–2:** Wave 1 provides `model/*` and responsibility-aligned `validation/*`. Wave 2 adds the type-only `repository/read.ts` port, its public `repository/index.ts`, and private `compatibility/current-read-repository.ts`. The adapter projects V1 identities and Ki rows only; no current V2 record is canonicalized.

**DEPENDENCY DIRECTION:** value model → validation; curated/raw input → validation → normalized model → calculations. Compatibility adapters depend on the model, never the reverse.

**PUBLIC INTERFACE:** branded IDs, unit-tagged quantities, explicit evidence/knowledge states, immutable canonical drugs, and a read-only repository with stable listing plus exact-ID `FOUND` / `NOT_FOUND` / `INVALID_ID` lookup.

**PRIVATE IMPLEMENTATION:** the Wave 2 compatibility adapter alone imports raw V1. It validates and freezes a bounded projection. It does not import V2, resolve aliases, expose legacy shapes, or convert CYP policy into scientific relationships. Reviewed alias tables and curated loaders remain future work.

**TEST BOUNDARY:** schema acceptance/rejection plus independent V1/V2 fixture parity for identity, ordering, names, targets, units, epistemic/evidence state, zero-Ki quarantine, CYP/metabolism quarantine, exact lookup, immutability, and import reachability.

**MIGRATION WAVE:** Wave 2 repository implemented but unread by production. A Wave 3 consumer requires separate human acceptance and authorization.

**RISK:** accidental canonical precedence or newly active V2 facts.

**ROLLBACK:** remove the additive Wave 2 port, adapter, tests, and documentation; current production imports remain independently functional and untouched.

## 2. Scientific calculations versus heuristic policy

**CURRENT FILES:** `src/lib/pharmacology.ts`, `src/lib/sigma1.ts`, `src/lib/indicators/balance.ts`, `occupancy.ts`, `conditional.ts`, `regionalBalance.ts`, `dopamine.ts`, `norepinephrine.ts`, `serotonin.ts`, `glutamate.ts`, `sigma1.ts`

**CURRENT RESPONSIBILITIES:** V1 and V2 occupancy, indicator aggregation, intrinsic efficacy, metabolite contribution, CYP dose/exposure policy, conditional rules, regional aliases/density, zero/missing fallbacks and display-ready values.

**PROBLEM:** scientific-looking formulas and explicitly heuristic fallbacks share APIs and unversioned inputs. Zero Ki means zero in one helper and fixed 50% in another.

**PROPOSED MODULES:** pure `calculations/occupancy`, `calculations/binding-contribution`, `calculations/metabolites`, explicit `heuristics/concentration`, `policy/cyp-interaction`, `policy/conditional`, and `regional/projection` after semantics are approved.

**DEPENDENCY DIRECTION:** normalized model → pure calculations → named/versioned heuristic or policy → application projection.

**PUBLIC INTERFACE:** unit-explicit input/result objects carrying method/version, missing-data result and contribution trace.

**PRIVATE IMPLEMENTATION:** numerical aggregation, current fallbacks and compatibility translation.

**TEST BOUNDARY:** current Wave 0 goldens at the adapter boundary; separate future mathematical invariant, policy and missing-data tests.

**MIGRATION WAVE:** Waves 2–4, only after Wave 1 types and human decisions.

**RISK:** silent behavior changes, NaN/nonfinite propagation, activation of V2-only facts.

**ROLLBACK:** select the V1/current implementation at the adapter and remove the new calculation path.

## 3. Scheme state, dose selection and warning UI

**CURRENT FILES:** `src/hooks/useScheme.ts`, `src/components/Drugs/DrugCatalog.tsx`, `ActiveScheme.tsx`, `DoseSlider.tsx`, `ConflictBox.tsx`

**CURRENT RESPONSIBILITIES:** V1 identity validation, defaults/options, selection, warning/max thresholds, conflict display, localStorage and preset persistence.

**PROBLEM:** domain identity and dose/warning policy are embedded in client UI/state. Persistence is versionless and all quantities are numbers even when unit is not mg.

**PROPOSED MODULES:** application `scheme-port`, versioned persistence codec, dose/warning view projection, and presentational controls receiving explicit props.

**DEPENDENCY DIRECTION:** domain policy → application projection/codec → React state/UI.

**PUBLIC INTERFACE:** `SchemeEntry`, compatibility-aware decoder, dose option/warning projection; no full record store.

**PRIVATE IMPLEMENTATION:** localStorage keys, V1 fallback/default behavior and warning CSS decisions.

**TEST BOUNDARY:** HR-001…HR-023 boundaries, malformed/old payloads, non-mg ambiguity, conflict ID rules and user interactions.

**MIGRATION WAVE:** Wave 5 UI, with persistence versioning in Wave 6.

**RISK:** changing selectable doses, defaults, warning presence or saved values.

**ROLLBACK:** restore current `useScheme`/V1 projections while retaining backward readers.

## 4. Panels, popups and comparisons

**CURRENT FILES:** `src/components/Panels/BottomBar.tsx`, `LeftPanel.tsx`, `RightPanel.tsx`, `ZonePopup.tsx`, `RegionalDensityCard.tsx`, `src/components/Presets/PresetComparisonModal.tsx`, the five `src/components/IndicatorPopup/*Popup.tsx` modules, and `src/components/IndicatorPopup/index.ts`

**CURRENT RESPONSIBILITIES:** calculate/format V1 and V2 indicators, regional narratives/density, comparison deltas, status color/text and interactive presentation.

**PROBLEM:** React modules calculate domain values and mix semantically different regional models. Dual-source paths can remain visually plausible while changing values.

**PROPOSED MODULES:** application indicator/comparison/region view projections and thin presentational components. Keep V1 narrative and V2 density as distinct projection types.

**DEPENDENCY DIRECTION:** calculations/policy → application projection → components.

**PUBLIC INTERFACE:** serializable display models with value, status, method/source version and explicit regional semantic kind.

**PRIVATE IMPLEMENTATION:** popup state, layout, CSS and localization keys.

**TEST BOUNDARY:** projection goldens independently from component interaction/a11y; current component fixtures stay as compatibility oracles.

**MIGRATION WAVE:** Waves 4–6 by risk-selected slice.

**RISK:** numerical, textual and color/status drift; narrative/density conflation.

**ROLLBACK:** route each component back to its current projection/calculator.

## 5. AI boundary

**CURRENT FILES:** `src/app/api/chat/route.ts`, `src/lib/aiClient.ts`, `src/components/Chat/ChatPanel.tsx`

**CURRENT RESPONSIBILITIES:** UI chat, request transport, schema validation, V1 lookup/aliases, scheme/profile serialization, prompt assembly, Anthropic SDK construction and response handling.

**PROBLEM:** AI-visible pharmacology is an implicit V1 projection. A UI-compatible migration can change IDs, labels, Ki, sigma, units or missing-drug behavior in the prompt.

**PROPOSED MODULES:** `application/ai/pharmacology-context` serializer, chat transport port, server-only Anthropic adapter, and UI-only chat component.

**DEPENDENCY DIRECTION:** domain/application read model → versioned AI serializer → server-only provider adapter; client → route contract only.

**PUBLIC INTERFACE:** versioned, snapshot-tested AI context DTO and chat request/response DTO.

**PRIVATE IMPLEMENTATION:** provider SDK, system-prompt text and alias lookup mechanism.

**TEST BOUNDARY:** exact serialization snapshots, aliases/missing IDs, prompt-safe text, provider mock and route contract.

**MIGRATION WAVE:** Wave 6.

**RISK:** silent AI advice/context drift and privacy leakage through expanded context.

**ROLLBACK:** select the frozen V1 serializer and provider adapter.

## 6. Persistence, profile and auth-facing UI

**CURRENT FILES:** `src/app/api/scheme/route.ts`, `src/app/profile/TreatmentHistoryForm.tsx`, `ProfileDashboard.tsx`, `profile/page.tsx`, `src/lib/supabase.ts`, `src/app/auth/page.tsx`, `src/components/Profile/DeleteDataZone.tsx`

**CURRENT RESPONSIBILITIES:** versionless scheme echo/storage boundary, treatment forms and `dose_mg`, profile orchestration, Supabase client/configuration, auth forms and destructive-data UI.

**PROBLEM:** storage DTOs are implicit; non-mg data uses an mg-named column; view and persistence logic are coupled in several client modules.

**PROPOSED MODULES:** application repository ports, versioned codecs/migrators, server/client Supabase adapters, treatment DTO projection, and presentational forms.

**DEPENDENCY DIRECTION:** UI → application port → server/client-specific adapter → Supabase; stored DTO → codec → domain model.

**PUBLIC INTERFACE:** versioned storage DTOs with stable IDs/quantities and backward readers.

**PRIVATE IMPLEMENTATION:** table names, Supabase queries, local form state and auth provider details.

**TEST BOUNDARY:** round trips for every historical shape, RLS/server boundary integration, unit preservation and deletion confirmation.

**MIGRATION WAVE:** Wave 6; schema changes separately reviewed.

**RISK:** unreadable saved data, unit corruption, server/client credential leakage and destructive-action errors.

**ROLLBACK:** retain old columns/readers and restore current adapters; never require destructive data rollback.

## 7. Brain and cascade visualization

**CURRENT FILES:** `src/components/Brain3D/BrainCanvas.tsx`, `CanvasControls.tsx`, `index.ts`, `src/visualization/brain/core/*.ts`, `src/components/GlutamateCascade/GlutamateCascadeOverlay.tsx`, `src/components/Sigma1/CascadeOverlay.tsx`, `src/data/brainRegions.ts`

**CURRENT RESPONSIBILITIES:** NV-0 separates the current Three.js renderer lifecycle, model loading, continuous RAF, picking and illustrative overlays behind `BrainCanvas`; camera/control UI, hard-coded drug activation, region metadata, sigma/glutamate calculations and overlay presentation remain current behavior.

**PROBLEM:** heavy optional rendering, domain ID rules and scientific projections meet in client components/barrels.

**PROPOSED MODULES:** brain semantic projection, renderer adapter, lazy route-optional viewer boundary, and presentational controls/overlays. Do not alter `brain.glb`.

**DEPENDENCY DIRECTION:** domain/application projection → visualization DTO → optional renderer; React controls do not own pharmacology rules.

**PUBLIC INTERFACE:** region/activation visualization DTO independent of Three.js.

**PRIVATE IMPLEMENTATION:** GLTF/Three lifecycle, shaders/materials, camera and DOM controls.

**TEST BOUNDARY:** semantic projection tests, renderer smoke tests, visual/E2E interactions and measured bundle gate.

**MIGRATION WAVE:** NV-0 extracts current-behavior seams only; NV-1 loading/scheduling, NV-2 assets/disposal, and NV-3 semantics each require separate authorization.

**RISK:** bundle growth, visual/domain divergence, resource leaks and asset regressions.

**ROLLBACK:** inline the extracted current runtime seams behind the unchanged `BrainCanvasProps` and barrel; keep the eager component and unchanged asset.

## 8. Deficit and rule projections

**CURRENT FILES:** `src/components/Deficits/DeficitCard.tsx`, `DeficitList.tsx`, `src/components/BrainDeficits/DeficitsModal.tsx`

**CURRENT RESPONSIBILITIES:** V1 drug-ID lookup, deficit coverage/rule presentation and list/modal UI.

**PROBLEM:** hard-coded domain ID contracts are consumed through V1 presentation lookups.

**PROPOSED MODULES:** deficit application projection with stable drug references, then presentation-only card/list/modal.

**DEPENDENCY DIRECTION:** deficit/pharmacology IDs → application projection → UI.

**PUBLIC INTERFACE:** localized deficit display model with resolved stable IDs.

**PRIVATE IMPLEMENTATION:** React layout and modal/list state.

**TEST BOUNDARY:** ID compatibility, coverage/blocker rules and UI interactions.

**MIGRATION WAVE:** Wave 5–6 when identifier rules are approved.

**RISK:** silent loss of coverage/blocker matches after ID migration.

**ROLLBACK:** retain V1 lookup projection.

## 9. Application composition root

**CURRENT FILE:** `src/app/page.tsx`

**CURRENT RESPONSIBILITIES:** dashboard state and composition, V1/V2 materialization, profile/brain/panel/chat orchestration, client loading of data and heavy libraries.

**PROBLEM:** the composition root reaches nearly every layer and both pharmacology stores, magnifying accidental client reachability.

**PROPOSED MODULES:** server route shell, narrow client dashboard controller and feature-level application projections.

**DEPENDENCY DIRECTION:** server loaders/application services → serialized page model → client composition → presentational features.

**PUBLIC INTERFACE:** minimal page DTO and feature callbacks.

**PRIVATE IMPLEMENTATION:** layout/state coordination.

**TEST BOUNDARY:** critical-flow E2E plus page-model integration tests.

**MIGRATION WAVE:** incremental Waves 3–6; never a big-bang page rewrite.

**RISK:** widespread regression and initial-bundle growth.

**ROLLBACK:** migrate one projection/feature at a time and restore its previous wiring.

## 10. Administrative parser

**CURRENT FILE:** `src/lib/admin/claudeCodeParser.ts`

**CURRENT RESPONSIBILITIES:** parse external task text, normalize fields and produce admin application records.

**PROBLEM:** parsing and application normalization have separate reasons to change; this is outside pharmacology scope.

**PROPOSED MODULES:** parser and admin DTO mapper only if future changes require independent evolution.

**DEPENDENCY DIRECTION:** raw external text → parser result → validated admin DTO.

**PUBLIC INTERFACE:** typed parse result with explicit errors.

**PRIVATE IMPLEMENTATION:** text patterns and normalization rules.

**TEST BOUNDARY:** parser fixtures and DTO validation.

**MIGRATION WAVE:** outside Phase 1 pharmacology.

**RISK:** malformed administrative imports.

**ROLLBACK:** retain the current combined parser.

## Wave 1 accepted foundation and Wave 2 reviewable working tree

The accepted Wave 1 foundation is:

```text
src/domains/pharmacology/model/ids.ts
src/domains/pharmacology/model/knowledge.ts
src/domains/pharmacology/model/evidence.ts
src/domains/pharmacology/model/quantity.ts
src/domains/pharmacology/model/target.ts
src/domains/pharmacology/model/interaction.ts
src/domains/pharmacology/model/metabolism.ts
src/domains/pharmacology/model/drug.ts
src/domains/pharmacology/model/index.ts
src/domains/pharmacology/validation/primitives.ts
src/domains/pharmacology/validation/epistemics.ts
src/domains/pharmacology/validation/target.ts
src/domains/pharmacology/validation/interaction.ts
src/domains/pharmacology/validation/metabolism.ts
src/domains/pharmacology/validation/drug.ts
src/domains/pharmacology/README.md
```

Wave 2 adds only:

```text
src/domains/pharmacology/repository/read.ts
src/domains/pharmacology/repository/index.ts
src/domains/pharmacology/compatibility/current-read-repository.ts
tests/unit/domains/pharmacology/repository.test.ts
```

The private adapter represents all 116 current V1 records and 90 V1 Ki rows. No canonical current dataset, V2 importer, calculation switch, or production read is included. The 116 V2 records and 349 bindings remain legacy characterization; the 259 binding-count delta and all V2 zero-Ki rows remain unreviewed and inactive in the repository.
