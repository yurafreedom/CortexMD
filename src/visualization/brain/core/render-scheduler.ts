export interface FrameSchedulingApi {
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(handle: number): void;
}

export interface ContinuousFrameLoop {
  readonly running: boolean;
  start(): void;
  stop(): void;
}

const browserFrameScheduling: FrameSchedulingApi = {
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

/**
 * Owns the current always-on frame lifecycle. NV-0 intentionally preserves
 * the immediate first render and continuous requestAnimationFrame behavior.
 */
export function createContinuousFrameLoop(
  onFrame: () => void,
  scheduling: FrameSchedulingApi = browserFrameScheduling,
): ContinuousFrameLoop {
  let frameHandle = 0;
  let running = false;

  const tick: FrameRequestCallback = () => {
    if (!running) return;
    frameHandle = scheduling.requestFrame(tick);
    onFrame();
  };

  return {
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      tick(0);
    },
    stop() {
      if (!running) return;
      running = false;
      scheduling.cancelFrame(frameHandle);
    },
  };
}
