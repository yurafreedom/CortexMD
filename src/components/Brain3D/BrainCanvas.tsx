'use client';

import { useEffect, useRef } from 'react';
import {
  createCurrentBrainRuntime,
  type CurrentBrainRuntime,
} from '@/visualization/brain/core/renderer-lifecycle';

export interface BrainCanvasProps {
  activeDrugs: Record<string, number>;
  selectedRegion: string | null;
  selectedDeficit: string | null;
  /** Zone IDs to highlight red when a conflict is hovered */
  conflictZones?: string[];
  onRegionClick: (id: string | null, screenPos?: { x: number; y: number }) => void;
  onRegionHover: (id: string | null, event?: MouseEvent) => void;
  /** Overall brain-mesh opacity override (0-1). Defaults to 0.15 */
  opacity?: number;
  /** Whether the right panel is open (used for resize calc) */
  rightPanelOpen?: boolean;
  /** Left-panel width in px. Default 280 */
  leftPanelWidth?: number;
  /** Right-panel width in px (when open). Default 340 */
  rightPanelWidth?: number;
}

export default function BrainCanvas({
  activeDrugs,
  selectedRegion,
  selectedDeficit,
  conflictZones = [],
  onRegionClick,
  onRegionHover,
  opacity = 0.15,
  rightPanelOpen = false,
  leftPanelWidth = 280,
  rightPanelWidth = 340,
}: BrainCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<CurrentBrainRuntime | null>(null);
  const propsRef = useRef({
    selectedRegion,
    selectedDeficit,
    opacity,
    onRegionClick,
    onRegionHover,
  });

  propsRef.current = {
    selectedRegion,
    selectedDeficit,
    opacity,
    onRegionClick,
    onRegionHover,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const runtime = createCurrentBrainRuntime(container, () => propsRef.current);
    runtimeRef.current = runtime;
    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const resize = () => runtimeRef.current?.resize();
    resize();
    const timer = setTimeout(resize, 350);
    return () => clearTimeout(timer);
  }, [rightPanelOpen, leftPanelWidth, rightPanelWidth]);

  useEffect(() => {
    runtimeRef.current?.updateOverlays({
      activeDrugs,
      selectedRegion,
      selectedDeficit,
      conflictZones,
    });
  }, [activeDrugs, selectedRegion, selectedDeficit, conflictZones]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', cursor: 'default' }}
    />
  );
}
