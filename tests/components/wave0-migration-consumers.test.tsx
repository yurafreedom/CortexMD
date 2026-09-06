import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DoseSlider from '@/components/Drugs/DoseSlider';
import GlutamatePopup from '@/components/IndicatorPopup/GlutamatePopup';
import RegionalDensityCard from '@/components/Panels/RegionalDensityCard';
import TreatmentHistoryForm from '@/app/profile/TreatmentHistoryForm';
import { DRUGS } from '@/data/drugs';
import { DRUGS_V2 } from '@/data/drugs.v2';
import { useScheme } from '@/hooks/useScheme';
import fixture from '../fixtures/pharmacology/wave0-migration-characterization.json';

const CHARACTERIZATION_WARNING = 'CURRENT BEHAVIOR CHARACTERIZATION — NOT SCIENTIFIC VALIDATION — NOT CLINICAL VALIDATION';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }));
});

describe('Wave 0 dose/default/warning UI characterization', () => {
  it.each([
    ['buspirone', '5', '30', '5'],
    ['memantine', '5', '20', '5'],
    ['topiramate', '25', '200', '25'],
  ])('freezes the V1 %s slider min/max/step and selectable range', (drugId, min, max, step) => {
    const { container } = render(
      <DoseSlider drugId={drugId} currentDose={Number(min)} color="#123456" activeDrugs={{ [drugId]: Number(min) }} onChange={vi.fn()} />,
    );
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider).toHaveAttribute('min', min);
    expect(slider).toHaveAttribute('max', max);
    expect(slider).toHaveAttribute('step', step);
    expect(DRUGS[drugId].doses).not.toEqual(DRUGS_V2[drugId].doses);
  });

  it('freezes the V1 memantine maximum boundary below, at, and above 20', () => {
    const props = { drugId: 'memantine', color: '#123456', onChange: vi.fn() };
    const { container, rerender } = render(
      <DoseSlider {...props} currentDose={19} activeDrugs={{ memantine: 19 }} />,
    );
    expect(container.querySelector<HTMLElement>('.dval')?.style.color).toBe('');
    rerender(<DoseSlider {...props} currentDose={20} activeDrugs={{ memantine: 20 }} />);
    expect(container.querySelector<HTMLElement>('.dval')?.style.color).toBe('rgb(239, 68, 68)');
    rerender(<DoseSlider {...props} currentDose={21} activeDrugs={{ memantine: 21 }} />);
    expect(container.querySelector<HTMLElement>('.dval')?.style.color).toBe('rgb(239, 68, 68)');
  });

  it.each(fixture.humanReviewCases.filter((reviewCase) => reviewCase.field === 'warn_dose'))(
    '$decisionId keeps the V1 $drugId slider free of the V2 warning threshold',
    ({ drugId, v2 }) => {
      const threshold = v2 as number;
      const props = { drugId, color: '#123456', onChange: vi.fn() };
      const { container, rerender } = render(
        <DoseSlider {...props} currentDose={threshold - 1} activeDrugs={{ [drugId]: threshold - 1 }} />,
      );
      const currentColor = () => container.querySelector<HTMLElement>('.dr')?.style.getPropertyValue('--c');
      expect(DRUGS[drugId].warnDose).toBeUndefined();
      expect(currentColor()).not.toBe('#f59e0b');
      rerender(<DoseSlider {...props} currentDose={threshold} activeDrugs={{ [drugId]: threshold }} />);
      expect(currentColor()).not.toBe('#f59e0b');
      rerender(<DoseSlider {...props} currentDose={threshold + 1} activeDrugs={{ [drugId]: threshold + 1 }} />);
      expect(currentColor()).not.toBe('#f59e0b');
    },
  );

  it('freezes riluzole V1 default selection and versionless localStorage write', async () => {
    const { result } = renderHook(() => useScheme());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.addDrug('riluzole'));
    expect(result.current.scheme).toEqual({ riluzole: 100 });
    await waitFor(() => expect(localStorage.getItem('cortexmd_scheme')).toBe('{"riluzole":100}'));
    expect(JSON.parse(localStorage.getItem('cortexmd_scheme')!)).not.toHaveProperty('version');
  });
});

describe('Wave 0 persistence and non-mg dose_mg characterization', () => {
  it('loads and re-saves the current versionless scheme and preset shapes', async () => {
    const payload = { ketamine: 0.5, auvelity: 1, b_vitamins: 1, vitamin_d: 2000 };
    localStorage.setItem('cortexmd_scheme', JSON.stringify(payload));
    const { result } = renderHook(() => useScheme());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.scheme).toEqual(payload);
    act(() => result.current.saveCustomPreset('wave0'));
    expect(localStorage.getItem('cortexmd_preset_wave0')).toBe(JSON.stringify(payload));
    expect(JSON.parse(localStorage.getItem('cortexmd_preset_wave0')!)).not.toHaveProperty('version');
  });

  it('freezes malformed and array localStorage values falling back to an empty scheme', async () => {
    for (const raw of ['not-json', '[]', 'null']) {
      localStorage.setItem('cortexmd_scheme', raw);
      const { result, unmount } = renderHook(() => useScheme());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.scheme).toEqual({});
      unmount();
    }
  });

  it.each(fixture.nonMgDoseUnits)('serializes $drugId $unit through the treatment dose_mg contract', async ({ drugId, defaultDose }) => {
    const { container } = render(<TreatmentHistoryForm existingHistory={[]} />);
    fireEvent.change(container.querySelector('select')!, { target: { value: drugId } });
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="number"]')!, { target: { value: String(defaultDose) } });
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="date"]')!, { target: { value: '2026-09-06' } });
    fireEvent.click(screen.getByText('treatmentForm.addEntry'));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(request?.body as string)).toMatchObject({
      drug_id: drugId,
      dose_mg: defaultDose,
      started_at: '2026-09-06',
    });
    expect(JSON.parse(request?.body as string)).not.toHaveProperty('dose_unit');
    expect(JSON.parse(request?.body as string)).not.toHaveProperty('version');
  });

  it('renders a non-mg historical quantity with the current hard-coded mg suffix', () => {
    render(<TreatmentHistoryForm existingHistory={[{
      drug_id: 'ketamine', dose_mg: 0.5, started_at: '2026-09-01', ended_at: null,
    }]} />);
    expect(screen.getByText('0.5mg')).toBeInTheDocument();
  });
});

describe('Wave 0 regional and popup characterization', () => {
  it('renders current V2 regional density and calculated balance separately from V1 narrative', () => {
    render(<RegionalDensityCard region="dlPFC" activeDrugs={{ sertraline: 100 }} />);
    expect(screen.getByText('PET Receptor Density')).toBeInTheDocument();
    expect(screen.getByText('Regional Balance')).toBeInTheDocument();
    expect(screen.getByText('+37%')).toBeInTheDocument();
    expect(screen.queryByText(DRUGS.sertraline.z.dlPFC.fx[0])).not.toBeInTheDocument();
  });

  it('freezes the popup display path treating topiramate zero-Ki bindings as 50%', () => {
    render(
      <GlutamatePopup
        isOpen
        onClose={vi.fn()}
        activeDrugs={[{ drug: DRUGS_V2.topiramate, dose_mg: 200 }]}
      />,
    );
    expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/topiramate \(antagonist: 50%\)/)).toHaveLength(2);
    expect(screen.queryByText(/topiramate \(modulator: 50%\)/)).not.toBeInTheDocument();
  });

  it('keeps this component suite explicitly non-validating', () => {
    expect(CHARACTERIZATION_WARNING).toContain('NOT SCIENTIFIC VALIDATION');
  });
});
