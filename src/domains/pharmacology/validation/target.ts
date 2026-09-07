import { z } from 'zod';
import { MOLECULAR_TARGET_KINDS } from '../model/target';
import { biologicalProcessIdSchema, molecularTargetIdSchema } from './primitives';

const optionalLabel = z.string().trim().min(1).optional();

export const molecularTargetRefSchema = z.object({
  targetType: z.literal('MOLECULAR_TARGET'),
  id: molecularTargetIdSchema,
  kind: z.enum(MOLECULAR_TARGET_KINDS),
  preferredLabel: optionalLabel,
}).strict();

export const biologicalProcessRefSchema = z.object({
  targetType: z.literal('BIOLOGICAL_PROCESS'),
  id: biologicalProcessIdSchema,
  preferredLabel: optionalLabel,
}).strict();

export const pharmacologyTargetRefSchema = z.discriminatedUnion('targetType', [
  molecularTargetRefSchema,
  biologicalProcessRefSchema,
]);
