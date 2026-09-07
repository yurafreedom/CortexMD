import type { EvidenceBacked } from './evidence';
import type { Quantity } from './quantity';
import type { MolecularTargetRef, PharmacologyTargetRef } from './target';

export const PHARMACOLOGICAL_MODES = [
  'AGONIST',
  'PARTIAL_AGONIST',
  'ANTAGONIST',
  'INVERSE_AGONIST',
  'INHIBITOR',
  'MODULATOR',
  'BINDER',
  'OTHER',
] as const;

export type PharmacologicalMode = (typeof PHARMACOLOGICAL_MODES)[number];

export const FUNCTIONAL_DIRECTIONS = ['INCREASES', 'DECREASES', 'MODULATES'] as const;
export type FunctionalDirection = (typeof FUNCTIONAL_DIRECTIONS)[number];

export interface AffinityInteraction {
  readonly interactionType: 'AFFINITY';
  readonly target: MolecularTargetRef;
  readonly affinity: EvidenceBacked<Quantity<'nM'>>;
  readonly pharmacologicalMode: EvidenceBacked<PharmacologicalMode>;
  readonly intrinsicEfficacy: EvidenceBacked<Quantity<'ratio'>>;
}

export interface FunctionalInteraction {
  readonly interactionType: 'FUNCTIONAL';
  readonly target: PharmacologyTargetRef;
  readonly direction: EvidenceBacked<FunctionalDirection>;
}

export type TargetInteraction = AffinityInteraction | FunctionalInteraction;
