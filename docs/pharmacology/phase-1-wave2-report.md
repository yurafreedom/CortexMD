# PHARM-P1-W2 implementation report

> **STRUCTURAL MIGRATION ARTIFACT — NOT SCIENTIFIC OR CLINICAL VALIDATION**

## Start state and accepted-history synchronization

- Repository: `/Users/yurasachenko/CortexMD`
- Branch: `main`
- Accepted local HEAD: `657e5692c1e80e428dbf3bcf4b8e745ac0db226f`
- Accepted tag: `phase-1-wave1-accepted`, resolving to the same commit
- Initial working tree: clean
- Remote: GitHub repository `yurafreedom/CortexMD` (the configured URL redirects to this canonical casing)
- Remote `main` before synchronization: `8b3538b06732d15c3dea207868fe4e1fe42c1a65`
- Relationship: remote `main` was an ancestor of local HEAD; local was three commits ahead and zero behind
- Synchronization: pure fast-forward push of existing `main`, followed by explicit pushes of the audited annotated tags `phase-0-accepted`, `phase-1c-wave0-accepted`, and `phase-1-wave1-accepted`
- Remote `main` after synchronization: `657e5692c1e80e428dbf3bcf4b8e745ac0db226f`
- Force push, history rewrite, synthetic commit: none

Wave 2 began only after confirming that local HEAD was unchanged and the working
tree was still clean. The Wave 2 working tree is intentionally uncommitted,
unstaged, and unpushed.

## Scope

Wave 2 creates a controlled canonical read boundary with:

1. a narrow public read-only port;
2. a private compatibility-backed implementation;
3. independent parity and import-boundary tests;
4. synchronized architecture documentation and generated catalog.

It does not migrate a production consumer, alter a calculation, establish a
canonical current dataset, activate a V2-only fact, interpret PK placeholders,
resolve a human-review decision, or change UI/API/AI/persistence/3D behavior.

## Architecture

```text
V1 DRUGS (unchanged compatibility source)
  -> private current-read compatibility adapter
  -> Wave 1 canonical validation and immutable values
  -> Wave 2 public read-only port

production UI / calculations / API / AI / persistence
  -> unchanged legacy paths (zero Wave 2 consumers)
```

The dependency audit identifies one new direct/transitive V1 module: the private
adapter itself. No outside production module consumes either repository module,
and no current client module can reach the canonical domain.

## Public read API

`CanonicalDrugReadRepository` exposes only:

- `listDrugs(): readonly CanonicalDrug[]`
- `findDrugById(input: string): CanonicalDrugReadResult`

The lookup result is an explicit `FOUND`, `NOT_FOUND`, or `INVALID_ID` union.
Identity is exact and case-sensitive. Blank/surrounding-whitespace input is
invalid; an unknown well-formed ID is not found. There is no alias, display-name,
fuzzy, trimming, or case-folding resolution and no write/persistence operation.

## Private compatibility implementation

`createCurrentCompatibilityDrugReadRepository()` is deliberately outside the
public repository barrel. On invocation it projects the current V1 `DRUGS`
source, validates every record with the Wave 1 `canonicalDrugSchema`, indexes by
opaque ID, and deeply freezes records and collections.

Internal construction fails closed with `INVALID_LEGACY_RECORD` for malformed
records or `UNRESOLVED_COMPATIBILITY` for a target without an approved structural
kind. Those adapter errors and raw V1 types are not part of the public port.

## Source and precedence behavior

- The bounded projection uses V1 only because V1 is the current compatibility
  oracle for the fields in this read surface.
- V1 key, record ID, current `n`, `brand`, `s`, Ki insertion order, target spelling,
  and all 90 Ki values are preserved exactly.
- Positive Ki values become `KNOWN` `nM` quantities with
  `LITERATURE_CURATED` derivation, `UNREVIEWED` curation, and no evidence links.
  This represents existing provenance and does not mean verified.
- V1 sigma type is mapped only for the matching `s1` row. Other modes and all
  intrinsic efficacy remain explicitly `NOT_CURATED`.
- V1 CYP dose/exposure fields are quarantined and do not become scientific
  metabolism relationships.
- V2 is not imported. Its 259 binding-count delta, 11 zero-Ki rows, generated PK,
  CYP fields, regional fields, and metabolites do not enter this repository.
- No production source precedence changes because there are no production
  repository consumers.

## Parity and completeness evidence

| Measure | Result |
|---|---:|
| Canonical records addressable | 116 |
| Current-compatible V1 records represented | 116 |
| V1 target interactions represented | 90 |
| V2 bindings read by adapter | 0 |
| V2-only facts activated | 0 |
| New zero-Ki scientific decisions | 0 |
| PK placeholders interpreted | 0 |
| HR-001…HR-023 resolved | 0 |
| New `VERIFIED` evidence invented | 0 |
| Production consumers switched | 0 |
| Invalid accepted V1 records | 0 |
| Unresolved accepted V1 mappings | 0 |

Tests compare repository output independently with V1 records, the Phase 0 ID
fixture, the Wave 0 zero-Ki fixture, and live V2 counts. They cover record/source
order, names and aliases, exact target spelling/kinds/order, Ki values and units,
knowledge/curation/evidence state, sigma mode, CYP/metabolism quarantine, explicit
lookup outcomes, absence of raw fields, and deep immutability.

## Import-boundary evidence

- Canonical model -> legacy store dependency: none.
- Public repository -> legacy store dependency: none.
- Private adapter -> V1 dependency: one direct dependency.
- Private adapter -> V2 dependency: none.
- Raw V1/V2 shapes in public repository: none.
- React, Next.js, Three.js, Supabase, Anthropic, network, or persistence dependency
  in model/validation/public read port: none.
- Outside production consumers of the repository: zero.
- UI/API/AI/persistence consumers switched: zero.
- Runtime cycles and unresolved internal imports: zero.

## Architecture catalog

The regenerated catalog is based on accepted Wave 1 HEAD
`657e5692c1e80e428dbf3bcf4b8e745ac0db226f`. The historical production
characterization baseline remains
`6d98af672fe9c7dc4a8709734fec9b8d9a10cd9b` and remains an ancestor of HEAD.

Measured Wave 2 graph: 144 source files, 141 production modules, 281 internal
edges, direct V1/V2/dual counts 14/6/2, transitive counts 19/11/7, 44 modules in
the pharmacology/scientific cone, 4 barrels, 0 cycles, and 0 unresolved imports.

## Verification

All available required gates passed:

- Focused Wave 1/Wave 2 plus relevant Phase 0 characterization: 13 files,
  242 tests passed.
- Full `npm run check`: typecheck passed; 15 files and 261 tests passed;
  402-key `en`/`ru`/`uk` locale parity passed; GLB baseline passed.
- Coverage: 261 tests passed; aggregate 80.52% statements, 63.63% branches,
  73.76% functions, and 84.26% lines.
- Architecture audit and catalog exact comparison: passed; 0 runtime cycles,
  0 unresolved internal imports, and 0 outside production repository consumers.
- Pharmacology completeness audit: passed with 116/116 ID parity, 349 V2
  bindings still characterized, 11 zero-Ki rows, 580 PK placeholders, and 23
  unresolved behavior-critical conflicts.
- Formula sanity: 27/27 checks passed.
- Production build: passed repeatedly through the reproducible bundle and E2E
  workflows.
- E2E: 6/6 Chromium critical-flow and scoped accessibility tests passed.
- Bundle reproducibility: two clean builds were identical and exactly matched
  the accepted `498,316 B` normalized initial-route gzip baseline; delta 0 B.
  An initial 7 B documentation-triggered Tailwind utility was identified and
  removed by using non-utility prose, without changing CSS, source behavior, or
  budget thresholds.
- `public/brain.glb`: unchanged, SHA-256
  `8f0babae064319fd8d9520148ca5d31ce70938b2edd4db2dced960e4caffe8cf`.
- `git diff --check`: passed.
- Lint: the repository defines no lint script; no lint gate is available.

## Risks and open questions

- The projection says what current V1 contains; it does not establish scientific
  truth, clinical validity, or independent source verification.
- Target kind assignments cover the 16 V1 target spellings only. Alias and
  namespace decisions, including V1 `a2A` versus V2 `alpha2A`, remain closed.
- V1 canonical names and aliases are current compatibility labels and may require
  later reviewed localization/identity policy.
- The 11 V2 zero-Ki rows, 259 binding-count delta, 580 PK placeholders, evidence
  gaps, regional/metabolite semantics, and HR-001…HR-023 remain unresolved.
- CYP policy remains available only through unchanged legacy production paths;
  the canonical projection intentionally provides no CYP relationship data.
- Wave 3 must be separately authorized and limited to one behavior-frozen narrow
  consumer after human acceptance of this Wave 2 boundary.

## Rollback

Before acceptance, rollback requires removing the additive repository/adapter
and Wave 2 test/report changes and restoring the architecture documentation and
catalog. Legacy production runtime is independently functional because none of
its imports were changed.

## Explicit exclusions

No Wave 3 consumer migration, V2 importer, canonical dataset, scientific-value
correction, calculation/UI/API/AI/persistence change, HR resolution, BrainCanvas
or `brain.glb` change, 3D optimization, NV-0, TVB, simulation, or Intelligence
Radar work is included.

## Next-wave prerequisites

Human review and acceptance/freeze of Wave 2 are required first. Any later Wave 3
prompt must identify one narrow production consumer, its independent parity
oracle, rollback, bundle limit, and explicit handling of still-unresolved science
and identity policy.
