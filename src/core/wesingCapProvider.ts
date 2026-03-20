// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

// Manages WebSocket connection to Metabox Nexus WesingCap service
// and provides lyric, song info, and playback state data to the engine.

import type { LyricLine } from './types';

const DEFAULT_WS_URL = 'ws://localhost:8765/ws';
const RECONNECT_DELAY = 2000;

export interface WesingCapCallbacks {
  onSongInfo: (name: string, singer: string, title: string) => void;
  onLyric: (text: string, playTime: number) => void;
  onLyricClear: () => void;
  onAllLyrics: (lines: LyricLine[], duration: number) => void;
  onPauseState: (isPaused: boolean) => void;
  onIdle: () => void;
  onStatus: (status: string) => void;
}

export class WesingCapProvider {
  private ws: WebSocket | null = null;
  private callbacks: WesingCapCallbacks;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _active = false;
  private _wsUrl: string;

  constructor(callbacks: WesingCapCallbacks, wsUrl?: string) {
    this.callbacks = callbacks;
    this._wsUrl = wsUrl || DEFAULT_WS_URL;
  }

  get wsUrl(): string { return this._wsUrl; }

  set wsUrl(url: string) {
    this._wsUrl = url || DEFAULT_WS_URL;
    if (this._active) {
      this.disconnect();
      this.connect();
    }
  }

  connect(): void {
    if (this._active) return;
    this._active = true;
    this.doConnect();
  }

  disconnect(): void {
    this._active = false;
    this.clearReconnect();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  get active(): boolean {
    return this._active;
  }

  private doConnect(): void {
    if (!this._active) return;

    try {
      this.ws = new WebSocket(this._wsUrl);
    } catch (err) {
      console.warn('[WesingCap] WebSocket creation failed:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[WesingCap] WebSocket connected to', this._wsUrl);
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        this.handleMessage(msg);
      } catch (err) {
        console.warn('[WesingCap] Failed to parse message:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('[WesingCap] WebSocket error:', err);
    };

    this.ws.onclose = () => {
      console.warn('[WesingCap] WebSocket closed');
      this.ws = null;
      this.scheduleReconnect();
    };
  }

  private handleMessage(msg: { type: string; data: any }): void {
    const { type, data } = msg;

    switch (type) {
      case 'song_info_update':
        if (data && (data.name || data.singer || data.title)) {
          this.callbacks.onSongInfo(
            data.name ?? '',
            data.singer ?? '',
            data.title ?? '',
          );
        }
        break;

      case 'lyric_update':
        if (data && data.text !== undefined) {
          this.callbacks.onLyric(
            data.text ?? '',
            data.play_time ?? 0,
          );
        } else {
          // Empty data ({}) means lyric cleared
          this.callbacks.onLyricClear();
        }
        break;

      case 'all_lyrics':
        if (data && data.lyrics && Array.isArray(data.lyrics)) {
          const lines: LyricLine[] = data.lyrics.map((item: any) => ({
            time: item.time ?? 0,
            text: item.text ?? '',
          }));
          this.callbacks.onAllLyrics(lines, data.duration ?? 0);
        }
        break;

      case 'playback_pause':
        this.callbacks.onPauseState(true);
        break;

      case 'playback_resume':
        this.callbacks.onPauseState(false);
        break;

      case 'lyric_idle':
        this.callbacks.onIdle();
        break;

      case 'status_update':
        if (data && data.status) {
          this.callbacks.onStatus(data.status);
        }
        break;

      default:
        break;
    }
  }

  private scheduleReconnect(): void {
    if (!this._active) return;
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, RECONNECT_DELAY);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  destroy(): void {
    this.disconnect();
  }
}

/** Test whether the WesingCap service is reachable by attempting a WebSocket connection. */
export function testWesingCapConnection(wsUrl?: string): Promise<boolean> {
  const url = wsUrl || DEFAULT_WS_URL;
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);
      ws.onopen = () => {
        clearTimeout(timer);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        ws.close();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}
