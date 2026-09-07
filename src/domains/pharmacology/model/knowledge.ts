export const KNOWLEDGE_STATES = [
  'KNOWN',
  'UNKNOWN',
  'NOT_CURATED',
  'NOT_APPLICABLE',
  'CONFLICTING',
] as const;

export type KnowledgeState = (typeof KNOWLEDGE_STATES)[number];

export const DERIVATION_KINDS = [
  'MEASURED',
  'LITERATURE_CURATED',
  'POPULATION_DERIVED',
  'ESTIMATED',
  'MODEL_DERIVED',
  'HEURISTIC',
] as const;

export type DerivationKind = (typeof DERIVATION_KINDS)[number];

export const CURATION_STATUSES = [
  'UNREVIEWED',
  'NEEDS_REVIEW',
  'HUMAN_REVIEWED',
  'REJECTED',
] as const;

export type CurationStatus = (typeof CURATION_STATUSES)[number];

export interface ConflictCandidate<T> {
  readonly value: T;
  readonly derivation: DerivationKind;
}

export type Knowledge<T> =
  | {
      readonly state: 'KNOWN';
      readonly value: T;
      readonly derivation: DerivationKind;
    }
  | {
      readonly state: 'UNKNOWN';
      readonly reason?: string;
    }
  | {
      readonly state: 'NOT_CURATED';
      readonly reason?: string;
    }
  | {
      readonly state: 'NOT_APPLICABLE';
      readonly rationale: string;
    }
  | {
      readonly state: 'CONFLICTING';
      readonly candidates: readonly ConflictCandidate<T>[];
      readonly reason?: string;
    };
