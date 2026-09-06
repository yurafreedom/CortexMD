# Technical and scientific debt register

> **CURRENT-STATE FINDINGS — NOT SCIENTIFIC VALIDATION AND NOT AUTHORIZATION TO FIX**

“Blocks Wave 1” means the decision is required to define the additive canonical model/validation surface safely. Several other items block later read migration even when they do not block unread Wave 1 files.

| ID | Category | Location | Description and evidence | Current impact | Future risk | Severity | Recommended phase/wave | Blocks Wave 1? |
|---|---|---|---|---|---|---|---|---|
| TD-001 | BUG_OR_POTENTIAL_BUG | `src/lib/indicators/occupancy.ts`, `balance.ts`, `regionalBalance.ts` | The 11 zero-Ki rows return zero in direct occupancy but contribute fixed 50% in shared/regional paths at positive dose. | Internally inconsistent current results. | A refactor can silently select one meaning. | Critical | Decide semantics before Wave 4 | No; blocks calculation switch |
| TD-002 | BUG_OR_POTENTIAL_BUG | `src/lib/indicators/regionalBalance.ts` | Unmapped targets silently use density `1.0`. | A normalization miss appears fully dense. | New targets can inflate regional outputs. | High | Wave 2–4 alias/fallback decision | Yes: validation rule |
| TD-003 | ARCHITECTURAL_DEBT | 43-module pharmacology cone | V1/V2 data, calculation, heuristics, projections and UI have no domain boundary; analyzer shows 18/11 transitive consumers and 7 dual paths. | Changes have broad blast radius. | Canonicalization becomes a big-bang migration. | High | Waves 1–6, narrow slices | No |
| TD-004 | ARCHITECTURAL_DEBT | `src/app/page.tsx` | Composition root reaches V1, V2, Supabase and Three.js. | Broad client dependency graph. | Feature changes increase coupling/bundle. | High | Waves 3–6 composition seams | No |
| TD-005 | ARCHITECTURAL_DEBT | `src/data/drugs.v2.ts` | Scientific fields and legacy compatibility dose/warning fields share one generated record. | Precedence is implicit per consumer. | “Canonical” reads can activate unintended behavior. | Critical | Wave 1 model separation; adapters later | Yes |
| TD-006 | MIGRATION_BLOCKER | HR-001…HR-023 fixture | All 23 behavior-critical dose/warning/default/max differences remain `BLOCKS_MIGRATION`. | V1 remains compatibility oracle. | V2 read switch changes user choices/warnings. | Critical | Human review before Wave 5 | No; blocks affected read migration |
| TD-007 | MIGRATION_BLOCKER | `src/data/drugs.v2.ts` bindings | 259 V2-only parent bindings have no V1 Ki row. | Current V2 calculations may use facts absent from V1 views. | A switch silently activates unreviewed content. | Critical | Per-row evidence gate before Wave 4 | No; blocks activation |
| TD-008 | MIGRATION_BLOCKER | target namespace + aliases | Receptors, transporters, enzymes, channels and mechanisms share one union; seven normalization issue classes are recorded. | Manual aliases/fallbacks bridge mismatches. | Stable ID mapping can merge unlike concepts. | Critical | Wave 1 identity decision | Yes |
| TD-009 | MIGRATION_BLOCKER | regional V1 `z` vs V2 region/density | V1 has narrative/intensity/harm payload; V2 has membership/density, with no semantic equivalence. | Right-panel graph shows both concepts. | Migration can mislabel density as effect. | Critical | Wave 1 semantics; Wave 6 projection | Yes |
| TD-010 | MISSING_TEST | current import-graph catalog gaps | Catalog marks modules without direct import-graph test reach; E2E may cover some indirectly. | Some contracts are observable only end-to-end. | Refactors can lack localized failure signals. | Medium | Risk-selected future waves | No |
| TD-011 | MISSING_TEST | `src/components/Panels/RightPanel.tsx`, `BottomBar.tsx`, overlays | Existing interface complexity prevents complete isolated coverage without production refactor; covered by child/component/E2E paths. | Some orchestration remains coarsely characterized. | Failure diagnosis may be slower. | Medium | Add projection seams in migration wave | No |
| TD-012 | SCIENTIFIC_UNCERTAINTY | V2 parent bindings | 261/349 use the literal `needs verification`; the string conflates evidence states. | Scientific confidence cannot be queried reliably. | Unresolved values may be presented as facts. | Critical | Wave 1 `KnowledgeState` | Yes |
| TD-013 | SCIENTIFIC_UNCERTAINTY | intrinsic efficacy | 12 bindings have values; absence and full agonism require distinct semantics. | Current calculations use type-dependent fallback. | Missing values can be mistaken for zero/full. | High | Wave 1 quantity/state model | Yes |
| TD-014 | SCIENTIFIC_UNCERTAINTY | active metabolites | Three records have formation fractions/half-lives; schema has no record-level provenance. | Metabolites contribute to current V2 balance. | Unsourced assumptions can materially change results. | High | Evidence review before Wave 4 | No |
| TD-015 | MISSING_PROVENANCE | V2 bindings | 81/349 parent bindings lack `source`; only seven have non-sentinel citation text and schema encodes zero explicit verified states. | Provenance completeness is low. | Canonical output may overstate evidence. | Critical | Wave 1 `EvidenceRef`; curate later | Yes |
| TD-016 | MISSING_PROVENANCE | warnings/CYP/regional/PK | Current schemas do not attach structured evidence/version to policies or regional claims. | Clinical-looking behavior cannot cite its basis. | Policy/science changes are not auditable. | Critical | Wave 1 evidence/warning types | Yes |
| TD-017 | HEURISTIC_MODEL | `src/lib/pharmacology.ts` | Dose/default occupancy, CYP multipliers, additive behavior and caps are current heuristic policy. | Generates clinical-looking values. | May be mistaken for mechanism/validated prediction. | Critical | Separate/version in Waves 2–4 | No |
| TD-018 | HEURISTIC_MODEL | `src/lib/indicators/occupancy.ts` | Brain concentration is approximated from numeric `dose_mg`. | Drives occupancy without PK evidence. | Unit and exposure errors propagate. | Critical | Explicit method/version before Wave 4 | No |
| TD-019 | HEURISTIC_MODEL | `src/lib/indicators/conditional.ts`, `regionalBalance.ts` | Conditional rules, target aliases and density fallback are embedded policy. | Rules alter indicator/regional results. | Refactor may change ordering/fallback. | High | Waves 2–4 policy modules | No |
| TD-020 | MISSING_DATA | parent PK | All 580 numeric fields across 116 records are generated zero placeholders. | PK fields cannot represent curated values. | Zero can be interpreted as biological truth. | Critical | Model unknown state in Wave 1; curate later | Yes |
| TD-021 | MISSING_DATA | indications | 111/116 indication arrays are empty. | No safe indication-specific dose semantics. | Defaults/maxima may be applied out of context. | High | Model unknown in Wave 1; curate later | Yes |
| TD-022 | MISSING_DATA | PET occupancy | There are zero PET occupancy entries. | No PET dataset-backed result exists. | Future feature may imply unavailable evidence. | Medium | Future research | No |
| TD-023 | PERSISTENCE_RISK | localStorage scheme/presets and JSONB drug maps | Values are `Record<drugId, number>` with no version/unit tag; database JSONB has no shape constraint. | Legacy state depends on stable IDs and implicit units. | Canonical migration can strand saved data. | Critical | Wave 6 codec/versioning | Yes: quantity/ID contract |
| TD-024 | PERSISTENCE_RISK | `user_treatment_history.dose_mg` | Four non-mg records (`таб`, `мг/кг`, `комп`, `МЕ`) serialize numerically through `dose_mg`; no unit column. | Stored quantity is ambiguous. | Data cannot be losslessly normalized. | Critical | Wave 1 quantity decision; Wave 6 storage | Yes |
| TD-025 | AI_BEHAVIOR_RISK | `src/app/api/chat/route.ts` | V1 labels/aliases/Ki/sigma/doses/units and versionless scheme are serialized into the prompt. | AI context is coupled to legacy shape. | UI parity could hide AI behavior drift. | Critical | Freeze serializer; migrate in Wave 6 | Yes: AI DTO boundary |
| TD-026 | SECURITY_PRIVACY_RISK | chat/profile API graph | Profile, genetics/labs/symptoms and scheme context cross server/external-service boundaries. | Sensitive health context is processed. | Expanded canonical context can over-share data. | Critical | Privacy review before AI expansion | No |
| TD-027 | SECURITY_PRIVACY_RISK | admin server action reachability | Static graph reports client → server action → session/Supabase reach. Direct action use is a framework pattern, but serialization/auth remain sensitive. | Boundary depends on correct server guards. | Refactor can leak server-only behavior. | High | Security review in admin changes | No |
| TD-028 | PERFORMANCE_BUNDLE_RISK | 25 client reachability rows | Many client modules reach full V1/V2 stores or Supabase; `page.tsx` also reaches Three.js. | Accepted initial graph is ~498 KB gzip. | Canonical duplication can regress bundle. | High | Measure each Wave 3–6 slice | Yes: loading-boundary decision |
| TD-029 | PERFORMANCE_BUNDLE_RISK | `BrainCanvas.tsx`, Brain3D barrel | Three.js/GLTF/controls are in the current client graph. | Large optional renderer participates in app loading. | Viewer/simulation growth raises cost. | Medium | Future measured loading boundary | No |
| TD-030 | ACCESSIBILITY_DEBT | high-interaction panels/forms/3D | Phase 0 E2E covers critical axe flows, but custom 3D/popup/slider semantics need continued review. | Some non-standard controls rely on existing behavior. | Refactors can regress keyboard/screen-reader use. | Medium | Each UI migration wave | No |
| TD-031 | FUTURE_FEATURE | evidence/knowledge graph | No typed knowledge/evidence graph or curated status workflow exists. | Evidence is optional text. | Advanced retrieval/traceability lacks foundation. | Medium | After Wave 1 model decision | No |
| TD-032 | FUTURE_FEATURE | Patient/Intervention/Simulation concepts | PatientContext, InterventionSpec and SimulationSpec are not implemented. | Current system is not organized around these abstractions. | Premature design could derail bounded migration. | Low | Separate future phase | No |
| TD-033 | FUTURE_RESEARCH | PET/PBPK/TVB | No accepted dataset/model is present. | No validated simulation/occupancy claim can be made. | Research features may outrun provenance. | Medium | Separate evidence program | No |
| TD-034 | FUTURE_RESEARCH | dose/warning/CYP decisions | HR and CYP policies require population, indication and evidence review. | Current legacy behavior remains frozen. | Product decisions may be mistaken for universal science. | Critical | Human scientific/product review | No; blocks affected migration |

## Counts by category

| Category | Count |
|---|---:|
| BUG_OR_POTENTIAL_BUG | 2 |
| ARCHITECTURAL_DEBT | 3 |
| MIGRATION_BLOCKER | 4 |
| MISSING_TEST | 2 |
| SCIENTIFIC_UNCERTAINTY | 3 |
| MISSING_PROVENANCE | 2 |
| HEURISTIC_MODEL | 3 |
| MISSING_DATA | 3 |
| PERSISTENCE_RISK | 2 |
| AI_BEHAVIOR_RISK | 1 |
| SECURITY_PRIVACY_RISK | 2 |
| PERFORMANCE_BUNDLE_RISK | 2 |
| ACCESSIBILITY_DEBT | 1 |
| FUTURE_FEATURE | 2 |
| FUTURE_RESEARCH | 2 |

Highest-risk findings are TD-001, TD-006 through TD-009, TD-012, TD-015 through TD-018, TD-020, TD-023 through TD-025 and TD-028. Wave 0 deliberately does not fix them.
