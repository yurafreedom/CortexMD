import { z } from 'zod';
import type {
  BiologicalProcessId,
  DrugId,
  EvidenceId,
  MolecularTargetId,
} from '../model/ids';
import { QUANTITY_UNITS, type Quantity, type QuantityUnit } from '../model/quantity';

function opaqueIdSchema<Id>() {
  return z.string()
    .min(1)
    .refine((value) => value.trim().length > 0, 'identifier must not be blank')
    .refine((value) => value === value.trim(), 'identifier must not contain surrounding whitespace')
    .transform((value) => value as Id);
}

export const drugIdSchema = opaqueIdSchema<DrugId>();
export const molecularTargetIdSchema = opaqueIdSchema<MolecularTargetId>();
export const biologicalProcessIdSchema = opaqueIdSchema<BiologicalProcessId>();
export const evidenceIdSchema = opaqueIdSchema<EvidenceId>();

export const quantityUnitSchema = z.enum(QUANTITY_UNITS);

export const quantitySchema = z.object({
  value: z.number().finite(),
  unit: quantityUnitSchema,
}).strict();

export function quantitySchemaFor<Unit extends QuantityUnit>(unit: Unit): z.ZodType<Quantity<Unit>> {
  return z.object({
    value: z.number().finite(),
    unit: z.literal(unit),
  }).strict() as z.ZodType<Quantity<Unit>>;
}

export function positiveQuantitySchema<Unit extends QuantityUnit>(unit: Unit): z.ZodType<Quantity<Unit>> {
  return z.object({
    value: z.number().finite().positive(),
    unit: z.literal(unit),
  }).strict() as z.ZodType<Quantity<Unit>>;
}
