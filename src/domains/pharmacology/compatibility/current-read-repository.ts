import { DRUGS, type Drug } from '../../../data/drugs';
import {
  CANONICAL_PHARMACOLOGY_MODEL_VERSION,
  type CanonicalDrug,
  type CurationStatus,
  type DrugId,
  type EvidenceBacked,
  type MolecularTargetId,
  type MolecularTargetKind,
  type PharmacologicalMode,
  type Quantity,
  type TargetInteraction,
} from '../model';
import type {
  CanonicalDrugReadRepository,
  CanonicalDrugReadResult,
} from '../repository';
import { canonicalDrugSchema } from '../validation/drug';
import { drugIdSchema } from '../validation/primitives';

const CURRENT_COMPATIBILITY_CURATION: CurationStatus = 'UNREVIEWED';
const LEGACY_VALUE_DERIVATION = 'LITERATURE_CURATED' as const;

const TARGET_KINDS = {
  '5HT1A': 'RECEPTOR',
  '5HT1B': 'RECEPTOR',
  '5HT2C': 'RECEPTOR',
  '5HT3': 'RECEPTOR',
  '5HT7': 'RECEPTOR',
  AChE: 'ENZYME',
  D2: 'RECEPTOR',
  D3: 'RECEPTOR',
  DAT: 'TRANSPORTER',
  H1: 'RECEPTOR',
  NET: 'TRANSPORTER',
  NMDA: 'RECEPTOR',
  SERT: 'TRANSPORTER',
  a2A: 'RECEPTOR',
  alpha1: 'RECEPTOR',
  s1: 'RECEPTOR',
} as const satisfies Readonly<Record<string, MolecularTargetKind>>;

const SIGMA1_MODES = {
  ag: 'AGONIST',
  inv: 'INVERSE_AGONIST',
  ant: 'ANTAGONIST',
} as const satisfies Readonly<Record<NonNullable<Drug['s1t']>, PharmacologicalMode>>;

export type CurrentCompatibilityDataErrorCode =
  | 'INVALID_LEGACY_RECORD'
  | 'UNRESOLVED_COMPATIBILITY';

/** Private-adapter failure; it is deliberately absent from the public read port. */
export class CurrentCompatibilityDataError extends Error {
  readonly code: CurrentCompatibilityDataErrorCode;
  readonly legacyId: string;

  constructor(code: CurrentCompatibilityDataErrorCode, legacyId: string, message: string) {
    super(message);
    this.name = 'CurrentCompatibilityDataError';
    this.code = code;
    this.legacyId = legacyId;
  }
}

function evidenceBacked<T>(knowledge: EvidenceBacked<T>['knowledge']): EvidenceBacked<T> {
  return {
    knowledge,
    curationStatus: CURRENT_COMPATIBILITY_CURATION,
    evidenceLinks: [],
  };
}

function projectAffinity(value: number): EvidenceBacked<Quantity<'nM'>> {
  if (value === 0) {
    return evidenceBacked({
      state: 'NOT_CURATED',
      reason: 'legacy zero-Ki semantics remain unresolved',
    });
  }

  return evidenceBacked({
    state: 'KNOWN',
    value: { value, unit: 'nM' },
    derivation: LEGACY_VALUE_DERIVATION,
  });
}

function projectMode(record: Drug, targetId: string): EvidenceBacked<PharmacologicalMode> {
  if (targetId === 's1' && record.s1t) {
    return evidenceBacked({
      state: 'KNOWN',
      value: SIGMA1_MODES[record.s1t],
      derivation: LEGACY_VALUE_DERIVATION,
    });
  }

  return evidenceBacked({
    state: 'NOT_CURATED',
    reason: 'current V1 data does not encode a reviewed pharmacological mode',
  });
}

function projectInteraction(record: Drug, targetId: string, kiNm: number): TargetInteraction {
  const kind = TARGET_KINDS[targetId as keyof typeof TARGET_KINDS];
  if (!kind) {
    throw new CurrentCompatibilityDataError(
      'UNRESOLVED_COMPATIBILITY',
      record.id,
      `No approved target kind exists for legacy target ${targetId}`,
    );
  }
  if (!Number.isFinite(kiNm) || kiNm < 0) {
    throw new CurrentCompatibilityDataError(
      'INVALID_LEGACY_RECORD',
      record.id,
      `Legacy Ki for ${targetId} must be finite and non-negative`,
    );
  }

  return {
    interactionType: 'AFFINITY',
    target: {
      targetType: 'MOLECULAR_TARGET',
      id: targetId as MolecularTargetId,
      kind,
      preferredLabel: targetId,
    },
    affinity: projectAffinity(kiNm),
    pharmacologicalMode: projectMode(record, targetId),
    intrinsicEfficacy: evidenceBacked({
      state: 'NOT_CURATED',
      reason: 'current V1 data does not encode intrinsic efficacy',
    }),
  };
}

function projectDrug(legacyKey: string, record: Drug): CanonicalDrug {
  if (legacyKey !== record.id) {
    throw new CurrentCompatibilityDataError(
      'INVALID_LEGACY_RECORD',
      record.id,
      `Legacy key ${legacyKey} does not match record ID ${record.id}`,
    );
  }

  const projected = {
    modelVersion: CANONICAL_PHARMACOLOGY_MODEL_VERSION,
    id: record.id as DrugId,
    canonicalName: record.n,
    aliases: [record.brand, record.s],
    targetInteractions: Object.entries(record.ki).map(([targetId, kiNm]) =>
      projectInteraction(record, targetId, kiNm)),
    // Current CYP numbers are dose/exposure policy, not curated CYP relationships.
    metabolismRelationships: [],
  };

  const parsed = canonicalDrugSchema.safeParse(projected);
  if (!parsed.success) {
    throw new CurrentCompatibilityDataError(
      'INVALID_LEGACY_RECORD',
      record.id,
      `Canonical validation failed for ${record.id}: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Builds an isolated V1 compatibility projection. This is not a canonical dataset,
 * does not read V2, and is intentionally not re-exported by the public repository.
 */
export function createCurrentCompatibilityDrugReadRepository(): CanonicalDrugReadRepository {
  const records = deepFreeze(
    Object.entries(DRUGS).map(([legacyKey, record]) => deepFreeze(projectDrug(legacyKey, record))),
  );
  const byId = new Map(records.map((record) => [record.id, record] as const));

  return Object.freeze({
    listDrugs: () => records,
    findDrugById(input: string): CanonicalDrugReadResult {
      const parsedId = drugIdSchema.safeParse(input);
      if (!parsedId.success) return { status: 'INVALID_ID', input };

      const drug = byId.get(parsedId.data);
      return drug
        ? { status: 'FOUND', drug }
        : { status: 'NOT_FOUND', id: parsedId.data };
    },
  });
}
