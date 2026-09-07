declare const drugIdBrand: unique symbol;
declare const molecularTargetIdBrand: unique symbol;
declare const biologicalProcessIdBrand: unique symbol;
declare const evidenceIdBrand: unique symbol;

/** Opaque identifiers. Their strings carry no inferred legacy or scientific meaning. */
export type DrugId = string & { readonly [drugIdBrand]: 'DrugId' };
export type MolecularTargetId = string & { readonly [molecularTargetIdBrand]: 'MolecularTargetId' };
export type BiologicalProcessId = string & { readonly [biologicalProcessIdBrand]: 'BiologicalProcessId' };
export type EvidenceId = string & { readonly [evidenceIdBrand]: 'EvidenceId' };
