import type { EvidenceBacked } from './evidence';
import type { MolecularTargetRef } from './target';

export const CYP_RELATIONSHIP_KINDS = ['SUBSTRATE', 'INHIBITOR', 'INDUCER'] as const;
export type CypRelationshipKind = (typeof CYP_RELATIONSHIP_KINDS)[number];

export const CYP_STRENGTHS = ['WEAK', 'MODERATE', 'STRONG'] as const;
export type CypStrength = (typeof CYP_STRENGTHS)[number];

/** A scientific relationship only; it contains no dose or exposure policy. */
export interface CypRelationship {
  readonly enzyme: MolecularTargetRef & { readonly kind: 'ENZYME' };
  readonly relationship: EvidenceBacked<CypRelationshipKind>;
  readonly strength?: EvidenceBacked<CypStrength>;
}
