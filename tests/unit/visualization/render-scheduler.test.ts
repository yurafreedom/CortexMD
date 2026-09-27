import { describe, expect, it, vi } from 'vitest';
import {
  createContinuousFrameLoop,
  type FrameSchedulingApi,
} from '@/visualization/brain/core/render-scheduler';

describe('current continuous frame lifecycle', () => {
  it('starts exactly once, renders immediately, schedules continuously, and cancels its owned handle', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextHandle = 1;
    const scheduling: FrameSchedulingApi = {
      requestFrame: vi.fn((callback) => {
        const handle = nextHandle++;
        callbacks.set(handle, callback);
        return handle;
      }),
      cancelFrame: vi.fn((handle) => callbacks.delete(handle)),
    };
    const onFrame = vi.fn();
    const loop = createContinuousFrameLoop(onFrame, scheduling);

    loop.start();
    loop.start();

    expect(loop.running).toBe(true);
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(scheduling.requestFrame).toHaveBeenCalledTimes(1);

    callbacks.get(1)?.(16);
    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(scheduling.requestFrame).toHaveBeenCalledTimes(2);

    loop.stop();
    loop.stop();

    expect(loop.running).toBe(false);
    expect(scheduling.cancelFrame).toHaveBeenCalledTimes(1);
    expect(scheduling.cancelFrame).toHaveBeenCalledWith(2);
  });
});
