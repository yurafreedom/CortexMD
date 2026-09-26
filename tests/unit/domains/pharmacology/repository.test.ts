import { describe, expect, expectTypeOf, it } from 'vitest';
import { DRUGS } from '@/data/drugs';
import { DRUGS_V2 } from '@/data/drugs.v2';
import { createCurrentCompatibilityDrugReadRepository } from '@/domains/pharmacology/compatibility/current-read-repository';
import type { CanonicalDrug } from '@/domains/pharmacology/model';
import type {
  CanonicalDrugReadRepository,
  CanonicalDrugReadResult,
} from '@/domains/pharmacology/repository';
import dataQualityFixture from '../../../fixtures/pharmacology/current-data-quality.json';
import migrationFixture from '../../../fixtures/pharmacology/wave0-migration-characterization.json';

const repository = createCurrentCompatibilityDrugReadRepository();
const records = repository.listDrugs();

const sigma1Modes = {
  ag: 'AGONIST',
  inv: 'INVERSE_AGONIST',
  ant: 'ANTAGONIST',
} as const;

function found(id: string): CanonicalDrug {
  const result = repository.findDrugById(id);
  expect(result.status).toBe('FOUND');
  if (result.status !== 'FOUND') throw new Error(`Expected ${id} to be addressable`);
  return result.drug;
}

describe('Wave 2 canonical pharmacology read repository', () => {
  it('exposes only the immutable canonical read contract at the type boundary', () => {
    expectTypeOf(repository).toMatchTypeOf<CanonicalDrugReadRepository>();
    expectTypeOf(repository.listDrugs()).toEqualTypeOf<readonly CanonicalDrug[]>();
    expectTypeOf(repository.findDrugById('sertraline')).toEqualTypeOf<CanonicalDrugReadResult>();
    expect(Object.keys(repository).sort()).toEqual(['findDrugById', 'listDrugs']);
    expect(Object.isFrozen(repository)).toBe(true);
  });

  it('addresses all 116 current-compatible records in stable V1 source order', () => {
    const sourceIds = Object.keys(DRUGS);
    expect(records).toHaveLength(116);
    expect(sourceIds).toHaveLength(116);
    expect(records.map(({ id }) => id)).toEqual(sourceIds);
    expect([...sourceIds].sort()).toEqual(dataQualityFixture.ids);

    for (const id of sourceIds) {
      expect(repository.findDrugById(id)).toMatchObject({ status: 'FOUND', drug: { id } });
    }
  });

  it('matches V1 identity, names, aliases, targets, Ki values, and ordering exactly', () => {
    for (const [index, [legacyKey, legacy]] of Object.entries(DRUGS).entries()) {
      const canonical = records[index];
      expect(canonical.id).toBe(legacyKey);
      expect(canonical.id).toBe(legacy.id);
      expect(canonical.canonicalName).toBe(legacy.n);
      expect(canonical.aliases).toEqual([legacy.brand, legacy.s]);
      expect(canonical.targetInteractions.map(({ target }) => target.id)).toEqual(Object.keys(legacy.ki));

      for (const interaction of canonical.targetInteractions) {
        expect(interaction.interactionType).toBe('AFFINITY');
        if (interaction.interactionType !== 'AFFINITY') continue;

        const targetId = interaction.target.id;
        expect(interaction.target.preferredLabel).toBe(targetId);
        expect(interaction.affinity).toEqual({
          knowledge: {
            state: 'KNOWN',
            value: { value: legacy.ki[targetId], unit: 'nM' },
            derivation: 'LITERATURE_CURATED',
          },
          curationStatus: 'UNREVIEWED',
          evidenceLinks: [],
        });
        expect(interaction.intrinsicEfficacy).toEqual({
          knowledge: {
            state: 'NOT_CURATED',
            reason: 'current V1 data does not encode intrinsic efficacy',
          },
          curationStatus: 'UNREVIEWED',
          evidenceLinks: [],
        });

        const expectedMode = targetId === 's1' && legacy.s1t
          ? {
              state: 'KNOWN',
              value: sigma1Modes[legacy.s1t],
              derivation: 'LITERATURE_CURATED',
            }
          : {
              state: 'NOT_CURATED',
              reason: 'current V1 data does not encode a reviewed pharmacological mode',
            };
        expect(interaction.pharmacologicalMode.knowledge).toEqual(expectedMode);
        expect(interaction.pharmacologicalMode.curationStatus).toBe('UNREVIEWED');
        expect(interaction.pharmacologicalMode.evidenceLinks).toEqual([]);
      }
    }
  });

  it('uses deterministic exact identity and fails closed for invalid, alias, case, and fuzzy input', () => {
    expect(repository.findDrugById('')).toEqual({ status: 'INVALID_ID', input: '' });
    expect(repository.findDrugById('   ')).toEqual({ status: 'INVALID_ID', input: '   ' });
    expect(repository.findDrugById(' sertraline ')).toEqual({ status: 'INVALID_ID', input: ' sertraline ' });

    for (const input of ['missing-drug', 'SERTRALINE', 'Sertraline', 'sertralin', 'Zoloft', 'Золофт', 'СЕРТ']) {
      expect(repository.findDrugById(input)).toEqual({ status: 'NOT_FOUND', id: input });
    }
  });

  it('preserves explicit target kinds without target-name normalization', () => {
    const kinds = Object.fromEntries(records.flatMap((record) => record.targetInteractions.flatMap((interaction) =>
      interaction.interactionType === 'AFFINITY'
        ? [[interaction.target.id, interaction.target.kind]]
        : [])));

    expect(kinds).toEqual({
      '5HT1A': 'RECEPTOR',
      '5HT1B': 'RECEPTOR',
      '5HT2C': 'RECEPTOR',
      '5HT3': 'RECEPTOR',
      '5HT7': 'RECEPTOR',
      AChE: 'ENZYME',
      D2: 'RECEPTOR',
      D3: 'RECEPTOR',
      DAT: 'TRANSPORTER',
      H1: 'RECEPTOR',
      NET: 'TRANSPORTER',
      NMDA: 'RECEPTOR',
      SERT: 'TRANSPORTER',
      a2A: 'RECEPTOR',
      alpha1: 'RECEPTOR',
      s1: 'RECEPTOR',
    });
    expect(kinds).not.toHaveProperty('alpha2A');
  });

  it('keeps V2-only bindings and all 11 unresolved zero-Ki rows inactive', () => {
    const repositoryInteractions = records.flatMap(({ targetInteractions }) => targetInteractions);
    const v1BindingCount = Object.values(DRUGS).reduce((count, drug) => count + Object.keys(drug.ki).length, 0);
    const v2BindingCount = Object.values(DRUGS_V2).reduce((count, drug) => count + drug.bindings.length, 0);

    expect(repositoryInteractions).toHaveLength(90);
    expect(v1BindingCount).toBe(90);
    expect(v2BindingCount).toBe(349);
    expect(v2BindingCount - v1BindingCount).toBe(259);
    expect(migrationFixture.zeroKiBindings).toHaveLength(11);
    expect(repositoryInteractions.some((interaction) =>
      interaction.interactionType === 'AFFINITY'
      && interaction.affinity.knowledge.state === 'KNOWN'
      && interaction.affinity.knowledge.value.value === 0)).toBe(false);

    for (const { drugId, receptor } of migrationFixture.zeroKiBindings) {
      expect(found(drugId).targetInteractions.some(({ target }) => target.id === receptor)).toBe(false);
    }
  });

  it('quarantines current CYP policy and adds no scientific metabolism relationship', () => {
    const legacyCypRecords = Object.values(DRUGS).filter(({ cyp, cyp2d6i, cyp2d6s }) =>
      cyp !== undefined || cyp2d6i !== undefined || cyp2d6s !== undefined);
    expect(legacyCypRecords).toHaveLength(9);
    expect(records.every(({ metabolismRelationships }) => metabolismRelationships.length === 0)).toBe(true);

    for (const legacy of legacyCypRecords) {
      const canonical = found(legacy.id);
      expect(canonical.metabolismRelationships).toEqual([]);
      expect(canonical).not.toHaveProperty('cyp');
      expect(canonical).not.toHaveProperty('cyp2d6i');
      expect(canonical).not.toHaveProperty('cyp2d6s');
      expect(canonical).not.toHaveProperty('doseMultiplier');
      expect(canonical).not.toHaveProperty('exposurePolicy');
    }
  });

  it('does not leak raw product, dose, PK, regional, warning, or generated fields', () => {
    const forbiddenFields = [
      'brand', 'n', 'c', 's', 'doses', 'def', 'u', 'warnDose', 'maxDose', 'warnText',
      'warnings', 'ki', 'z', 'pk', 'bindings', 'region_targets', 'default_dose', 'legacyCompatibility',
    ];

    for (const canonical of records) {
      for (const field of forbiddenFields) expect(canonical).not.toHaveProperty(field);
    }
  });

  it('does not promote availability to review or invent structured evidence', () => {
    const claims = records.flatMap(({ targetInteractions }) => targetInteractions.flatMap((interaction) => {
      if (interaction.interactionType !== 'AFFINITY') return [];
      return [interaction.affinity, interaction.pharmacologicalMode, interaction.intrinsicEfficacy];
    }));

    expect(claims).toHaveLength(270);
    expect(claims.every(({ curationStatus }) => curationStatus === 'UNREVIEWED')).toBe(true);
    expect(claims.every(({ evidenceLinks }) => evidenceLinks.length === 0)).toBe(true);
    expect(JSON.stringify(records)).not.toMatch(/VERIFIED/);
  });

  it('returns deeply frozen records that cannot become a second mutable truth store', () => {
    const sertraline = found('sertraline');
    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(sertraline)).toBe(true);
    expect(Object.isFrozen(sertraline.aliases)).toBe(true);
    expect(Object.isFrozen(sertraline.targetInteractions)).toBe(true);
    expect(Object.isFrozen(sertraline.targetInteractions[0])).toBe(true);
    expect(Object.isFrozen(sertraline.targetInteractions[0].target)).toBe(true);
  });
});
