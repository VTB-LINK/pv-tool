// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

// PV Tool — Reactive engine store (Svelte 5 runes)
// Bridges the PixiJS engine with Svelte's reactivity system

import { PVEngine } from '../engine/PVEngine';
import { templates } from '../templates';
import type { TemplateConfig } from '../types/engine';
import { effectCatalog } from '../engine/effectCatalog';
import { CanvasRecorder } from '../services/recorder';
import { parseLrc } from '../engine/lrc';
import { parseSrt } from '../engine/srtParser';
import { parseAss } from '../engine/assParser';
import { extractEmbeddedLyrics } from '../engine/embeddedLyrics';
import {
  loadCustomTemplates,
  saveCustomTemplates,
  encodeShareCode,
  decodeShareCode,
} from '../services/templateStore';

// ── Singleton engine instance ──
let _engine: PVEngine | null = null;

// ── Reactive state ──
let _ready = $state(false);
let _currentTemplateIndex = $state(0);
let _isCustomMode = $state(false);
let _customEffects = $state<boolean[]>(new Array(effectCatalog.length).fill(false));
let _customTemplates = $state<TemplateConfig[]>(loadCustomTemplates());

let _text = $state('深夜東京/の6畳半夢/を見てた/灯りの灯らない蛍光灯/明日には消えてる電脳城/に/開幕戦/打ち上げて/いなくなんないよね/ここには誰もいない/ここには誰もいないから');
let _segmentDuration = $state(3.0);
let _animationSpeed = $state(2.0);
let _motionIntensity = $state(1.0);
let _effectOpacity = $state(1.0);
let _bpm = $state(120);
let _beatReactivity = $state(0.5);

// Post FX
let _shake = $state(0);
let _zoom = $state(0);
let _tilt = $state(0);
let _glitch = $state(0);
let _hueShift = $state(0);
let _postFxLocked = $state(false);

// Media
let _mediaLoaded = $state(false);
let _mediaFileName = $state('');
let _mediaMode = $state<'fit' | 'free'>('fit');
let _mediaOffsetX = $state(0);
let _mediaOffsetY = $state(0);
let _mediaScale = $state(1.0);

// Audio
let _audioLoaded = $state(false);
let _audioFileName = $state('');
let _audioPaused = $state(false);

// Lyrics
let _lyricsLoaded = $state(false);
let _lyricsFileName = $state('');

// Embedded lyrics
let _embeddedLyricsRaw = $state<string | null>(null);
let _embeddedLyricsSource = $state<'none' | 'embedded' | 'file'>('none');

// External file lyrics storage (persists across source switches)
let _fileLyricsText = $state<string | null>(null);
let _fileLyricsFileName = $state('');
let _fileLyricsExt = $state('');

// Canvas color
let _canvasColor = $state<string | null>(null);

// Alpha/export
let _alphaMode = $state(false);

// Recording
let _isRecording = $state(false);
let _recordingTime = $state(0);
let _recorder: CanvasRecorder | null = null;

// Toast
let _toastMessage = $state('');
let _toastVisible = $state(false);
let _toastTimer: ReturnType<typeof setTimeout> | null = null;

// ── Exports ──

export function getEngine(): PVEngine {
  if (!_engine) throw new Error('Engine not initialized');
  return _engine;
}

export async function initEngine(container: HTMLElement) {
  _engine = new PVEngine();
  await _engine.init(container);
  _engine.setText(_text);
  _engine.loadTemplate(cloneTemplate(templates[0]));
  _ready = true;
  syncFromEngine();
}

function syncFromEngine() {
  if (!_engine) return;
  _animationSpeed = _engine.animationSpeed;
  _effectOpacity = _engine.effectOpacity;
  if (_postFxLocked) {
    // Re-apply saved post FX values to the engine
    _engine.shake = _shake;
    _engine.zoom = _zoom;
    _engine.tilt = _tilt;
    _engine.glitch = _glitch;
    _engine.hueShift = _hueShift;
  } else {
    _shake = _engine.shake;
    _zoom = _engine.zoom;
    _tilt = _engine.tilt;
    _glitch = _engine.glitch;
    _hueShift = _engine.hueShift;
  }
}

// ── Template actions ──

/** Deep-clone a template so the engine can mutate its copy without affecting the original. */
function cloneTemplate(tpl: TemplateConfig): TemplateConfig {
  return {
    ...tpl,
    palette: { ...tpl.palette },
    effects: tpl.effects.map(e => ({ ...e, config: { ...e.config } })),
    postfx: tpl.postfx ? { ...tpl.postfx } : undefined,
    features: tpl.features ? { ...tpl.features } : undefined,
  };
}

export function selectTemplate(index: number) {
  if (!_engine) return;
  _currentTemplateIndex = index;
  _isCustomMode = false;
  _engine.loadTemplate(cloneTemplate(templates[index]));
  syncFromEngine();
}

/** Re-load the current template from its original definition, resetting all editor changes. */
export function reloadCurrentTemplate() {
  if (!_engine) return;
  if (_isCustomMode) return;
  if (_currentTemplateIndex >= 0 && _currentTemplateIndex < templates.length) {
    _engine.loadTemplate(cloneTemplate(templates[_currentTemplateIndex]));
  } else {
    return;
  }
  syncFromEngine();
}

export function selectCustomTemplate(index: number) {
  if (!_engine) return;
  _currentTemplateIndex = -1;
  _isCustomMode = false;
  _engine.loadTemplate(cloneTemplate(_customTemplates[index]));
  syncFromEngine();
}

export function enterCustomMode() {
  _isCustomMode = true;
  _currentTemplateIndex = -1;
  applyCustomTemplate();
}

function buildCustomTemplate(): TemplateConfig {
  const effects: TemplateConfig['effects'] = [];
  _customEffects.forEach((checked, i) => {
    if (checked) {
      const preset = effectCatalog[i];
      effects.push({ type: preset.type, layer: preset.layer, config: { ...preset.config } });
    }
  });
  return {
    name: 'Custom',
    palette: {
      background: '#ffffff',
      primary: '#000000',
      secondary: '#888888',
      accent: '#ff3366',
      text: '#000000',
    },
    effects,
  };
}

function applyCustomTemplate() {
  if (!_engine || !_isCustomMode) return;
  try {
    _engine.loadTemplate(buildCustomTemplate());
  } catch (err) {
    console.warn('[PV] Custom template build failed:', err);
  }
}

export function toggleCustomEffect(index: number, checked: boolean) {
  _customEffects[index] = checked;
  applyCustomTemplate();
}

export function saveCurrentAsTemplate(name: string) {
  if (!name.trim() || !_engine) return;
  // Snapshot the current engine state (effects + palette) directly
  const effects = (_engine.currentEffects ?? []).map((e: any) => ({
    type: e.type,
    layer: e.layer,
    config: { ...e.config },
  }));
  const palette = _engine.currentPalette
    ? { ..._engine.currentPalette }
    : { background: '#000', primary: '#fff', secondary: '#888', accent: '#f36', text: '#fff' };
  const tpl = { name: name.trim(), palette, effects };
  _customTemplates = [..._customTemplates, tpl];
  saveCustomTemplates(_customTemplates);
  // Don't call loadTemplate — current state is already correct
}

export function deleteCustomTemplate(index: number) {
  _customTemplates = _customTemplates.filter((_, i) => i !== index);
  saveCustomTemplates(_customTemplates);
  selectTemplate(0);
}

export async function exportShareCode(index: number): Promise<string> {
  return encodeShareCode(_customTemplates[index]);
}

export async function importShareCode(code: string) {
  const tpl = await decodeShareCode(code);
  _customTemplates = [..._customTemplates, tpl];
  saveCustomTemplates(_customTemplates);
  if (_engine) _engine.loadTemplate(cloneTemplate(tpl));
  _isCustomMode = false;
  syncFromEngine();
}

// ── Parameter setters ──

export function setText(text: string) {
  _text = text;
  _engine?.setText(text.replace(/\r?\n/g, '/'));
}

export function setSegmentDuration(v: number) {
  _segmentDuration = v;
  if (_engine) _engine.segmentDuration = v;
}

export function setAnimationSpeed(v: number) {
  _animationSpeed = v;
  if (_engine) _engine.animationSpeed = v;
}

export function setMotionIntensity(v: number) {
  _motionIntensity = v;
  if (_engine) _engine.motionIntensity = v;
}

export function setEffectOpacity(v: number) {
  _effectOpacity = v;
  if (_engine) _engine.effectOpacity = v;
}

export function setBpm(v: number) {
  _bpm = v;
  if (_engine) _engine.beat.bpm = v;
}

export function setBeatReactivity(v: number) {
  _beatReactivity = v;
  if (_engine) _engine.beatReactivity = v;
}

export function setShake(v: number) { _shake = v; if (_engine) _engine.shake = v; }
export function setZoom(v: number) { _zoom = v; if (_engine) _engine.zoom = v; }
export function setTilt(v: number) { _tilt = v; if (_engine) _engine.tilt = v; }
export function setGlitch(v: number) { _glitch = v; if (_engine) _engine.glitch = v; }
export function setHueShift(v: number) { _hueShift = v; if (_engine) _engine.hueShift = v; }

export function setCanvasColor(color: string | null) {
  _canvasColor = color;
  if (_engine) _engine.canvasColor = color;
}

export function setAlphaMode(val: boolean) {
  _alphaMode = val;
  if (_engine) _engine.alphaMode = val;
  // OBS browser source requires the page itself to be transparent
  if (val) {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
  } else {
    document.body.style.background = '';
    document.documentElement.style.background = '';
  }
}

// ── Media ──

export async function loadMedia(file: File, mode: 'fit' | 'free' = 'fit') {
  if (!_engine) return;
  _mediaMode = mode;
  await _engine.addMedia(file, mode);
  _mediaLoaded = true;
  _mediaFileName = file.name;
  _effectOpacity = 0.7;
  _engine.effectOpacity = 0.7;
  _mediaOffsetX = 0;
  _mediaOffsetY = 0;
  _mediaScale = 1.0;
}

export function clearMedia() {
  if (!_engine) return;
  _engine.removeMedia();
  _mediaLoaded = false;
  _mediaFileName = '';
  _effectOpacity = 1.0;
  _engine.effectOpacity = 1.0;
  _mediaOffsetX = 0;
  _mediaOffsetY = 0;
  _mediaScale = 1.0;
}

export function setMediaOffset(x: number, y: number) {
  _mediaOffsetX = x;
  _mediaOffsetY = y;
  _engine?.setMediaOffset(x, y);
}

export function setMediaScale(s: number) {
  _mediaScale = s;
  _engine?.setMediaScale(s);
}

// ── Audio ──

export async function loadAudio(file: File) {
  if (!_engine) return;
  await _engine.beat.loadAudio(file);
  _audioLoaded = true;
  _audioFileName = file.name;
  _audioPaused = false;

  // Try extracting embedded lyrics
  try {
    const raw = await extractEmbeddedLyrics(file);
    _embeddedLyricsRaw = raw;
    // Auto-apply embedded lyrics only if no external lyrics file is loaded
    if (raw && !_lyricsLoaded) {
      applyEmbeddedLyrics(raw);
      _embeddedLyricsSource = 'embedded';
    }
  } catch {
    _embeddedLyricsRaw = null;
  }
}

export function clearAudio() {
  if (!_engine) return;
  _engine.beat.dispose();
  _audioLoaded = false;
  _audioFileName = '';
  _audioPaused = false;
  _embeddedLyricsRaw = null;
  // If lyrics came from embedded, clear them too
  if (_embeddedLyricsSource === 'embedded') {
    _engine.clearLyricTimeline();
    _engine.setSrtTimeline(null);
    _lyricsLoaded = false;
    _lyricsFileName = '';
    _embeddedLyricsSource = 'none';
  }
}

export function toggleAudio() {
  if (!_engine) return;
  if (_engine.beat.paused) {
    _engine.beat.resume();
    _audioPaused = false;
  } else {
    _engine.beat.pause();
    _audioPaused = true;
  }
}

// ── Lyrics ──

function applyEmbeddedLyrics(raw: string) {
  if (!_engine) return;
  // Try parsing as LRC first (timestamped)
  const lrcLines = parseLrc(raw);
  if (lrcLines.length > 0) {
    _engine.setSrtTimeline(null);
    _engine.setLyricTimeline(lrcLines);
    _lyricsLoaded = true;
    _lyricsFileName = '(embedded)';
    return;
  }
  // Fallback: treat as plain text segments (one line = one segment)
  const plainLines = raw.split(/\r?\n/).filter(l => l.trim());
  if (plainLines.length > 0) {
    _engine.setText(plainLines.join('/'));
    _lyricsLoaded = true;
    _lyricsFileName = '(embedded)';
  }
}

/** Apply external file lyrics to the engine. */
function applyFileLyrics(text: string, ext: string) {
  if (!_engine) return;
  if (ext === 'lrc') {
    const lines = parseLrc(text);
    if (lines.length > 0) {
      _engine.setSrtTimeline(null);
      _engine.setLyricTimeline(lines);
    }
  } else if (ext === 'srt') {
    const entries = parseSrt(text);
    if (entries.length > 0) {
      _engine.clearLyricTimeline();
      _engine.setSrtTimeline(entries);
    }
  } else if (ext === 'ass' || ext === 'ssa') {
    const entries = parseAss(text);
    if (entries.length > 0) {
      _engine.clearLyricTimeline();
      _engine.setSrtTimeline(entries);
    }
  }
}

export function selectLyricsSource(source: 'embedded' | 'file') {
  if (!_engine) return;
  _embeddedLyricsSource = source;
  if (source === 'embedded' && _embeddedLyricsRaw) {
    applyEmbeddedLyrics(_embeddedLyricsRaw);
  } else if (source === 'file' && _fileLyricsText) {
    applyFileLyrics(_fileLyricsText, _fileLyricsExt);
    _lyricsLoaded = true;
    _lyricsFileName = _fileLyricsFileName;
  }
}

export function clearLyrics() {
  if (!_engine) return;
  _engine.clearLyricTimeline();
  _engine.setSrtTimeline(null);

  // Clear stored file lyrics
  _fileLyricsText = null;
  _fileLyricsFileName = '';
  _fileLyricsExt = '';

  // If embedded lyrics exist, revert to them instead of clearing completely
  if (_embeddedLyricsRaw) {
    applyEmbeddedLyrics(_embeddedLyricsRaw);
    _embeddedLyricsSource = 'embedded';
  } else {
    _lyricsLoaded = false;
    _lyricsFileName = '';
    _embeddedLyricsSource = 'none';
  }
}

export async function loadLyrics(file: File) {
  if (!_engine) return;
  const text = await file.text();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  // Store for later source switching
  _fileLyricsText = text;
  _fileLyricsFileName = file.name;
  _fileLyricsExt = ext;

  applyFileLyrics(text, ext);

  _lyricsLoaded = true;
  _lyricsFileName = file.name;
  _embeddedLyricsSource = 'file';
}

// ── Recording ──

export function getCanvas(): HTMLCanvasElement | null {
  return _engine?.canvas ?? null;
}

export function startRecording(): boolean {
  const canvas = getCanvas();
  if (!canvas || _isRecording) return false;

  _recorder = new CanvasRecorder();
  _recorder.onStateChange = (state) => {
    _isRecording = state === 'recording';
  };
  _recorder.onElapsedChange = (ms) => {
    _recordingTime = ms;
  };
  _recorder.onComplete = (blob, duration) => {
    const secs = Math.round(duration / 1000);
    const filename = `pv-recording-${secs}s.webm`;
    CanvasRecorder.download(blob, filename);
    showToast(`🎬 ${filename}`);
    _isRecording = false;
    _recordingTime = 0;
  };

  const ok = _recorder.start(canvas);
  if (!ok) {
    showToast('❌ Recording not supported');
    return false;
  }
  return true;
}

export function stopRecording(): void {
  if (_recorder) {
    _recorder.stop();
    _recorder = null;
  }
}

export function toggleRecording(): void {
  if (_isRecording) stopRecording();
  else startRecording();
}

// ── Post FX Reset ──

export function resetPostFx(): void {
  setShake(0); setZoom(0); setTilt(0);
  setGlitch(0); setHueShift(0);
}

export function setPostFxLocked(v: boolean): void {
  _postFxLocked = v;
}

// ── Toast ──

export function showToast(message: string, duration = 2000) {
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastMessage = message;
  _toastVisible = true;
  _toastTimer = setTimeout(() => {
    _toastVisible = false;
    _toastTimer = null;
  }, duration);
}

// ── Read-only reactive getters (exported as $state) ──

export const engine = {
  get ready() { return _ready; },
  get currentTemplateIndex() { return _currentTemplateIndex; },
  get isCustomMode() { return _isCustomMode; },
  get customEffects() { return _customEffects; },
  get customTemplates() { return _customTemplates; },
  get text() { return _text; },
  get segmentDuration() { return _segmentDuration; },
  get animationSpeed() { return _animationSpeed; },
  get motionIntensity() { return _motionIntensity; },
  get effectOpacity() { return _effectOpacity; },
  get bpm() { return _bpm; },
  get beatReactivity() { return _beatReactivity; },
  get shake() { return _shake; },
  get zoom() { return _zoom; },
  get tilt() { return _tilt; },
  get glitch() { return _glitch; },
  get hueShift() { return _hueShift; },
  get postFxLocked() { return _postFxLocked; },
  get mediaLoaded() { return _mediaLoaded; },
  get mediaFileName() { return _mediaFileName; },
  get mediaMode() { return _mediaMode; },
  get mediaOffsetX() { return _mediaOffsetX; },
  get mediaOffsetY() { return _mediaOffsetY; },
  get mediaScale() { return _mediaScale; },
  get audioLoaded() { return _audioLoaded; },
  get audioFileName() { return _audioFileName; },
  get audioPaused() { return _audioPaused; },
  get lyricsLoaded() { return _lyricsLoaded; },
  get lyricsFileName() { return _lyricsFileName; },
  get embeddedLyricsRaw() { return _embeddedLyricsRaw; },
  get embeddedLyricsSource() { return _embeddedLyricsSource; },
  get hasFileLyrics() { return _fileLyricsText !== null; },
  get canvasColor() { return _canvasColor; },
  get alphaMode() { return _alphaMode; },
  get isRecording() { return _isRecording; },
  get recordingTime() { return _recordingTime; },
  get toastMessage() { return _toastMessage; },
  get toastVisible() { return _toastVisible; },
  get allTemplates() { return templates; },
  get instance() { return _engine; },
};
