import { z } from 'zod';
import { FUNCTIONAL_DIRECTIONS, PHARMACOLOGICAL_MODES } from '../model/interaction';
import { evidenceBackedSchema } from './epistemics';
import { positiveQuantitySchema, quantitySchemaFor } from './primitives';
import { molecularTargetRefSchema, pharmacologyTargetRefSchema } from './target';

const affinitySchema = evidenceBackedSchema(positiveQuantitySchema('nM'));
const pharmacologicalModeSchema = evidenceBackedSchema(z.enum(PHARMACOLOGICAL_MODES));
const intrinsicEfficacySchema = evidenceBackedSchema(quantitySchemaFor('ratio'));

export const affinityInteractionSchema = z.object({
  interactionType: z.literal('AFFINITY'),
  target: molecularTargetRefSchema,
  affinity: affinitySchema,
  pharmacologicalMode: pharmacologicalModeSchema,
  intrinsicEfficacy: intrinsicEfficacySchema,
}).strict();

export const functionalInteractionSchema = z.object({
  interactionType: z.literal('FUNCTIONAL'),
  target: pharmacologyTargetRefSchema,
  direction: evidenceBackedSchema(z.enum(FUNCTIONAL_DIRECTIONS)),
}).strict();

export const targetInteractionSchema = z.discriminatedUnion('interactionType', [
  affinityInteractionSchema,
  functionalInteractionSchema,
]);
