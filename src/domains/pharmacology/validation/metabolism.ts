import { z } from 'zod';
import { CYP_RELATIONSHIP_KINDS, CYP_STRENGTHS } from '../model/metabolism';
import { evidenceBackedSchema } from './epistemics';
import { molecularTargetRefSchema } from './target';

const cypEnzymeSchema = molecularTargetRefSchema.extend({
  kind: z.literal('ENZYME'),
});

export const cypRelationshipSchema = z.object({
  enzyme: cypEnzymeSchema,
  relationship: evidenceBackedSchema(z.enum(CYP_RELATIONSHIP_KINDS)),
  strength: evidenceBackedSchema(z.enum(CYP_STRENGTHS)).optional(),
}).strict();
