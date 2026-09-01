import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActiveScheme from '@/components/Drugs/ActiveScheme';
import DrugCatalog from '@/components/Drugs/DrugCatalog';
import BottomBar from '@/components/Panels/BottomBar';
import ZonePopup from '@/components/Panels/ZonePopup';
import RightPanel from '@/components/Panels/RightPanel';
import PresetComparisonModal from '@/components/Presets/PresetComparisonModal';
import CascadeOverlay from '@/components/Sigma1/CascadeOverlay';
import GlutamateCascadeOverlay from '@/components/GlutamateCascade/GlutamateCascadeOverlay';
import { DRUGS } from '@/data/drugs';
import { DRUGS_V2 } from '@/data/drugs.v2';
import { RG } from '@/data/brainRegions';
import { calculateSigma1Balance } from '@/lib/indicators/sigma1';
import { gH } from '@/lib/pharmacology';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ data: [] }) }));
});

function indicatorValue(container: HTMLElement, label: string) {
  const item = [...container.querySelectorAll<HTMLElement>('.hb')]
    .find((candidate) => candidate.querySelector('.hl')?.textContent === label);
  if (!item) throw new Error(`Missing indicator ${label}`);
  return item.querySelector('.hv')?.textContent;
}

describe('DrugCatalog and ActiveScheme characterization', () => {
  it('adds the filtered catalog drug through the existing public callback', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <DrugCatalog
        activeDrugs={{}}
        onAdd={onAdd}
        onRemove={vi.fn()}
        onUpdateDose={vi.fn()}
        onApplyPreset={vi.fn()}
      />,
    );
    await user.type(screen.getByPlaceholderText('dashboard.searchDrug'), 'sertraline');
    await user.click(screen.getByText(DRUGS.sertraline.s));
    expect(onAdd).toHaveBeenCalledWith('sertraline');
  });

  it('does not add an already active catalog drug twice', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <DrugCatalog
        activeDrugs={{ sertraline: 100 }}
        onAdd={onAdd}
        onRemove={vi.fn()}
        onUpdateDose={vi.fn()}
        onApplyPreset={vi.fn()}
      />,
    );
    await user.type(screen.getByPlaceholderText('dashboard.searchDrug'), 'sertraline');
    await user.click(screen.getByText(DRUGS.sertraline.s));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('characterizes modal dose editing and danger styling', async () => {
    const onUpdateDose = vi.fn();
    render(
      <DrugCatalog
        activeDrugs={{ sertraline: 200 }}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onUpdateDose={onUpdateDose}
        onApplyPreset={vi.fn()}
        isModal
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/profile/presets'));
    const range = document.body.querySelector<HTMLInputElement>('input[type="range"]');
    expect(range).not.toBeNull();
    expect(range?.value).toBe('200');
    expect(range?.style.accentColor).toBe('rgb(239, 68, 68)');
    fireEvent.change(range!, { target: { value: '150' } });
    expect(onUpdateDose).toHaveBeenCalledWith('sertraline', 150);
  });

  it('shows warnings, updates dose, removes drugs, and exposes CYP-adjusted dose alerts', () => {
    const onRemove = vi.fn();
    const onUpdateDose = vi.fn();
    const { container } = render(
      <ActiveScheme
        activeDrugs={{ sertraline: 200, bupropion: 300, atomoxetine: 80 }}
        onRemove={onRemove}
        onUpdateDose={onUpdateDose}
      />,
    );
    expect(screen.getByText(DRUGS.sertraline.warnings![200])).toBeInTheDocument();
    expect(container.querySelector('.cyp-alerts')).toHaveTextContent('Strattera');
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="range"]')!, { target: { value: '150' } });
    expect(onUpdateDose).toHaveBeenCalledWith('sertraline', 150);
    fireEvent.click(screen.getAllByTitle('dashboard.remove')[0]);
    expect(onRemove).toHaveBeenCalledWith('sertraline');
  });
});

describe('mixed-engine and regional consumer characterization', () => {
  it('renders legacy DA and V2 sigma values in BottomBar and dispatches indicator clicks', () => {
    const onIndicatorClick = vi.fn();
    const activeDrugs = { sertraline: 100, bupropion: 300 };
    const { container } = render(<BottomBar activeDrugs={activeDrugs} onIndicatorClick={onIndicatorClick} />);
    expect(indicatorValue(container, 'DA')).toBe(`${gH('DA', activeDrugs).toFixed(0)}%`);
    const sigma = calculateSigma1Balance([
      { drug: DRUGS_V2.sertraline, dose_mg: 100 },
      { drug: DRUGS_V2.bupropion, dose_mg: 300 },
    ]).value;
    expect(indicatorValue(container, 'σ1')).toBe(`${sigma.toFixed(0)}%`);
    fireEvent.click([...container.querySelectorAll<HTMLElement>('.hb')].find((item) => item.querySelector('.hl')?.textContent === 'σ1')!);
    expect(onIndicatorClick).toHaveBeenCalledWith('s1');
  });

  it('renders conditional ACB state in BottomBar', () => {
    const { container } = render(<BottomBar activeDrugs={{ amitriptyline: 75 }} />);
    expect(indicatorValue(container, 'ACh')).toBe('ACB:3');
  });

  it('renders ZonePopup current regional narrative and public actions', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenDetail = vi.fn();
    render(
      <ZonePopup
        zoneId="dlPFC"
        position={{ x: 200, y: 200 }}
        activeDrugs={{ sertraline: 100 }}
        onClose={onClose}
        onOpenDetail={onOpenDetail}
      />,
    );
    expect(screen.getByText(RG.dlPFC.f)).toBeInTheDocument();
    expect(screen.getByText(DRUGS.sertraline.z.dlPFC.fx[0])).toBeInTheDocument();
    await user.click(screen.getByText('common.details →'));
    expect(onOpenDetail).toHaveBeenCalledOnce();
    await user.click(document.querySelector<HTMLButtonElement>('.zone-popup-close')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders RightPanel regional explanation without changing its API', () => {
    render(
      <RightPanel
        isOpen
        selectedRegion="dlPFC"
        activeDrugs={{ sertraline: 100 }}
        deficits={[]}
        onClose={vi.fn()}
        onToggle={vi.fn()}
        onShowSigma1={vi.fn()}
        onSelectDeficit={vi.fn()}
      />,
    );
    expect(screen.getByText(RG.dlPFC.f)).toBeInTheDocument();
    expect(screen.getByText(DRUGS.sertraline.z.dlPFC.fx[0])).toBeInTheDocument();
  });
});

describe('preset and cascade characterization', () => {
  it('renders preset indicator and drug differences', () => {
    render(
      <PresetComparisonModal
        presetA={{ id: 'a', name: 'Preset A', drugs: { sertraline: 100 } }}
        presetB={{ id: 'b', name: 'Preset B', drugs: { bupropion: 300, lamotrigine: 200 } }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Preset A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Preset B').length).toBeGreaterThan(0);
    expect(screen.getByText('Only in Preset A')).toBeInTheDocument();
    expect(screen.getByText('Only in Preset B')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('σ1');
    expect(screen.getByRole('table')).toHaveTextContent('-85%');
  });

  it('renders the current sigma inverse-agonist overlay and closes it', () => {
    const onClose = vi.fn();
    render(<CascadeOverlay isOpen activeDrugs={{ sertraline: 100 }} onClose={onClose} />);
    expect(screen.getByText(/Клеточный уровень/)).toBeInTheDocument();
    expect(screen.getByText('-85%')).toBeInTheDocument();
    expect(screen.getByText(/инверсный агонизм/)).toBeInTheDocument();
    fireEvent.click(document.querySelector<HTMLElement>('.s1close')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders the current glutamate antagonist overlay and closes it', () => {
    const onClose = vi.fn();
    render(
      <GlutamateCascadeOverlay
        isOpen
        activeDrugs={[{ drug: DRUGS_V2.ketamine, dose_mg: 0.5 }]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Глутаматный каскад нейропластичности')).toBeInTheDocument();
    expect(screen.getByText('-4%')).toBeInTheDocument();
    expect(screen.getByText('Зона: Neutral')).toBeInTheDocument();
    expect(screen.queryByText(/NMDA-антагонизм/)).not.toBeInTheDocument();
    const close = screen.getByText('×');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
