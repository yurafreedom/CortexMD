# Pharmacology domain — Waves 1–2

> **FOUNDATIONAL STRUCTURAL MODEL AND UNREAD COMPATIBILITY PROJECTION ONLY**
>
> This is **not** scientific validation, clinical validation, a V2 migration, a
> canonical current dataset, production activation, or an `InterventionSpec`.

Wave 1 defines the language and runtime validators needed to represent reviewed
pharmacological knowledge safely. Wave 2 adds a narrow read-only port and one
private V1-backed compatibility projection. No production consumer imports the
repository, and existing V1/V2 behavior and precedence remain unchanged.

Repository availability is not canonical scientific approval and is not
production activation. Schema-valid is not scientifically reviewed and is not
production-active.

## Epistemic model

Knowledge availability and derivation are independent axes. Availability says
whether a value is `KNOWN`, `UNKNOWN`, `NOT_CURATED`, `NOT_APPLICABLE`, or
`CONFLICTING`. A known or conflicting candidate separately records whether it
was measured, literature-curated, population-derived, estimated, model-derived,
or heuristic. `UNKNOWN` is neither `ESTIMATED` nor numeric zero.

`CurationStatus` is separate from truth. `HUMAN_REVIEWED` records a workflow
event; it does not mean scientifically proven, clinically validated, or
universally true. The Wave 2 projection uses `UNREVIEWED`; availability does not
promote a claim to verified status.

`EvidenceRef` identifies a source. `EvidenceLink` describes whether that source
supports, underlies, or contradicts one claim and may locate the claim within the
source. `EvidenceRef` is not `EvidenceLink`. The compatibility projection creates
no structured evidence links from legacy text.

## Targets and interactions

Opaque molecular-target IDs and biological-process IDs are different types.
Molecular targets have an explicit receptor, transporter, enzyme, or ion-channel
kind. Biological processes cannot masquerade as molecular affinity targets.

`TargetInteraction` distinguishes an `AffinityInteraction` from a
`FunctionalInteraction`. A known affinity is a finite `nM` quantity greater than
zero. Zero is not unknown, and a known Ki of zero is invalid. Legacy zero-Ki
meaning remains unresolved. The 11 V2 zero-Ki rows are not imported, classified,
or activated by Wave 2.

A partial agonist may have `UNKNOWN` or `NOT_CURATED` intrinsic efficacy. The
model does not default missing efficacy to 0, 0.5, 1, or any other value, and it
does not impose a universal assay-independent `[0,1]` range.

## Metabolism and drug scope

A CYP relationship records only an evidence-backed scientific substrate,
inhibitor, or inducer claim with an enzyme and optional evidence-backed
qualitative strength. It contains no dose multiplier, exposure correction,
threshold, cap, or product policy. Wave 2 does not convert V1 CYP numeric policy
or V2 CYP fields into scientific metabolism relationships.

`CanonicalDrug` remains deliberately small: model version, opaque ID, canonical
name, aliases, target interactions, and metabolism relationships. It contains no
legacy compatibility, dose/warning/UI policy, patient or persistence state, PK
profile, regional model, active-metabolite migration, or AI context.

## Wave 2 read boundary

The public `repository/` surface contains only the immutable read interface and
explicit lookup result. `listDrugs()` returns stable source-order canonical
values. `findDrugById()` accepts exact, case-sensitive IDs and returns `FOUND`,
`NOT_FOUND`, or `INVALID_ID`. It performs no fuzzy matching, display-name lookup,
alias resolution, trimming, or implicit lowercasing.

The private `compatibility/` implementation reads V1 `DRUGS` lazily when its
factory is called, validates each projection with the Wave 1 schema, and deeply
freezes its output. V1 remains the compatibility source for this bounded
projection only; this does not change any production source precedence. Raw V1
shapes and private mapping errors do not cross the public port.

The projection represents all 116 V1 identities and their 90 positive Ki rows
in exact V1 order. Values are available as `KNOWN` with
`LITERATURE_CURATED` derivation but remain `UNREVIEWED` and have no invented
`EvidenceLink`. This describes legacy provenance, not independent verification.

## Migration boundary

There is no V2 importer and no canonical current dataset. The current 116 V2
drugs and 349 bindings remain legacy characterization evidence. The 259 V2-only
binding-count delta remains unreviewed, inactive in this repository, and not
canonicalized. All 580 generated V2 PK zero placeholders remain uninterpreted.

Human-review decisions HR-001 through HR-023 remain unresolved. No production
UI, calculation, API, AI, persistence, scheme, warning, regional, or 3D consumer
uses Wave 2. A separately authorized Wave 3 may migrate a narrow consumer only
after human acceptance; it must preserve the frozen behavior and unresolved
states rather than treating repository presence as approval.
