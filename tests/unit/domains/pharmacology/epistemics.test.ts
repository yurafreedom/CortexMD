import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { DERIVATION_KINDS, KNOWLEDGE_STATES } from '@/domains/pharmacology/model/knowledge';
import {
  curationStatusSchema,
  evidenceBackedSchema,
  evidenceLinkSchema,
  evidenceRefSchema,
  knowledgeSchema,
} from '@/domains/pharmacology/validation/epistemics';

const textKnowledgeSchema = knowledgeSchema(z.string());
const textEvidenceBackedSchema = evidenceBackedSchema(z.string());

describe('pharmacology epistemic validators', () => {
  it('supports every availability state without mixing in derivation', () => {
    const examples = [
      { state: 'KNOWN', value: 'value', derivation: 'MEASURED' },
      { state: 'UNKNOWN', reason: 'not reported' },
      { state: 'NOT_CURATED', reason: 'awaiting review' },
      { state: 'NOT_APPLICABLE', rationale: 'claim does not apply' },
      {
        state: 'CONFLICTING',
        candidates: [
          { value: 'first', derivation: 'LITERATURE_CURATED' },
          { value: 'second', derivation: 'MEASURED' },
        ],
      },
    ] as const;

    expect(examples.map((example) => textKnowledgeSchema.parse(example).state)).toEqual(KNOWLEDGE_STATES);
    expect(textKnowledgeSchema.safeParse({ state: 'ESTIMATED', value: 'value' }).success).toBe(false);
    expect(textKnowledgeSchema.safeParse({ state: 'MODEL_DERIVED', value: 'value' }).success).toBe(false);
    expect(textKnowledgeSchema.safeParse({ state: 'HEURISTIC', value: 'value' }).success).toBe(false);
  });

  it('supports every derivation only on known or conflicting values', () => {
    for (const derivation of DERIVATION_KINDS) {
      expect(textKnowledgeSchema.parse({ state: 'KNOWN', value: derivation, derivation })).toEqual({
        state: 'KNOWN', value: derivation, derivation,
      });
    }

    expect(textKnowledgeSchema.safeParse({ state: 'UNKNOWN', derivation: 'ESTIMATED' }).success).toBe(false);
  });

  it('keeps unknown distinct from estimated and from zero', () => {
    const numericKnowledgeSchema = knowledgeSchema(z.number().finite());
    const unknown = numericKnowledgeSchema.parse({ state: 'UNKNOWN' });
    const estimatedZero = numericKnowledgeSchema.parse({ state: 'KNOWN', value: 0, derivation: 'ESTIMATED' });

    expect(unknown).toEqual({ state: 'UNKNOWN' });
    expect(estimatedZero).toEqual({ state: 'KNOWN', value: 0, derivation: 'ESTIMATED' });
    expect(unknown).not.toEqual(estimatedZero);
  });

  it('requires rationale and complete conflicting candidates', () => {
    expect(textKnowledgeSchema.safeParse({ state: 'NOT_APPLICABLE', rationale: ' ' }).success).toBe(false);
    expect(textKnowledgeSchema.safeParse({
      state: 'CONFLICTING',
      candidates: [{ value: 'only', derivation: 'MEASURED' }],
    }).success).toBe(false);
    expect(textKnowledgeSchema.safeParse({
      state: 'CONFLICTING',
      candidates: [{ value: 'one', derivation: 'MEASURED' }, { value: 'two' }],
    }).success).toBe(false);
  });

  it('keeps human curation independent from truth and permits known values without evidence', () => {
    expect(curationStatusSchema.options).toEqual([
      'UNREVIEWED', 'NEEDS_REVIEW', 'HUMAN_REVIEWED', 'REJECTED',
    ]);
    expect(textEvidenceBackedSchema.parse({
      knowledge: { state: 'UNKNOWN', reason: 'human review found no usable value' },
      curationStatus: 'HUMAN_REVIEWED',
      evidenceLinks: [],
    }).knowledge.state).toBe('UNKNOWN');
    expect(textEvidenceBackedSchema.safeParse({
      knowledge: { state: 'KNOWN', value: 'claim', derivation: 'LITERATURE_CURATED' },
      curationStatus: 'UNREVIEWED',
      evidenceLinks: [],
    }).success).toBe(true);
    expect(curationStatusSchema.safeParse('VERIFIED').success).toBe(false);
  });

  it('separates source identity from a claim relationship', () => {
    const source = evidenceRefSchema.parse({
      id: 'evidence:source-1',
      sourceType: 'PEER_REVIEWED_ARTICLE',
      externalIdentifiers: [
        { namespace: 'PMID', value: '12345678' },
        { namespace: 'DOI', value: '10.1000/example' },
        { namespace: 'catalog', value: 'record-9' },
      ],
      title: 'Synthetic source fixture',
      publicationYear: 2024,
    });
    const link = evidenceLinkSchema.parse({
      evidenceId: source.id,
      relation: 'SUPPORTS',
      locator: { page: '4', table: '2' },
    });

    expect(source.id).toBe(link.evidenceId);
    expect(source).not.toHaveProperty('status');
    expect(source).not.toHaveProperty('relation');
    expect(link).not.toHaveProperty('sourceType');
    expect(evidenceRefSchema.safeParse({ ...source, status: 'VERIFIED' }).success).toBe(false);
    expect(evidenceLinkSchema.safeParse({ evidenceId: source.id }).success).toBe(false);
    expect(evidenceLinkSchema.safeParse({ ...link, relation: 'VERIFIES' }).success).toBe(false);
  });
});
