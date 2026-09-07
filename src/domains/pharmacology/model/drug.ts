import type { DrugId } from './ids';
import type { TargetInteraction } from './interaction';
import type { CypRelationship } from './metabolism';

export const CANONICAL_PHARMACOLOGY_MODEL_VERSION = 'pharmacology-canonical-v1' as const;

/** Minimal identity and canonical relationships; not a product or patient record. */
export interface CanonicalDrug {
  readonly modelVersion: typeof CANONICAL_PHARMACOLOGY_MODEL_VERSION;
  readonly id: DrugId;
  readonly canonicalName: string;
  readonly aliases: readonly string[];
  readonly targetInteractions: readonly TargetInteraction[];
  readonly metabolismRelationships: readonly CypRelationship[];
}
