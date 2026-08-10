// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

// Manages WebSocket connection to Metabox Nexus-PlayerCap (NXPC) service
// and provides lyric, song info, and playback state data to the engine.
//
// Wire contract: PlayerCap 3.0. Three time quantities travel together and must not
// be confused:
//   timestamp — the line's own time on the lyric timeline, offset not applied
//   play_time — when that line goes on screen (timestamp - offset); 0 when index is -1
//   position  — whole-song playback position in seconds, carried by lyric_update,
//               all_lyrics, playback_pause and playback_resume
// The engine clock is a whole-song position, so it is anchored on `position`; lyric
// line times come from `play_time`, which is on that same clock.

import type { LyricLine } from '../types/engine';

const DEFAULT_HOST = 'localhost:8765';
const RECONNECT_DELAY = 2000;

/** Coerce a wire value to a finite number, falling back when the field is absent. */
function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Same as numberOr, but reports absence instead of substituting a value. */
function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

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

/** Payload of one `lyric_update` push. */
export interface NxpcLyric {
  /** Line index. `-1` means the platform returned no usable lyrics for this song. */
  index: number;
  /**
   * Main lyric text. When index is -1 this may still hold a platform placeholder
   * such as "纯音乐，请欣赏" — decide by index, never by text.
   */
  text: string;
  /** Whole-song playback position in seconds. */
  position: number;
}

export interface NxpcCallbacks {
  onSongInfo: (name: string, singer: string, title: string) => void;
  onLyric: (lyric: NxpcLyric) => void;
  onLyricClear: () => void;
  onAllLyrics: (lines: LyricLine[], duration: number, position: number) => void;
  /** `position` is the whole-song position carried by the event, or null when absent. */
  onPauseState: (isPaused: boolean, position: number | null) => void;
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
  /** True after the v2-payload warning has been emitted, so it is logged only once. */
  private _legacyWarned = false;

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
          this.warnLegacyFields(data.position === undefined);
          this.callbacks.onLyric({
            index: numberOr(data.index, 0),
            text: data.text ?? '',
            position: numberOr(data.position, 0),
          });
        } else {
          this.callbacks.onLyricClear();
        }
        break;

      case 'all_lyrics':
        if (data && Array.isArray(data.lyrics)) {
          this.warnLegacyFields(data.lyrics.length > 0 && data.lyrics[0].timestamp === undefined);
          const lines: LyricLine[] = data.lyrics.map((item: any) => ({
            // play_time is the on-screen time on the same clock as `position`;
            // `timestamp` is the raw line time with no offset applied.
            time: numberOr(item.play_time, numberOr(item.timestamp, 0)),
            text: item.text ?? '',
          }));
          this.callbacks.onAllLyrics(lines, numberOr(data.duration, 0), numberOr(data.position, 0));
        }
        break;

      case 'playback_pause':
        this.callbacks.onPauseState(true, numberOrNull(data?.position));
        break;

      case 'playback_resume':
        this.callbacks.onPauseState(false, numberOrNull(data?.position));
        break;

      case 'lyric_idle':
        this.callbacks.onIdle();
        break;

      case 'player_switch':
      case 'player_clear':
        // Active player changed or was cleared — drop stale lyrics so they don't linger.
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

  /**
   * Warn once when a payload lacks its PlayerCap 3.0 fields, which means the service is
   * still on the v2 contract. Without this the missing fields would read as undefined and
   * degrade to zero, leaving every lyric time and the playback position silently wrong.
   */
  private warnLegacyFields(missing: boolean): void {
    if (!missing || this._legacyWarned) return;
    this._legacyWarned = true;
    console.warn('[NXPC] Payload is missing PlayerCap 3.0 fields (position / timestamp); '
      + 'the service looks like v2. Lyric times and playback position will be wrong.');
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
