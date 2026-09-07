import { z } from 'zod';
import { CANONICAL_PHARMACOLOGY_MODEL_VERSION } from '../model/drug';
import { targetInteractionSchema } from './interaction';
import { cypRelationshipSchema } from './metabolism';
import { drugIdSchema } from './primitives';

const requiredText = z.string().trim().min(1);

export const canonicalDrugSchema = z.object({
  modelVersion: z.literal(CANONICAL_PHARMACOLOGY_MODEL_VERSION),
  id: drugIdSchema,
  canonicalName: requiredText,
  aliases: z.array(requiredText),
  targetInteractions: z.array(targetInteractionSchema),
  metabolismRelationships: z.array(cypRelationshipSchema),
}).strict();
