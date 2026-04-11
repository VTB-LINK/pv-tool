// Modified by VTB-LIVE on 2026-04-11
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

// Manages WebSocket connection to Metabox Nexus-PlayerCap (NXPC) service
// and provides lyric, song info, and playback state data to the engine.

import type { LyricLine } from '../types/engine';

const DEFAULT_HOST = 'localhost:8765';
const RECONNECT_DELAY = 2000;

/**
 * Build a full WebSocket URL from host and optional player.
 * buildWsUrl("localhost:8765")           → "ws://localhost:8765/ws"
 * buildWsUrl("localhost:8765", "wesing") → "ws://localhost:8765/wesing/ws"
 */
export function buildWsUrl(host: string, player?: string): string {
  const h = host || DEFAULT_HOST;
  if (player) return `ws://${h}/${player}/ws`;
  return `ws://${h}/ws`;
}

/**
 * Fetch the list of supported players from the NXPC service-status endpoint.
 * Returns an empty array on failure or timeout.
 */
export async function fetchPlayerSupport(host: string): Promise<string[]> {
  const h = host || DEFAULT_HOST;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`http://${h}/service-status`, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const json = await resp.json();
    const players = json?.data?.player_support;
    if (Array.isArray(players)) return players;
    return [];
  } catch {
    return [];
  }
}

export interface NxpcCallbacks {
  onSongInfo: (name: string, singer: string, title: string) => void;
  onLyric: (text: string, playTime: number) => void;
  onLyricClear: () => void;
  onAllLyrics: (lines: LyricLine[], duration: number) => void;
  onPauseState: (isPaused: boolean) => void;
  onIdle: () => void;
  onStatus: (status: string) => void;
  /** Called once when the connection drops unexpectedly after having been established. */
  onDisconnect?: () => void;
}

export class NxpcProvider {
  private ws: WebSocket | null = null;
  private callbacks: NxpcCallbacks;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _active = false;
  private _host: string;
  private _player: string;
  /** True after at least one successful ws.onopen, reset to false after disconnect fires. */
  private _connectedOnce = false;

  constructor(callbacks: NxpcCallbacks, host?: string, player?: string) {
    this.callbacks = callbacks;
    this._host = host || DEFAULT_HOST;
    this._player = player || '';
  }

  get host(): string { return this._host; }

  set host(h: string) {
    this._host = h || DEFAULT_HOST;
    if (this._active) {
      this.disconnect();
      this.connect();
    }
  }

  get player(): string { return this._player; }

  set player(p: string) {
    this._player = p || '';
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

    const wsUrl = buildWsUrl(this._host, this._player);
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      console.warn('[NXPC] WebSocket creation failed:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._connectedOnce = true;
      console.log('[NXPC] WebSocket connected to', wsUrl);
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        this.handleMessage(msg);
      } catch (err) {
        console.warn('[NXPC] Failed to parse message:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('[NXPC] WebSocket error:', err);
    };

    this.ws.onclose = () => {
      console.warn('[NXPC] WebSocket closed');
      this.ws = null;
      if (this._connectedOnce) {
        this._connectedOnce = false;
        this.callbacks.onDisconnect?.();
      }
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

      case 'player_switch':
        // Active player changed — clear stale lyrics so they don't linger.
        this.callbacks.onLyricClear();
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

/** Test whether the NXPC service is reachable by attempting a WebSocket connection. */
export function testNxpcConnection(host?: string): Promise<boolean> {
  const wsUrl = buildWsUrl(host || DEFAULT_HOST);
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(wsUrl);
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
