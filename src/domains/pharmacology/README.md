# Pharmacology domain — Wave 1

> **STRUCTURAL MODEL ONLY**
>
> This is **not** scientific validation, clinical validation, a V2 migration, a
> production dataset, a repository, or an `InterventionSpec`.

Wave 1 defines the language and runtime validators needed to represent reviewed
pharmacological knowledge safely in a later migration. Nothing in this directory
reads `DRUGS`, `DRUGS_V2`, or any current production store. No production
consumer imports this directory.

## Epistemic model

Knowledge availability and derivation are independent axes. Availability says
whether a value is `KNOWN`, `UNKNOWN`, `NOT_CURATED`, `NOT_APPLICABLE`, or
`CONFLICTING`. A known or conflicting candidate separately records whether it
was measured, literature-curated, population-derived, estimated, model-derived,
or heuristic. `UNKNOWN` is neither `ESTIMATED` nor numeric zero.

`CurationStatus` is also separate. `HUMAN_REVIEWED` records a workflow event; it
does not mean scientifically proven, clinically validated, or universally true.
Schema-valid data is not thereby scientifically reviewed or production-active.

`EvidenceRef` identifies a source. `EvidenceLink` describes whether that source
supports, underlies, or contradicts a particular claim and may locate the claim
within the source. A known value may currently have no evidence link; this is
represented explicitly rather than promoted to a truth status.

## Targets and interactions

Opaque molecular-target IDs and biological-process IDs are different types.
Molecular targets have an explicit receptor, transporter, enzyme, or ion-channel
kind. Biological processes cannot masquerade as molecular affinity targets.

`TargetInteraction` distinguishes an `AffinityInteraction` from a
`FunctionalInteraction`. A known affinity is a finite `nM` quantity greater than
zero. Zero is not unknown, and a known Ki of zero is invalid. The 11 current
legacy zero-Ki rows remain unresolved; Wave 1 does not classify them as unknown,
not curated, not applicable, a functional mechanism, a sentinel, or a data
defect.

A partial agonist may have `UNKNOWN` or `NOT_CURATED` intrinsic efficacy. Wave 1
does not default missing efficacy to 0, 0.5, 1, or any other value, and it does
not impose a universal assay-independent `[0,1]` range.

## Metabolism and drug scope

A CYP relationship records only an evidence-backed scientific substrate,
inhibitor, or inducer claim with an enzyme and optional evidence-backed
qualitative strength. It contains no dose multiplier, exposure correction,
threshold, cap, or product policy.

`CanonicalDrug` is deliberately small: model version, opaque ID, canonical name,
aliases, target interactions, and metabolism relationships. It contains no
legacy compatibility, dose/warning/UI policy, patient or persistence state, PK
profile, regional model, active-metabolite migration, AI context, or repository
behavior.

## Migration boundary

Wave 1 does not include a V2 importer or canonical current dataset. The current
116 V2 drugs and 349 bindings are still legacy characterization evidence, not
canonical records. The 259 V2-only binding rows remain unreviewed, production-
inactive, and uncanonicalized. Current PK zero placeholders, regional concepts,
and active-metabolite records are not migrated or interpreted here.

Human-review decisions HR-001 through HR-023 remain unresolved. A future,
separately authorized adapter/repository migration must preserve those unknowns
and distinguish all current regional and compatibility representations.
