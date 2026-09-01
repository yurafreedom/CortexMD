# Phase 0 safety net

This safety net freezes CortexMD's behavior at commit `8b3538b06732d15c3dea207868fe4e1fe42c1a65` before any migration or scientific-data work.

> **CURRENT BEHAVIOR CHARACTERIZATION — NOT SCIENTIFIC VALIDATION — NOT CLINICAL VALIDATION**

Passing these checks means that the observed implementation, data shape, build output, and critical UI flows still match the reviewed Phase 0 evidence. It does not establish that a formula, receptor value, dose, warning, indication, source, or clinical conclusion is correct.

## Commands

Use Node 22 and the committed npm lockfile. A deterministic local or CI run begins with:

```sh
npm ci
npm run check
npm run test:coverage
```

The commands are split by responsibility:

```sh
npm run typecheck             # TypeScript
npm test                      # unit, component, API, and schema/data tests
npm run test:coverage         # the same tests plus risk-focused coverage evidence
npm run validate:locales      # exact en/ru/uk key and placeholder parity
npm run budget:brain          # brain.glb hash, size, and geometry gate
npm run budget:bundle         # two clean builds, reproducibility, exact frozen baseline
npm run budget:bundle:current # inspect an already-built .next output; 5 KiB gzip gate
```

Coverage is evidence, not a repository-wide percentage target. Review the uncovered files and branches around high-risk consumers; do not add arbitrary global thresholds.

## Chromium E2E

Install the matching browser once, then build and test the production server:

```sh
npx playwright install chromium
npm run test:e2e
```

Linux CI installs Chromium system prerequisites with `npx playwright install --with-deps chromium`. E2E runs with zero retries. Tests replace the large GLB response with the application's existing procedural fallback and replace preset requests with a local route fixture; they require no production secrets, database, LLM, or live scientific API. `scripts/run-test-build.mjs` overrides every referenced service variable with inert Phase 0 values, including a fixed non-production `ADMIN_SESSION_SECRET`, so local credentials cannot enter safety-net artifacts. The production build does fetch the configured Google Fonts, so its environment needs ordinary outbound access to the font host.

## Fixture and golden-file policy

The pharmacology fixtures under `tests/fixtures/pharmacology/` deliberately record current V1/V2 IDs, data-quality facts, legacy-field divergences, and formula results. Accessibility findings under `tests/fixtures/accessibility/` record current serious/critical axe results. Update any of these only when:

1. the behavior or data change is separately authorized;
2. the failing assertion has been investigated rather than mechanically regenerated;
3. the old and new machine-readable values are reviewed in the diff; and
4. an intentional scientific change receives explicit scientific review.

Never update a golden solely to make CI green. Keep the three characterization disclaimers in every pharmacology golden. A fixture update acknowledges a reviewed change in observed behavior; it never certifies scientific or clinical truth.

## Baseline update policy

For an intentional bundle change, first measure two clean builds without accepting them:

```sh
node scripts/verify-bundle-reproducibility.mjs --no-gate
```

Only if both normalized measurements are identical may a reviewer update `tests/fixtures/bundle/initial-route-baseline.json`. Actual JS/CSS payload differences must never be normalized away. Then rerun `npm run budget:bundle`. The 5 KiB allowance is a regression alarm, while `budget:bundle` enforces the exact reviewed reproducible baseline; the recorded size is not a future performance target.

For an intentional replacement of `public/brain.glb`, first obtain separate authorization, run `node scripts/check-glb-budget.mjs --no-gate`, inspect the asset, and review every changed hash/size/geometry field before updating `tests/fixtures/brain/brain-baseline.json`. Phase 0 itself does not authorize rewriting, compressing, or replacing the asset.

Locale keys or interpolation placeholders must remain exactly aligned across `messages/en.json`, `messages/ru.json`, and `messages/uk.json`. A locale failure is fixed in the locale files only as part of a separately reviewed product change; the validator has no acceptance snapshot to regenerate.

## Flake policy

Retries are disabled. Treat an intermittent failure as a defect in the test, product, or environment: preserve traces/output, reproduce it, identify the nondeterministic input, and fix or explicitly quarantine it with an owner and issue. Do not add sleeps, broaden selectors, loosen numerical assertions, increase the bundle tolerance, or regenerate fixtures merely to obtain green CI.

## Known Phase 0 characterization gaps

- The V1 and V2 legacy compatibility fields have 123 existing divergences. Twenty-three affect dose/warning/default/max-dose behavior. The suite freezes these as current behavior instead of asserting false parity.
- Current V2 quality debt is intentionally preserved: 261 of 349 bindings say `needs verification`, 81 bindings have no source, all 116 main PK records are zero-filled, PET occupancy has no entries, and 111 of 116 indication arrays are empty.
- API tests characterize unauthenticated and validation/error paths with local mocks. They do not exercise a production Supabase session, database, Anthropic request, PubMed, ChEMBL, or OpenFDA.
- Chromium covers representative critical flows, one projected brain-region marker, and scoped axe checks. It is not an exhaustive browser, keyboard, screen-reader, responsive-layout, or WebGL-driver matrix.
- The scoped scheme-modal axe baseline contains two existing serious findings: `color-contrast` and `scrollable-region-focusable`. The scoped left panel has no critical/serious findings in the current Chromium baseline.
- The 3D model remains in the initial route graph and is eagerly requested. The E2E fallback avoids transferring the 43 MB asset but does not validate production GLB rendering.
- Coverage intentionally targets high-risk formulas and consumers; it is not proof of complete application behavior.

CI runs the deterministic checks, two-build bundle gate, and zero-retry Chromium suite on pushes and pull requests. No Phase 0 check requires production credentials or mutable external service responses.
