import type { BiologicalProcessId, MolecularTargetId } from './ids';

export const MOLECULAR_TARGET_KINDS = [
  'RECEPTOR',
  'TRANSPORTER',
  'ENZYME',
  'ION_CHANNEL',
] as const;

export type MolecularTargetKind = (typeof MOLECULAR_TARGET_KINDS)[number];

export interface MolecularTargetRef {
  readonly targetType: 'MOLECULAR_TARGET';
  readonly id: MolecularTargetId;
  readonly kind: MolecularTargetKind;
  readonly preferredLabel?: string;
}

export interface BiologicalProcessRef {
  readonly targetType: 'BIOLOGICAL_PROCESS';
  readonly id: BiologicalProcessId;
  readonly preferredLabel?: string;
}

export type PharmacologyTargetRef = MolecularTargetRef | BiologicalProcessRef;
