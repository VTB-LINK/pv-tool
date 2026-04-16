// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

// PV Tool — Reactive engine store (Svelte 5 runes)
// Bridges the PixiJS engine with Svelte's reactivity system

import { PVEngine } from '../engine/PVEngine';
import { templates } from '../templates';
import type { TemplateConfig } from '../types/engine';
import { compactEffectEntries, effectCatalog, normalizeEffectEntries } from '../engine/effectCatalog';
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
import { checkFontAvailable, parsePrimaryFont } from '../services/fontService';

// ── Singleton engine instance ──
let _engine: PVEngine | null = null;

// ── Reactive state ──
let _ready = $state(false);
let _currentTemplateIndex = $state(0);
let _isCustomMode = $state(false);
let _customEffects = $state<boolean[]>(new Array(effectCatalog.length).fill(false));
let _customTemplates = $state<TemplateConfig[]>(loadCustomTemplates());
let _customDirty = $state(false);

// Track which custom template is currently loaded (-1 = none)
let _loadedCustomIndex = $state(-1);

// Track the base template for origin detection
let _baseTemplateName = $state<string | null>(null);
let _baseTemplateEffects = $state<import('../types/engine').EffectEntry[]>([]);
let _baseTemplatePalette = $state<import('../types/engine').ColorPalette | null>(null);

// Track the exact template snapshot that is currently loaded for full reset.
let _loadedTemplateSnapshot = $state<TemplateConfig | null>(null);
let _resetBaselineSnapshot = $state<TemplateConfig | null>(null);
let _resetBaselineVersion = $state(0);

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
let _fontLocked = $state(true);

// Template features
let _mediaOutline = $state(false);
let _autoExtractColors = $state(false);
let _motionDetection = $state(false);
let _invertMedia = $state(false);
let _thresholdMedia = $state(false);

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
let _audioVolume = $state(0.5);

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

// Font family override
let _fontFamily = $state<string | null>(null);

// Pending font warning (for font-missing dialog)
let _pendingFontWarning = $state<{ font: string; source: 'sharecode' | 'url' | 'template' } | null>(null);

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
  const tpl0 = templates[0];
  _baseTemplateName = tpl0.nameKey ?? tpl0.name;
  _baseTemplateEffects = normalizeEffectEntries(tpl0.effects);
  _baseTemplatePalette = tpl0.palette ? { ...tpl0.palette } : null;
  _engine.loadTemplate(cloneTemplate(tpl0));
  setLoadedTemplateSnapshot(tpl0);
  _ready = true;
  syncFromEngine();
}

function syncFromEngine() {
  if (!_engine) return;
  _segmentDuration = _engine.segmentDuration;
  _bpm = _engine.beat.bpm;
  _beatReactivity = _engine.beatReactivity;
  _animationSpeed = _engine.animationSpeed;
  _motionIntensity = _engine.motionIntensity;
  _effectOpacity = _engine.effectOpacity;
  if (_fontLocked) {
    _engine.fontFamily = _fontFamily;
  } else {
    _fontFamily = _engine.fontFamily;
  }
  _mediaOutline = _engine.mediaOutlineEnabled;
  _autoExtractColors = _engine.autoExtractColorsEnabled;
  _motionDetection = _engine.motionDetectionEnabled;
  _invertMedia = _engine.invertMediaEnabled;
  _thresholdMedia = _engine.thresholdMediaEnabled;
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

function resolveBuiltinTemplateByBaseName(baseName: string | undefined): TemplateConfig | null {
  if (!baseName) return null;
  const hit = templates.find(t => (t.nameKey ?? t.name) === baseName || t.name === baseName);
  return hit ?? null;
}

function applyBaseReference(tpl: TemplateConfig) {
  // From-scratch custom templates intentionally have no base reference.
  if (!tpl.baseTemplateName) {
    _baseTemplateName = null;
    _baseTemplateEffects = [];
    _baseTemplatePalette = null;
    return;
  }

  const builtin = resolveBuiltinTemplateByBaseName(tpl.baseTemplateName);
  if (builtin) {
    _baseTemplateName = builtin.nameKey ?? builtin.name;
    _baseTemplateEffects = normalizeEffectEntries(builtin.effects);
    _baseTemplatePalette = builtin.palette ? { ...builtin.palette } : null;
    return;
  }

  // Fallback for non-builtin base names.
  _baseTemplateName = tpl.baseTemplateName;
  _baseTemplateEffects = normalizeEffectEntries(tpl.effects);
  _baseTemplatePalette = tpl.palette ? { ...tpl.palette } : null;
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

function serializeTemplateForDirtyCheck(tpl: TemplateConfig | null): string {
  if (!tpl) return '';
  const effects = normalizeEffectEntries(tpl.effects);
  return JSON.stringify({
    palette: tpl.palette,
    effects: effects.map(effect => ({ type: effect.type, layer: effect.layer, config: effect.config, visible: effect.visible !== false })),
    segmentDuration: tpl.segmentDuration,
    bpm: tpl.bpm,
    beatReactivity: tpl.beatReactivity,
    animationSpeed: tpl.animationSpeed,
    motionIntensity: tpl.motionIntensity,
    bgOpacity: tpl.bgOpacity,
    fontFamily: tpl.fontFamily,
    postfx: {
      shake: tpl.postfx?.shake ?? 0,
      zoom: tpl.postfx?.zoom ?? 0,
      tilt: tpl.postfx?.tilt ?? 0,
      glitch: tpl.postfx?.glitch ?? 0,
      hueShift: tpl.postfx?.hueShift ?? 0,
    },
    features: {
      mediaOutline: tpl.features?.mediaOutline ?? false,
      autoExtractColors: tpl.features?.autoExtractColors ?? false,
      motionDetection: tpl.features?.motionDetection ?? false,
      invertMedia: tpl.features?.invertMedia ?? false,
      thresholdMedia: tpl.features?.thresholdMedia ?? false,
    },
  });
}

function computeTemplateDirtyState(): boolean {
  if (!_resetBaselineSnapshot) return _customDirty;
  const current = getCurrentTemplateConfig();
  if (!current) return _customDirty;
  return serializeTemplateForDirtyCheck(current) !== serializeTemplateForDirtyCheck(_resetBaselineSnapshot);
}

function buildLoadedTemplateSnapshot(tpl: TemplateConfig | null): TemplateConfig | null {
  if (!tpl) return null;
  if (!_engine) {
    return {
      ...cloneTemplate(tpl),
      effects: normalizeEffectEntries(tpl.effects),
    };
  }

  return {
    ...tpl,
    palette: _engine.currentPalette
      ? { ..._engine.currentPalette }
      : { ...tpl.palette },
    effects: (_engine.currentEffects ?? tpl.effects).map(e => ({
      type: e.type,
      layer: e.layer,
      config: { ...e.config },
      visible: e.visible !== false,
    })),
    segmentDuration: _engine.segmentDuration,
    bpm: _engine.beat.bpm,
    beatReactivity: _engine.beatReactivity,
    animationSpeed: _engine.animationSpeed,
    motionIntensity: _engine.motionIntensity,
    bgOpacity: _engine.effectOpacity,
    postfx: {
      shake: _engine.shake,
      zoom: _engine.zoom,
      tilt: _engine.tilt,
      glitch: _engine.glitch,
      hueShift: _engine.hueShift,
    },
    features: {
      mediaOutline: _engine.mediaOutlineEnabled,
      autoExtractColors: _engine.autoExtractColorsEnabled,
      motionDetection: _engine.motionDetectionEnabled,
      invertMedia: _engine.invertMediaEnabled,
      thresholdMedia: _engine.thresholdMediaEnabled,
    },
  };
}

function setLoadedTemplateSnapshot(tpl: TemplateConfig | null) {
  const snapshot = buildLoadedTemplateSnapshot(tpl);
  _loadedTemplateSnapshot = snapshot;
  setResetBaselineSnapshot(snapshot);
}

function setResetBaselineSnapshot(tpl: TemplateConfig | null) {
  _resetBaselineSnapshot = tpl ? cloneTemplate(tpl) : null;
  _resetBaselineVersion += 1;
}

export function selectTemplate(index: number) {
  if (!_engine) return;
  _currentTemplateIndex = index;
  _isCustomMode = false;
  _customDirty = false;
  _loadedCustomIndex = -1;
  // Reset canvas color override so new template's palette takes effect
  _canvasColor = null;
  _engine.canvasColor = null;
  _alphaMode = false;
  _engine.alphaMode = false;
  const tpl = templates[index];
  _baseTemplateName = tpl.nameKey ?? tpl.name;
  _baseTemplateEffects = normalizeEffectEntries(tpl.effects);
  _baseTemplatePalette = tpl.palette ? { ...tpl.palette } : null;
  _engine.loadTemplate(cloneTemplate(tpl));
  setLoadedTemplateSnapshot(tpl);
  syncFromEngine();
}

/** Re-load the current template from its original definition, resetting all editor changes. */
export function reloadCurrentTemplate() {
  if (!_engine) return;
  if (_isCustomMode) return;
  if (_loadedTemplateSnapshot) {
    if (_currentTemplateIndex >= 0 && _currentTemplateIndex < templates.length) {
      const tpl = templates[_currentTemplateIndex];
      _baseTemplateName = tpl.nameKey ?? tpl.name;
      _baseTemplateEffects = normalizeEffectEntries(tpl.effects);
      _baseTemplatePalette = tpl.palette ? { ...tpl.palette } : null;
    } else if (_loadedCustomIndex >= 0 && _loadedCustomIndex < _customTemplates.length) {
      applyBaseReference(_customTemplates[_loadedCustomIndex]);
    } else {
      applyBaseReference(_loadedTemplateSnapshot);
    }
    _engine.loadTemplate(cloneTemplate(_loadedTemplateSnapshot));
  } else if (_currentTemplateIndex >= 0 && _currentTemplateIndex < templates.length) {
    const tpl = templates[_currentTemplateIndex];
    _baseTemplateName = tpl.nameKey ?? tpl.name;
    _baseTemplateEffects = normalizeEffectEntries(tpl.effects);
    _baseTemplatePalette = tpl.palette ? { ...tpl.palette } : null;
    _engine.loadTemplate(cloneTemplate(tpl));
    setLoadedTemplateSnapshot(tpl);
  } else if (_loadedCustomIndex >= 0 && _loadedCustomIndex < _customTemplates.length) {
    const tpl = _customTemplates[_loadedCustomIndex];
    applyBaseReference(tpl);
    _engine.loadTemplate(cloneTemplate(tpl));
    setLoadedTemplateSnapshot(tpl);
  } else {
    return;
  }
  syncFromEngine();
}

/** Helper: get the TemplateConfig that was loaded as the base for the current editing session. */
function getBaseTemplateConfig(): TemplateConfig | null {
  if (_currentTemplateIndex >= 0 && _currentTemplateIndex < templates.length) {
    return templates[_currentTemplateIndex];
  }
  if (_loadedCustomIndex >= 0 && _loadedCustomIndex < _customTemplates.length) {
    return _customTemplates[_loadedCustomIndex];
  }
  return null;
}

export function getLoadedBaseTemplateConfig(): TemplateConfig | null {
  const base = getBaseTemplateConfig();
  return base ? cloneTemplate(base) : null;
}

export function getLoadedTemplateConfig(): TemplateConfig | null {
  return _loadedTemplateSnapshot ? cloneTemplate(_loadedTemplateSnapshot) : null;
}

export function getResetBaselineConfig(): TemplateConfig | null {
  return _resetBaselineSnapshot ? cloneTemplate(_resetBaselineSnapshot) : null;
}

export interface EditingSessionSnapshot {
  currentTemplate: TemplateConfig | null;
  loadedTemplate: TemplateConfig | null;
  resetBaseline: TemplateConfig | null;
  currentTemplateIndex: number;
  loadedCustomIndex: number;
  isCustomMode: boolean;
  customDirty: boolean;
}

export function captureEditingSessionSnapshot(): EditingSessionSnapshot {
  return {
    currentTemplate: getCurrentTemplateConfig(),
    loadedTemplate: getLoadedTemplateConfig(),
    resetBaseline: getResetBaselineConfig(),
    currentTemplateIndex: _currentTemplateIndex,
    loadedCustomIndex: _loadedCustomIndex,
    isCustomMode: _isCustomMode,
    customDirty: computeTemplateDirtyState(),
  };
}

export function restoreEditingSessionSnapshot(snapshot: EditingSessionSnapshot | null) {
  if (!_engine || !snapshot?.currentTemplate) return;

  _currentTemplateIndex = snapshot.currentTemplateIndex;
  _loadedCustomIndex = snapshot.loadedCustomIndex;
  _isCustomMode = snapshot.isCustomMode;
  _customDirty = snapshot.customDirty;

  if (_currentTemplateIndex >= 0 && _currentTemplateIndex < templates.length) {
    const builtin = templates[_currentTemplateIndex];
    _baseTemplateName = builtin.nameKey ?? builtin.name;
    _baseTemplateEffects = normalizeEffectEntries(builtin.effects);
    _baseTemplatePalette = builtin.palette ? { ...builtin.palette } : null;
  } else if (_loadedCustomIndex >= 0 && _loadedCustomIndex < _customTemplates.length) {
    applyBaseReference(_customTemplates[_loadedCustomIndex]);
  } else {
    applyBaseReference(snapshot.currentTemplate);
  }

  _engine.loadTemplate(cloneTemplate(snapshot.currentTemplate));
  _loadedTemplateSnapshot = snapshot.loadedTemplate ? cloneTemplate(snapshot.loadedTemplate) : null;
  _resetBaselineSnapshot = snapshot.resetBaseline ? cloneTemplate(snapshot.resetBaseline) : null;
  _resetBaselineVersion += 1;
  syncFromEngine();
}

/** Reset only the palette to the base template, keeping current effects. */
export function resetPalette() {
  if (!_engine) return;
  if (!_resetBaselineSnapshot?.palette) return;
  // Apply base palette key-by-key; updatePalette rebuilds effects internally
  // so just mutate the engine palette and reload to avoid N redundant rebuilds.
  const cur = getCurrentTemplateConfig();
  if (!cur) return;
  _engine.loadTemplate({ ...cur, palette: { ..._resetBaselineSnapshot.palette } });
  syncFromEngine();
}

/** Reset only the effects list to the base template, keeping current palette. */
export function resetEffects() {
  if (!_engine) return;
  if (!_resetBaselineSnapshot) return;
  const cur = getCurrentTemplateConfig();
  if (!cur) return;
  const baseEffects = normalizeEffectEntries(_resetBaselineSnapshot.effects);
  _engine.loadTemplate({ ...cur, effects: baseEffects });
  syncFromEngine();
}

export function setEffectVisible(index: number, visible: boolean) {
  if (!_engine) return;
  _engine.updateEffectVisibility(index, visible);
}

export function selectCustomTemplate(index: number) {
  if (!_engine) return;
  _currentTemplateIndex = -1;
  _isCustomMode = false;
  _customDirty = false;
  _loadedCustomIndex = index;
  const ct = _customTemplates[index];
  applyBaseReference(ct);
  _engine.loadTemplate(cloneTemplate(ct));
  setLoadedTemplateSnapshot(ct);
  syncFromEngine();
}

export function enterCustomMode() {
  _isCustomMode = true;
  _currentTemplateIndex = -1;
  _customDirty = false;
  _loadedCustomIndex = -1;
  _baseTemplateName = null;
  _baseTemplateEffects = [];
  _baseTemplatePalette = null;
  setLoadedTemplateSnapshot(null);
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
    features: {
      mediaOutline: _mediaOutline,
      autoExtractColors: _autoExtractColors,
      motionDetection: _motionDetection,
      invertMedia: _invertMedia,
      thresholdMedia: _thresholdMedia,
    },
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
  _customDirty = true;
  applyCustomTemplate();
}

/** Mark that unsaved changes exist in the current editing session. */
export function markEditorDirty() {
  _customDirty = true;
}

export interface SaveTemplateOptions {
  animation?: boolean;
  postfx?: boolean;
  features?: boolean;
}

function buildCurrentTemplateSnapshot(name: string, options?: SaveTemplateOptions): TemplateConfig | null {
  if (!name.trim() || !_engine) return null;
  const includeAnimation = options?.animation ?? true;
  const includePostfx = options?.postfx ?? true;
  const includeFeatures = options?.features ?? true;

  const effects = compactEffectEntries((_engine.currentEffects ?? []).map((e: any) => ({
    type: e.type,
    layer: e.layer,
    config: { ...e.config },
    visible: e.visible !== false,
  })));
  const palette = _engine.currentPalette
    ? { ..._engine.currentPalette }
    : { background: '#000', primary: '#fff', secondary: '#888', accent: '#f36', text: '#fff' };
  const tpl: TemplateConfig = { name: name.trim(), palette, effects };

  tpl.baseTemplateName = _baseTemplateName ?? undefined;
  tpl.lastModified = Date.now();

  if (includeAnimation) {
    tpl.segmentDuration = _segmentDuration;
    tpl.bpm = _bpm;
    tpl.beatReactivity = _beatReactivity;
    tpl.animationSpeed = _animationSpeed;
    tpl.motionIntensity = _motionIntensity;
    tpl.bgOpacity = _effectOpacity;
  }

  if (_fontFamily) {
    tpl.fontFamily = _fontFamily;
  }

  if (includePostfx) {
    tpl.postfx = {
      shake: _shake,
      zoom: _zoom,
      tilt: _tilt,
      glitch: _glitch,
      hueShift: _hueShift,
    };
  }

  if (includeFeatures) {
    tpl.features = {
      mediaOutline: _mediaOutline,
      autoExtractColors: _autoExtractColors,
      motionDetection: _motionDetection,
      invertMedia: _invertMedia,
      thresholdMedia: _thresholdMedia,
    };
  }

  return tpl;
}

function getCurrentTemplateName(): string {
  if (_loadedCustomIndex >= 0 && _loadedCustomIndex < _customTemplates.length) {
    return _customTemplates[_loadedCustomIndex].name;
  }

  if (_loadedTemplateSnapshot?.name?.trim() && _loadedTemplateSnapshot.name !== 'Current') {
    return _loadedTemplateSnapshot.name;
  }

  if (_currentTemplateIndex >= 0 && _currentTemplateIndex < templates.length) {
    return templates[_currentTemplateIndex].name;
  }

  if (_baseTemplateName) {
    const builtin = resolveBuiltinTemplateByBaseName(_baseTemplateName);
    if (builtin?.name) return builtin.name;
    return _baseTemplateName;
  }

  return 'Current';
}

export function saveCurrentAsTemplate(name: string, options?: SaveTemplateOptions) {
  const tpl = buildCurrentTemplateSnapshot(name, options);
  if (!tpl) return;

  _customTemplates = [..._customTemplates, tpl];
  saveCustomTemplates(_customTemplates);
  _customDirty = false;
  setResetBaselineSnapshot(tpl);
  // Don't call loadTemplate — current state is already correct
}

export function overwriteCurrentToCustomTemplate(index: number, options?: SaveTemplateOptions) {
  if (index < 0 || index >= _customTemplates.length) return;
  const existing = _customTemplates[index];
  if (!existing) return;
  const tpl = buildCurrentTemplateSnapshot(existing.name, options);
  if (!tpl) return;

  _customTemplates[index] = tpl;
  _customTemplates = [..._customTemplates];
  saveCustomTemplates(_customTemplates);
  _customDirty = false;
  _loadedCustomIndex = index;
  setLoadedTemplateSnapshot(tpl);
}

export function deleteCustomTemplate(index: number) {
  _customTemplates = _customTemplates.filter((_, i) => i !== index);
  saveCustomTemplates(_customTemplates);
  _loadedCustomIndex = -1;
  selectTemplate(0);
}

/** Load a saved custom template into the live editor (no re-save). */
export function loadCustomTemplateIntoEditor(index: number) {
  if (!_engine) return;
  const ct = _customTemplates[index];
  if (!ct) return;
  _currentTemplateIndex = -1;
  _isCustomMode = false;
  _customDirty = false;
  _loadedCustomIndex = index;
  applyBaseReference(ct);
  _engine.loadTemplate(cloneTemplate(ct));
  syncFromEngine();
}

/** Update an existing custom template in-place (overwrite). */
export function updateCustomTemplate(index: number, tpl: TemplateConfig) {
  if (index < 0 || index >= _customTemplates.length) return;
  _customTemplates[index] = cloneTemplate(tpl);
  _customTemplates[index].lastModified = Date.now();
  _customTemplates = [..._customTemplates]; // trigger reactivity
  saveCustomTemplates(_customTemplates);
}

export function renameCustomTemplate(index: number, name: string): string | null {
  if (index < 0 || index >= _customTemplates.length) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = _customTemplates[index];
  if (!existing) return null;

  const renamed = cloneTemplate(existing);
  renamed.name = trimmed;
  renamed.lastModified = Date.now();

  _customTemplates[index] = renamed;
  _customTemplates = [..._customTemplates];
  saveCustomTemplates(_customTemplates);

  if (_loadedCustomIndex === index) {
    if (_loadedTemplateSnapshot) {
      _loadedTemplateSnapshot = {
        ..._loadedTemplateSnapshot,
        name: trimmed,
        lastModified: renamed.lastModified,
      };
    }

    const baseline = _resetBaselineSnapshot
      ? {
        ..._resetBaselineSnapshot,
        name: trimmed,
        lastModified: renamed.lastModified,
      }
      : renamed;

    setResetBaselineSnapshot(baseline);
  }

  return trimmed;
}

export async function exportShareCode(index: number): Promise<string> {
  return encodeShareCode(_customTemplates[index]);
}

export async function importShareCode(code: string) {
  const tpl = await decodeShareCode(code);
  _customTemplates = [..._customTemplates, tpl];
  saveCustomTemplates(_customTemplates);
  if (_engine) {
    applyBaseReference(tpl);
    _engine.loadTemplate(cloneTemplate(tpl));
    setLoadedTemplateSnapshot(tpl);
  }
  _isCustomMode = false;
  syncFromEngine();
}

/** Add a decoded TemplateConfig to custom templates without loading it. Returns the new index. */
export function addCustomTemplate(tpl: TemplateConfig): number {
  _customTemplates = [..._customTemplates, cloneTemplate(tpl)];
  saveCustomTemplates(_customTemplates);
  return _customTemplates.length - 1;
}

/** Build a full TemplateConfig snapshot of the current engine state. */
export function getCurrentTemplateConfig(): TemplateConfig | null {
  if (!_engine) return null;
  const effects = (_engine.currentEffects ?? []).map((e: any) => ({
    type: e.type,
    layer: e.layer,
    config: { ...e.config },
    visible: e.visible !== false,
  }));
  const palette = _engine.currentPalette
    ? { ..._engine.currentPalette }
    : { background: '#000', primary: '#fff', secondary: '#888', accent: '#f36', text: '#fff' };
  const tpl: TemplateConfig = {
    name: getCurrentTemplateName(),
    palette,
    effects,
    baseTemplateName: _baseTemplateName ?? _loadedTemplateSnapshot?.baseTemplateName ?? undefined,
  };
  tpl.segmentDuration = _segmentDuration;
  tpl.bpm = _bpm;
  tpl.beatReactivity = _beatReactivity;
  tpl.animationSpeed = _animationSpeed;
  tpl.motionIntensity = _motionIntensity;
  tpl.bgOpacity = _effectOpacity;
  if (_fontFamily) {
    tpl.fontFamily = _fontFamily;
  }
  tpl.postfx = { shake: _shake, zoom: _zoom, tilt: _tilt, glitch: _glitch, hueShift: _hueShift };
  tpl.features = {
    mediaOutline: _mediaOutline,
    autoExtractColors: _autoExtractColors,
    motionDetection: _motionDetection,
    invertMedia: _invertMedia,
    thresholdMedia: _thresholdMedia,
  };
  return tpl;
}

/** Load a template from sharecode URL param — enters custom mode without saving to localStorage. */
export function loadShareCodeTemplate(tpl: TemplateConfig) {
  if (!_engine) return;
  _currentTemplateIndex = -1;
  _isCustomMode = false;
  _customDirty = false;
  _loadedCustomIndex = -1;
  applyBaseReference(tpl);
  _engine.loadTemplate(cloneTemplate(tpl));
  setLoadedTemplateSnapshot(tpl);
  syncFromEngine();
}

/** Load a template with diff options — handles missing groups. */
export type MissingMode = 'keep' | 'reset' | 'builtin';

const DEFAULT_TEMPLATE_VALUES = {
  segmentDuration: 3,
  bpm: 120,
  beatReactivity: 0.5,
  animationSpeed: 2,
  motionIntensity: 1,
  bgOpacity: 1,
} as const;

export function resolveTemplateWithOptions(
  tpl: TemplateConfig,
  opts: {
    missingMode: MissingMode;
    customIndex?: number;
    builtinIndex?: number;
    /** @deprecated Use missingMode instead */
    resetMissing?: boolean;
  },
): TemplateConfig {
  const mode: MissingMode = opts.missingMode ?? (opts.resetMissing ? 'reset' : 'keep');
  const merged = cloneTemplate(tpl);

  if (mode === 'keep') {
    if (merged.segmentDuration === undefined) merged.segmentDuration = _segmentDuration;
    if (merged.bpm === undefined) merged.bpm = _bpm;
    if (merged.beatReactivity === undefined) merged.beatReactivity = _beatReactivity;
    if (merged.animationSpeed === undefined) merged.animationSpeed = _animationSpeed;
    if (merged.motionIntensity === undefined) merged.motionIntensity = _motionIntensity;
    if (merged.bgOpacity === undefined) merged.bgOpacity = _effectOpacity;
    merged.postfx = {
      shake: merged.postfx?.shake ?? _shake,
      zoom: merged.postfx?.zoom ?? _zoom,
      tilt: merged.postfx?.tilt ?? _tilt,
      glitch: merged.postfx?.glitch ?? _glitch,
      hueShift: merged.postfx?.hueShift ?? _hueShift,
    };
    merged.features = {
      mediaOutline: merged.features?.mediaOutline ?? _mediaOutline,
      autoExtractColors: merged.features?.autoExtractColors ?? ((_engine as any).currentTemplate?.features?.autoExtractColors ?? false),
      motionDetection: merged.features?.motionDetection ?? _motionDetection,
      invertMedia: merged.features?.invertMedia ?? _invertMedia,
      thresholdMedia: merged.features?.thresholdMedia ?? _thresholdMedia,
    };
  } else if (mode === 'builtin' && tpl.baseTemplateName) {
    const baseTpl = resolveBuiltinTemplateByBaseName(tpl.baseTemplateName);
    if (baseTpl) {
      if (merged.segmentDuration === undefined) merged.segmentDuration = baseTpl.segmentDuration ?? DEFAULT_TEMPLATE_VALUES.segmentDuration;
      if (merged.bpm === undefined) merged.bpm = baseTpl.bpm;
      if (merged.beatReactivity === undefined) merged.beatReactivity = baseTpl.beatReactivity ?? DEFAULT_TEMPLATE_VALUES.beatReactivity;
      if (merged.animationSpeed === undefined) merged.animationSpeed = baseTpl.animationSpeed;
      if (merged.motionIntensity === undefined) merged.motionIntensity = baseTpl.motionIntensity ?? DEFAULT_TEMPLATE_VALUES.motionIntensity;
      if (merged.bgOpacity === undefined) merged.bgOpacity = baseTpl.bgOpacity;
      merged.postfx = {
        shake: merged.postfx?.shake ?? baseTpl.postfx?.shake,
        zoom: merged.postfx?.zoom ?? baseTpl.postfx?.zoom,
        tilt: merged.postfx?.tilt ?? baseTpl.postfx?.tilt,
        glitch: merged.postfx?.glitch ?? baseTpl.postfx?.glitch,
        hueShift: merged.postfx?.hueShift ?? baseTpl.postfx?.hueShift,
      };
      merged.features = {
        mediaOutline: merged.features?.mediaOutline ?? baseTpl.features?.mediaOutline,
        autoExtractColors: merged.features?.autoExtractColors ?? baseTpl.features?.autoExtractColors,
        motionDetection: merged.features?.motionDetection ?? baseTpl.features?.motionDetection,
        invertMedia: merged.features?.invertMedia ?? baseTpl.features?.invertMedia,
        thresholdMedia: merged.features?.thresholdMedia ?? baseTpl.features?.thresholdMedia,
      };
    }
  }

  return merged;
}

export function loadTemplateWithOptions(tpl: TemplateConfig, opts: {
  missingMode: MissingMode;
  customIndex?: number;
  builtinIndex?: number;
  /** @deprecated Use missingMode instead */
  resetMissing?: boolean;
}) {
  if (!_engine) return;

  const merged = resolveTemplateWithOptions(tpl, opts);

  _isCustomMode = false;
  _customDirty = false;
  // Reset canvas color override so new template's palette takes effect
  _canvasColor = null;
  if (_engine) _engine.canvasColor = null;
  _alphaMode = false;
  if (_engine) _engine.alphaMode = false;

  if (opts.builtinIndex !== undefined && opts.builtinIndex >= 0) {
    // Switching to a built-in template
    _currentTemplateIndex = opts.builtinIndex;
    _loadedCustomIndex = -1;
    const bt = templates[opts.builtinIndex];
    _baseTemplateName = bt.nameKey ?? bt.name;
    _baseTemplateEffects = normalizeEffectEntries(bt.effects);
    _baseTemplatePalette = bt.palette ? { ...bt.palette } : null;
  } else {
    _currentTemplateIndex = -1;
    _loadedCustomIndex = opts.customIndex ?? -1;
    if (opts.customIndex !== undefined && opts.customIndex >= 0 && opts.customIndex < _customTemplates.length) {
      const ct = _customTemplates[opts.customIndex];
      applyBaseReference(ct);
    } else {
      applyBaseReference(merged);
    }
  }

  _engine.loadTemplate(merged);
  setLoadedTemplateSnapshot(merged);
  syncFromEngine();

  // Check font availability after loading
  if (merged.fontFamily && !checkFontAvailable(merged.fontFamily)) {
    const source = opts.builtinIndex !== undefined ? 'template' as const
      : opts.customIndex !== undefined ? 'template' as const
      : 'sharecode' as const;
    setPendingFontWarning({ font: parsePrimaryFont(merged.fontFamily), source });
  }
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

export function setMediaOutline(v: boolean) {
  _mediaOutline = v;
  if (_engine) _engine.mediaOutlineEnabled = v;
}

export function setAutoExtractColors(v: boolean) {
  _autoExtractColors = v;
  if (_engine) _engine.autoExtractColorsEnabled = v;
}

export function setMotionDetection(v: boolean) {
  _motionDetection = v;
  if (_engine) _engine.motionDetectionEnabled = v;
}

export function setInvertMedia(v: boolean) {
  _invertMedia = v;
  if (v) _thresholdMedia = false;
  if (_engine) {
    _engine.invertMediaEnabled = v;
    if (v) _engine.thresholdMediaEnabled = false;
  }
}

export function setThresholdMedia(v: boolean) {
  _thresholdMedia = v;
  if (v) _invertMedia = false;
  if (_engine) {
    _engine.thresholdMediaEnabled = v;
    if (v) _engine.invertMediaEnabled = false;
  }
}

export function setCanvasColor(color: string | null) {
  _canvasColor = color;
  if (_engine) _engine.canvasColor = color;
  // When canvas alpha < 1, page CSS must be transparent so the semi-transparent
  // canvas content is not composited onto the opaque CSS background (#0a0a0f).
  // This affects both browser preview and OBS browser source.
  let alpha = 1;
  if (color && color.length === 9) {
    alpha = parseInt(color.slice(7, 9), 16) / 255;
  }
  if (alpha < 1) {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
  } else {
    document.body.style.background = '';
    document.documentElement.style.background = '';
  }
}

export function setFontFamily(font: string | null) {
  _fontFamily = font;
  if (_engine) _engine.fontFamily = font;
}

export function setPendingFontWarning(warning: { font: string; source: 'sharecode' | 'url' | 'template' } | null) {
  _pendingFontWarning = warning;
}

export function clearPendingFontWarning() {
  _pendingFontWarning = null;
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
  _engine.beat.volume = _audioVolume;
  _audioLoaded = true;
  _audioFileName = file.name;
  _audioPaused = false;

  // Try extracting embedded lyrics
  try {
    const raw = await extractEmbeddedLyrics(file);
    _embeddedLyricsRaw = raw;
    // Keep embedded lyrics in sync with the current audio unless the user
    // explicitly switched to an external lyrics file.
    if (raw && (_embeddedLyricsSource === 'embedded' || !_lyricsLoaded)) {
      applyEmbeddedLyrics(raw);
      _embeddedLyricsSource = 'embedded';
    } else if (!raw) {
      handleEmbeddedLyricsUnavailable();
    }
  } catch {
    handleEmbeddedLyricsUnavailable();
  }
}

export function clearAudio() {
  if (!_engine) return;
  _engine.beat.dispose();
  _audioLoaded = false;
  _audioFileName = '';
  _audioPaused = false;
  handleEmbeddedLyricsUnavailable();
}

export function toggleAudio() {
  if (!_engine) return;
  if (_engine.paused) {
    _engine.resume();
    _audioPaused = false;
  } else {
    _engine.pause();
    _audioPaused = true;
  }
}

export function setAudioVolume(v: number) {
  _audioVolume = Math.max(0, Math.min(1, v));
  if (_engine) {
    _engine.beat.volume = _audioVolume;
  }
}

// ── Lyrics ──

function applyEmbeddedLyrics(raw: string) {
  if (!_engine) return;
  if (applyEmbeddedLyricsToEngine(_engine, raw)) {
    _lyricsLoaded = true;
    _lyricsFileName = '(embedded)';
  }
}

function applyEmbeddedLyricsToEngine(target: PVEngine, raw: string): boolean {
  const lrcLines = parseLrc(raw);
  if (lrcLines.length > 0) {
    target.setSrtTimeline(null);
    target.setLyricTimeline(lrcLines);
    return true;
  }
  const plainLines = raw.split(/\r?\n/).filter(l => l.trim());
  if (plainLines.length > 0) {
    target.setText(plainLines.join('/'));
    return true;
  }

  return false;
}

/** Apply external file lyrics to the engine. */
function applyFileLyrics(text: string, ext: string) {
  if (!_engine) return;
  applyFileLyricsToEngine(_engine, text, ext);
}

function applyFileLyricsToEngine(target: PVEngine, text: string, ext: string) {
  if (ext === 'lrc') {
    const lines = parseLrc(text);
    if (lines.length > 0) {
      target.setSrtTimeline(null);
      target.setLyricTimeline(lines);
    }
  } else if (ext === 'srt') {
    const entries = parseSrt(text);
    if (entries.length > 0) {
      target.clearLyricTimeline();
      target.setSrtTimeline(entries);
    }
  } else if (ext === 'ass' || ext === 'ssa') {
    const entries = parseAss(text);
    if (entries.length > 0) {
      target.clearLyricTimeline();
      target.setSrtTimeline(entries);
    }
  }
}

function restoreDefaultText() {
  if (!_engine) return;
  _engine.setText(_text.replace(/\r?\n/g, '/'));
}

function handleEmbeddedLyricsUnavailable() {
  if (!_engine) return;

  _embeddedLyricsRaw = null;

  if (_embeddedLyricsSource !== 'embedded') {
    return;
  }

  if (_fileLyricsText) {
    applyFileLyrics(_fileLyricsText, _fileLyricsExt);
    _lyricsLoaded = true;
    _lyricsFileName = _fileLyricsFileName;
    _embeddedLyricsSource = 'file';
    return;
  }

  _engine.clearLyricTimeline();
  _engine.setSrtTimeline(null);
  restoreDefaultText();
  _lyricsLoaded = false;
  _lyricsFileName = '';
  _embeddedLyricsSource = 'none';
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
    restoreDefaultText();
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
  const base = _resetBaselineSnapshot?.postfx;
  setShake(base?.shake ?? 0);
  setZoom(base?.zoom ?? 0);
  setTilt(base?.tilt ?? 0);
  setGlitch(base?.glitch ?? 0);
  setHueShift(base?.hueShift ?? 0);
}

export function setPostFxLocked(v: boolean): void {
  _postFxLocked = v;
}

export function setFontLocked(v: boolean): void {
  _fontLocked = v;
}

export function resetFont(): void {
  const base = _resetBaselineSnapshot?.fontFamily ?? '';
  setFontFamily(base);
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

// ── Preview engine hydration ──

/**
 * Hydrate a secondary PVEngine with the current text/lyrics state and a resolved template.
 * Used by the diff-dialog live preview. Does NOT touch media/audio — preview runs without media.
 */
export function hydratePreviewEngine(target: PVEngine, resolvedTpl: TemplateConfig): void {
  // 1. Apply locked overrides into the template config before loading
  const tpl = cloneTemplate(resolvedTpl);
  if (_fontLocked && _fontFamily) {
    tpl.fontFamily = _fontFamily;
  }
  if (_postFxLocked) {
    tpl.postfx = {
      shake: _shake,
      zoom: _zoom,
      tilt: _tilt,
      glitch: _glitch,
      hueShift: _hueShift,
    };
  }

  // 2. Load the resolved template (effects + palette + params)
  target.loadTemplate(tpl);

  // 2. Sync text / lyrics to match the main engine's current display
  if (_engine?.nowPlayingListening) {
    // If NowPlaying is active, copy the track info
    target.nowPlayingListening = true;
  } else if (_engine?.nxpcListening) {
    // If NXPC is active, copy it
    target.nxpcListening = true;
  } else if (_embeddedLyricsSource === 'embedded' && _embeddedLyricsRaw) {
    // Embedded lyrics active — apply them to the preview engine
    applyEmbeddedLyricsToEngine(target, _embeddedLyricsRaw);
  } else if (_embeddedLyricsSource === 'file' && _fileLyricsText) {
    // External file lyrics active
    applyFileLyricsToEngine(target, _fileLyricsText, _fileLyricsExt);
  } else {
    // Plain text mode — use the current text from the store
    target.setText(_text.replace(/\r?\n/g, '/'));
  }
}

// ── Read-only reactive getters (exported as $state) ──

export const engine = {
  get ready() { return _ready; },
  get currentTemplateIndex() { return _currentTemplateIndex; },
  get isCustomMode() { return _isCustomMode; },
  get customDirty() { return computeTemplateDirtyState(); },
  get loadedCustomIndex() { return _loadedCustomIndex; },
  get customEffects() { return _customEffects; },
  get customTemplates() { return _customTemplates; },
  get baseTemplateName() { return _baseTemplateName; },
  get baseTemplateEffects() { return _baseTemplateEffects; },
  get basePalette() { return _baseTemplatePalette; },
  get hasBaseTemplate() { return _baseTemplatePalette !== null || _baseTemplateEffects.length > 0; },
  get hasLoadedTemplate() { return _loadedTemplateSnapshot !== null; },
  get resetBaselineVersion() { return _resetBaselineVersion; },
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
  get fontLocked() { return _fontLocked; },
  get mediaOutline() { return _mediaOutline; },
  get autoExtractColors() { return _autoExtractColors; },
  get motionDetection() { return _motionDetection; },
  get invertMedia() { return _invertMedia; },
  get thresholdMedia() { return _thresholdMedia; },
  get isVideoMedia() { return _engine?.isVideoMedia ?? false; },
  get mediaLoaded() { return _mediaLoaded; },
  get mediaFileName() { return _mediaFileName; },
  get mediaMode() { return _mediaMode; },
  get mediaOffsetX() { return _mediaOffsetX; },
  get mediaOffsetY() { return _mediaOffsetY; },
  get mediaScale() { return _mediaScale; },
  get audioLoaded() { return _audioLoaded; },
  get audioFileName() { return _audioFileName; },
  get audioPaused() { return _audioPaused; },
  get audioVolume() { return _audioVolume; },
  get lyricsLoaded() { return _lyricsLoaded; },
  get lyricsFileName() { return _lyricsFileName; },
  get embeddedLyricsRaw() { return _embeddedLyricsRaw; },
  get embeddedLyricsSource() { return _embeddedLyricsSource; },
  get hasFileLyrics() { return _fileLyricsText !== null; },
  get canvasColor() { return _canvasColor; },
  get fontFamily() { return _fontFamily; },
  get pendingFontWarning() { return _pendingFontWarning; },
  get alphaMode() { return _alphaMode; },
  get isRecording() { return _isRecording; },
  get recordingTime() { return _recordingTime; },
  get toastMessage() { return _toastMessage; },
  get toastVisible() { return _toastVisible; },
  get allTemplates() { return templates; },
  get instance() { return _engine; },
};
