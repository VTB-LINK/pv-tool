// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

/**
 * Performance auto-scaling — monitors frame rate and adaptively
 * reduces canvas resolution to maintain smooth rendering on low-end devices.
 *
 * Also provides lazy-loading helpers for dynamic effect imports.
 */

export interface PerfConfig {
  /** Target FPS to maintain (default: 30) */
  targetFps: number;
  /** Minimum DPR to downscale to (default: 0.5) */
  minDpr: number;
  /** Maximum DPR (default: device native) */
  maxDpr: number;
  /** How many consecutive slow frames before downscaling (default: 15) */
  slowFrameThreshold: number;
  /** How many consecutive fast frames before upscaling (default: 60) */
  fastFrameThreshold: number;
}

const DEFAULT_CONFIG: PerfConfig = {
  targetFps: 30,
  minDpr: 0.5,
  maxDpr: Math.min(window.devicePixelRatio || 1, 3),
  slowFrameThreshold: 15,
  fastFrameThreshold: 60,
};

export class PerfMonitor {
  private config: PerfConfig;
  private currentDpr: number;
  private slowFrames = 0;
  private fastFrames = 0;
  private frameTimeBuffer: number[] = [];
  private lastTime = 0;
  private running = false;
  private rafId = 0;
  private onDprChange: (dpr: number) => void;

  /** Estimated FPS over the last sampling window */
  fps = 0;

  constructor(onDprChange: (dpr: number) => void, config?: Partial<PerfConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentDpr = this.config.maxDpr;
    this.onDprChange = onDprChange;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  get dpr() { return this.currentDpr; }

  private tick() {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(() => {
      const now = performance.now();
      const dt = now - this.lastTime;
      this.lastTime = now;

      this.frameTimeBuffer.push(dt);
      if (this.frameTimeBuffer.length > 30) this.frameTimeBuffer.shift();

      // Average FPS over the buffer
      const avgDt = this.frameTimeBuffer.reduce((a, b) => a + b, 0) / this.frameTimeBuffer.length;
      this.fps = Math.round(1000 / avgDt);

      const targetMs = 1000 / this.config.targetFps;

      if (avgDt > targetMs * 1.3) {
        // Running slow
        this.slowFrames++;
        this.fastFrames = 0;
        if (this.slowFrames >= this.config.slowFrameThreshold) {
          this.scaleDown();
          this.slowFrames = 0;
        }
      } else if (avgDt < targetMs * 0.8) {
        // Running fast
        this.fastFrames++;
        this.slowFrames = 0;
        if (this.fastFrames >= this.config.fastFrameThreshold) {
          this.scaleUp();
          this.fastFrames = 0;
        }
      } else {
        this.slowFrames = 0;
        this.fastFrames = 0;
      }

      this.tick();
    });
  }

  private scaleDown() {
    const step = 0.25;
    const newDpr = Math.max(this.config.minDpr, this.currentDpr - step);
    if (newDpr !== this.currentDpr) {
      this.currentDpr = newDpr;
      this.onDprChange(newDpr);
      console.log(`[PerfMonitor] DPR ▼ ${newDpr.toFixed(2)} (fps≈${this.fps})`);
    }
  }

  private scaleUp() {
    const step = 0.25;
    const newDpr = Math.min(this.config.maxDpr, this.currentDpr + step);
    if (newDpr !== this.currentDpr) {
      this.currentDpr = newDpr;
      this.onDprChange(newDpr);
      console.log(`[PerfMonitor] DPR ▲ ${newDpr.toFixed(2)} (fps≈${this.fps})`);
    }
  }
}

/**
 * Detect if current device is likely low-performance.
 * Uses hardwareConcurrency and deviceMemory (if available).
 */
export function isLowEndDevice(): boolean {
  const cores = navigator.hardwareConcurrency || 2;
  const memory = (navigator as any).deviceMemory || 4; // GB
  return cores <= 2 || memory <= 2;
}

/**
 * Determine initial DPR based on device capabilities.
 */
export function recommendedDpr(): number {
  const native = Math.min(window.devicePixelRatio || 1, 3);
  if (isLowEndDevice()) return Math.min(native, 1);
  return native;
}

/**
 * Dynamic effect import — loads effect modules on demand.
 * Returns the effect class after loading.
 */
const effectCache = new Map<string, any>();

export async function lazyLoadEffect(type: string): Promise<any> {
  if (effectCache.has(type)) return effectCache.get(type)!;

  try {
    // Vite glob import pattern
    const modules = import.meta.glob('/src/effects/*.ts');
    const path = `/src/effects/${type}.ts`;
    if (modules[path]) {
      const mod = await modules[path]() as any;
      const cls = mod.default || mod[type] || Object.values(mod)[0];
      effectCache.set(type, cls);
      return cls;
    }
  } catch (err) {
    console.warn(`[lazyLoadEffect] Failed to load "${type}":`, err);
  }
  return null;
}
