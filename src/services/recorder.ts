// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

/**
 * Canvas recorder — captures the PixiJS canvas as WebM video
 * using MediaRecorder API with captureStream().
 */

export interface RecorderOptions {
  /** Target frame rate (default: 30) */
  fps?: number;
  /** Video bitrate in bps (default: 5Mbps) */
  videoBitsPerSecond?: number;
  /** MIME type (default: auto-detected) */
  mimeType?: string;
}

export type RecorderState = 'idle' | 'recording' | 'encoding';

const PREFERRED_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
];

function detectMimeType(): string {
  for (const t of PREFERRED_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export class CanvasRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private _state: RecorderState = 'idle';
  private _elapsed = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  onStateChange?: (state: RecorderState) => void;
  onElapsedChange?: (ms: number) => void;
  onComplete?: (blob: Blob, duration: number) => void;

  get state() { return this._state; }
  get elapsed() { return this._elapsed; }

  /**
   * Start recording a canvas element.
   */
  start(canvas: HTMLCanvasElement, options: RecorderOptions = {}): boolean {
    if (this._state !== 'idle') return false;

    const fps = options.fps ?? 30;
    const stream = canvas.captureStream(fps);
    const mimeType = options.mimeType || detectMimeType();

    if (!mimeType) {
      console.error('[Recorder] No supported MIME type found');
      return false;
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: options.videoBitsPerSecond ?? 5_000_000,
      });
    } catch (err) {
      console.error('[Recorder] Failed to create MediaRecorder:', err);
      return false;
    }

    this.chunks = [];
    this.startTime = Date.now();
    this._elapsed = 0;

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      this.setState('encoding');
      const blob = new Blob(this.chunks, { type: mimeType });
      const duration = this._elapsed;
      this.chunks = [];
      this.setState('idle');
      this.onComplete?.(blob, duration);
    };

    this.mediaRecorder.start(100); // collect data every 100ms
    this.setState('recording');

    // Tick timer for elapsed
    this.tickTimer = setInterval(() => {
      this._elapsed = Date.now() - this.startTime;
      this.onElapsedChange?.(this._elapsed);
    }, 250);

    return true;
  }

  /**
   * Stop recording and produce the video blob.
   */
  stop(): void {
    if (this._state !== 'recording' || !this.mediaRecorder) return;

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this._elapsed = Date.now() - this.startTime;

    this.mediaRecorder.stop();
  }

  /**
   * Download the blob as a file.
   */
  static download(blob: Blob, filename = 'pv-recording.webm'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  private setState(state: RecorderState): void {
    this._state = state;
    this.onStateChange?.(state);
  }

  destroy(): void {
    this.stop();
    this.mediaRecorder = null;
  }
}
