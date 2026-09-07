import type { EvidenceId } from './ids';
import type { CurationStatus, Knowledge } from './knowledge';

export const EVIDENCE_SOURCE_TYPES = [
  'PEER_REVIEWED_ARTICLE',
  'PREPRINT',
  'REGULATORY_DOCUMENT',
  'GUIDELINE',
  'DATASET',
  'BOOK_OR_REFERENCE',
  'OTHER',
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export interface EvidenceExternalIdentifier {
  readonly namespace: string;
  readonly value: string;
}

export type EvidenceMetadataValue = string | number | boolean | null;

/** Stable identity and bibliographic metadata for a source, never a truth claim. */
export interface EvidenceRef {
  readonly id: EvidenceId;
  readonly sourceType: EvidenceSourceType;
  readonly externalIdentifiers?: readonly EvidenceExternalIdentifier[];
  readonly title?: string;
  readonly url?: string;
  readonly publicationDate?: string;
  readonly publicationYear?: number;
  readonly metadata?: Readonly<Record<string, EvidenceMetadataValue>>;
}

export const EVIDENCE_RELATIONS = ['SUPPORTS', 'DERIVED_FROM', 'CONTRADICTS'] as const;
export type EvidenceRelation = (typeof EVIDENCE_RELATIONS)[number];

export interface EvidenceLocator {
  readonly page?: string;
  readonly table?: string;
  readonly section?: string;
  readonly figure?: string;
  readonly note?: string;
}

/** Describes how a source relates to one particular claim. */
export interface EvidenceLink {
  readonly evidenceId: EvidenceId;
  readonly relation: EvidenceRelation;
  readonly locator?: EvidenceLocator;
}

export interface EvidenceBacked<T> {
  readonly knowledge: Knowledge<T>;
  readonly curationStatus: CurationStatus;
  readonly evidenceLinks: readonly EvidenceLink[];
}
