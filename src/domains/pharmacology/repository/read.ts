import type { CanonicalDrug } from '../model/drug';
import type { DrugId } from '../model/ids';

export type CanonicalDrugReadResult =
  | { readonly status: 'FOUND'; readonly drug: CanonicalDrug }
  | { readonly status: 'NOT_FOUND'; readonly id: DrugId }
  | { readonly status: 'INVALID_ID'; readonly input: string };

/** Read-only access to immutable canonical projections. Identity matching is exact. */
export interface CanonicalDrugReadRepository {
  listDrugs(): readonly CanonicalDrug[];
  findDrugById(input: string): CanonicalDrugReadResult;
}
