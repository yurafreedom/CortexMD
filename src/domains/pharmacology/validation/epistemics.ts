import { z } from 'zod';
import {
  CURATION_STATUSES,
  DERIVATION_KINDS,
  type Knowledge,
} from '../model/knowledge';
import { EVIDENCE_RELATIONS, EVIDENCE_SOURCE_TYPES } from '../model/evidence';
import { evidenceIdSchema } from './primitives';

const requiredText = z.string().trim().min(1);
const optionalText = requiredText.optional();

export const derivationKindSchema = z.enum(DERIVATION_KINDS);
export const curationStatusSchema = z.enum(CURATION_STATUSES);

export function knowledgeSchema<T extends z.ZodType>(valueSchema: T): z.ZodType<Knowledge<z.output<T>>> {
  const conflictCandidateSchema = z.object({
    value: valueSchema,
    derivation: derivationKindSchema,
  }).strict();

  return z.discriminatedUnion('state', [
    z.object({
      state: z.literal('KNOWN'),
      value: valueSchema,
      derivation: derivationKindSchema,
    }).strict(),
    z.object({ state: z.literal('UNKNOWN'), reason: optionalText }).strict(),
    z.object({ state: z.literal('NOT_CURATED'), reason: optionalText }).strict(),
    z.object({ state: z.literal('NOT_APPLICABLE'), rationale: requiredText }).strict(),
    z.object({
      state: z.literal('CONFLICTING'),
      candidates: z.array(conflictCandidateSchema).min(2),
      reason: optionalText,
    }).strict(),
  ]) as z.ZodType<Knowledge<z.output<T>>>;
}

export const evidenceExternalIdentifierSchema = z.object({
  namespace: requiredText,
  value: requiredText,
}).strict();

export const evidenceRefSchema = z.object({
  id: evidenceIdSchema,
  sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
  externalIdentifiers: z.array(evidenceExternalIdentifierSchema).optional(),
  title: optionalText,
  url: z.url().optional(),
  publicationDate: optionalText,
  publicationYear: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean(), z.null()])).optional(),
}).strict();

export const evidenceLocatorSchema = z.object({
  page: optionalText,
  table: optionalText,
  section: optionalText,
  figure: optionalText,
  note: optionalText,
}).strict().refine(
  (locator) => Object.values(locator).some((value) => value !== undefined),
  'locator must identify at least one location',
);

export const evidenceLinkSchema = z.object({
  evidenceId: evidenceIdSchema,
  relation: z.enum(EVIDENCE_RELATIONS),
  locator: evidenceLocatorSchema.optional(),
}).strict();

export function evidenceBackedSchema<T extends z.ZodType>(valueSchema: T) {
  return z.object({
    knowledge: knowledgeSchema(valueSchema),
    curationStatus: curationStatusSchema,
    evidenceLinks: z.array(evidenceLinkSchema),
  }).strict();
}
