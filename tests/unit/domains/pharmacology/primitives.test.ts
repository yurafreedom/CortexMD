import { describe, expect, it } from 'vitest';
import {
  biologicalProcessIdSchema,
  drugIdSchema,
  evidenceIdSchema,
  molecularTargetIdSchema,
  quantitySchema,
} from '@/domains/pharmacology/validation/primitives';

describe('pharmacology primitive validators', () => {
  it('rejects blank identifiers while preserving valid opaque values exactly', () => {
    for (const schema of [drugIdSchema, molecularTargetIdSchema, biologicalProcessIdSchema, evidenceIdSchema]) {
      expect(schema.safeParse('').success).toBe(false);
      expect(schema.safeParse('   ').success).toBe(false);
    }

    const opaque = 'Internal:Case-Sensitive/42';
    expect(drugIdSchema.parse(opaque)).toBe(opaque);
    expect(molecularTargetIdSchema.parse(opaque)).toBe(opaque);
  });

  it('requires an explicit allowed unit and a finite numeric value', () => {
    expect(quantitySchema.parse({ value: -3.5, unit: 'ratio' })).toEqual({ value: -3.5, unit: 'ratio' });
    expect(quantitySchema.safeParse({ value: Number.NaN, unit: 'mg' }).success).toBe(false);
    expect(quantitySchema.safeParse({ value: Number.POSITIVE_INFINITY, unit: 'mg' }).success).toBe(false);
    expect(quantitySchema.safeParse({ value: 1 }).success).toBe(false);
    expect(quantitySchema.safeParse({ value: 1, unit: 'мг' }).success).toBe(false);
  });

  it('keeps quantities distinct and performs no unit conversion', () => {
    const pairs = [
      [{ value: 2000, unit: 'IU' }, { value: 2000, unit: 'mg' }],
      [{ value: 0.5, unit: 'mg/kg' }, { value: 0.5, unit: 'mg' }],
      [{ value: 1, unit: 'tablet' }, { value: 1, unit: 'mg' }],
    ] as const;

    for (const [left, right] of pairs) {
      expect(quantitySchema.parse(left)).toEqual(left);
      expect(quantitySchema.parse(right)).toEqual(right);
      expect(quantitySchema.parse(left)).not.toEqual(quantitySchema.parse(right));
    }
  });
});
