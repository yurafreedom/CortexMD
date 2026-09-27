import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const runtime = {
    resize: vi.fn(),
    updateOverlays: vi.fn(),
    dispose: vi.fn(),
  };
  const createCurrentBrainRuntime = vi.fn((
    _container: HTMLDivElement,
    _getState: () => {
      selectedRegion: string | null;
      selectedDeficit: string | null;
      opacity: number;
      onRegionClick: (id: string | null, screenPos?: { x: number; y: number }) => void;
      onRegionHover: (id: string | null, event?: MouseEvent) => void;
    },
  ) => runtime);
  return { runtime, createCurrentBrainRuntime };
});

vi.mock('@/visualization/brain/core/renderer-lifecycle', () => ({
  createCurrentBrainRuntime: mocks.createCurrentBrainRuntime,
}));

import BrainCanvas, { type BrainCanvasProps } from '@/components/Brain3D/BrainCanvas';

afterEach(() => {
  vi.useRealTimers();
});

function props(overrides: Partial<BrainCanvasProps> = {}): BrainCanvasProps {
  return {
    activeDrugs: {},
    selectedRegion: null,
    selectedDeficit: null,
    onRegionClick: vi.fn(),
    onRegionHover: vi.fn(),
    ...overrides,
  };
}

describe('BrainCanvas React/Three boundary', () => {
  it('keeps the public prop contract and creates one instance-local runtime', () => {
    vi.useFakeTimers();
    const initial = props({ activeDrugs: { bupropion: 150 }, selectedRegion: 'dlPFC' });
    const view = render(<BrainCanvas {...initial} />);

    expect(mocks.createCurrentBrainRuntime).toHaveBeenCalledOnce();
    const [container, getState] = mocks.createCurrentBrainRuntime.mock.calls[0];
    expect(container).toBe(view.container.firstElementChild);
    expect(getState()).toEqual(expect.objectContaining({
      selectedRegion: 'dlPFC',
      selectedDeficit: null,
      opacity: 0.15,
      onRegionClick: initial.onRegionClick,
      onRegionHover: initial.onRegionHover,
    }));
    expect(mocks.runtime.updateOverlays).toHaveBeenLastCalledWith({
      activeDrugs: { bupropion: 150 },
      selectedRegion: 'dlPFC',
      selectedDeficit: null,
      conflictZones: [],
    });
    expect(mocks.runtime.resize).toHaveBeenCalledOnce();

    const next = props({
      activeDrugs: { sertraline: 100 },
      selectedRegion: 'amygdala',
      selectedDeficit: 'anxiety',
      conflictZones: ['amygdala'],
      opacity: 0.4,
      rightPanelOpen: true,
    });
    view.rerender(<BrainCanvas {...next} />);

    expect(mocks.createCurrentBrainRuntime).toHaveBeenCalledOnce();
    expect(getState()).toEqual(expect.objectContaining({
      selectedRegion: 'amygdala',
      selectedDeficit: 'anxiety',
      opacity: 0.4,
      onRegionClick: next.onRegionClick,
      onRegionHover: next.onRegionHover,
    }));
    expect(mocks.runtime.updateOverlays).toHaveBeenLastCalledWith({
      activeDrugs: { sertraline: 100 },
      selectedRegion: 'amygdala',
      selectedDeficit: 'anxiety',
      conflictZones: ['amygdala'],
    });
    expect(mocks.runtime.resize).toHaveBeenCalledTimes(2);

    vi.runOnlyPendingTimers();
    expect(mocks.runtime.resize).toHaveBeenCalledTimes(3);
    view.unmount();
    expect(mocks.runtime.dispose).toHaveBeenCalledOnce();
  });
});
