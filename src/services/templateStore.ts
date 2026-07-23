// Modified by VTB-LIVE on 2026-04-11
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import type { TemplateConfig } from '../types/engine';
import { templates } from '../templates';

const STORAGE_KEY = 'pv-tool-custom-templates';
const SHARE_KEY = 'PV2026';

// ── LocalStorage persistence ──

export function loadCustomTemplates(): TemplateConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TemplateConfig[];
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: TemplateConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function addCustomTemplate(template: TemplateConfig): TemplateConfig[] {
  const list = loadCustomTemplates();
  list.push(template);
  saveCustomTemplates(list);
  return list;
}

export function removeCustomTemplate(index: number): TemplateConfig[] {
  const list = loadCustomTemplates();
  list.splice(index, 1);
  saveCustomTemplates(list);
  return list;
}

// ── Share code: serialize → compress → XOR encrypt → base64 ──

function xorCipher(data: Uint8Array, key: string): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key.charCodeAt(i % key.length);
  }
  return result;
}

async function compressBytes(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

async function decompressBytes(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function cloneTemplate(template: TemplateConfig): TemplateConfig {
  return {
    ...template,
    palette: { ...template.palette },
    effects: template.effects.map(effect => ({
      ...effect,
      visible: effect.visible !== false,
      config: { ...effect.config },
    })),
    postfx: template.postfx ? { ...template.postfx } : undefined,
    features: template.features ? { ...template.features } : undefined,
  };
}

function hasMeaningfulImportName(name: string | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (trimmed === 'Current' || trimmed === 'Custom') return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  return true;
}

function tryParseTemplateUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    if (typeof window === 'undefined') return null;
    try {
      return new URL(trimmed, window.location.origin);
    } catch {
      return null;
    }
  }
}

function applyRuntimeOverrides(template: TemplateConfig, params: URLSearchParams): TemplateConfig {
  const next = cloneTemplate(template);

  const applyNumber = (key: string, setter: (value: number) => void) => {
    const raw = params.get(key);
    if (raw === null) return;
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value)) setter(value);
  };

  const applyBoolean = (
    key: string,
    setter: (value: boolean) => void,
    target: Record<string, boolean> | undefined,
  ) => {
    const raw = params.get(key);
    if (raw === null || !target) return;
    setter(raw === '1');
  };

  next.features ??= {};
  next.postfx ??= {};

  applyBoolean('outline', value => { next.features!.mediaOutline = value; }, next.features);
  applyBoolean('autocolors', value => { next.features!.autoExtractColors = value; }, next.features);
  applyBoolean('motiondetect', value => { next.features!.motionDetection = value; }, next.features);
  applyBoolean('invertmedia', value => { next.features!.invertMedia = value; }, next.features);
  applyBoolean('thresholdmedia', value => { next.features!.thresholdMedia = value; }, next.features);

  applyNumber('seg', value => { next.segmentDuration = value; });
  applyNumber('speed', value => { next.animationSpeed = value; });
  applyNumber('motion', value => { next.motionIntensity = value; });
  applyNumber('opacity', value => { next.bgOpacity = value; });
  applyNumber('bpm', value => { next.bpm = value; });
  applyNumber('beatreact', value => { next.beatReactivity = value; });

  applyNumber('shake', value => { next.postfx!.shake = value; });
  applyNumber('zoom', value => { next.postfx!.zoom = value; });
  applyNumber('tilt', value => { next.postfx!.tilt = value; });
  applyNumber('glitch', value => { next.postfx!.glitch = value; });
  applyNumber('hue', value => { next.postfx!.hueShift = value; });

  const font = params.get('font');
  if (font !== null) {
    next.fontFamily = font || undefined;
  }

  return next;
}

function resolveImportedTemplateName(template: TemplateConfig, params: URLSearchParams): string {
  const currentName = template.name?.trim();
  if (hasMeaningfulImportName(currentName)) {
    return currentName;
  }

  const templateParam = params.get('t');
  if (templateParam !== null && templateParam !== 'custom') {
    const index = Number.parseInt(templateParam, 10);
    if (Number.isInteger(index) && index >= 0 && index < templates.length) {
      return templates[index].name;
    }
  }

  return '';
}

export function normalizeShareCodeInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const compact = trimmed.replace(/\s+/g, '');
  const sharecodeMatch = compact.match(/(?:[?&#]|^)sharecode=([^&#]+)/i);
  if (sharecodeMatch?.[1]) {
    return decodeURIComponent(sharecodeMatch[1]).replace(/\s+/g, '');
  }

  return compact;
}

export async function decodeTemplateImportInput(input: string): Promise<TemplateConfig> {
  const url = tryParseTemplateUrl(input);
  if (!url) {
    return decodeShareCode(input);
  }

  const params = url.searchParams;
  const sharecode = params.get('sharecode');
  const templateParam = params.get('t');

  let template: TemplateConfig | null = null;

  if (sharecode) {
    template = await decodeShareCode(sharecode);
  } else if (templateParam !== null && templateParam !== 'custom') {
    const index = Number.parseInt(templateParam, 10);
    if (Number.isInteger(index) && index >= 0 && index < templates.length) {
      template = cloneTemplate(templates[index]);
    }
  }

  if (!template) {
    return decodeShareCode(input);
  }

  const imported = applyRuntimeOverrides(template, params);
  imported.name = resolveImportedTemplateName(imported, params);
  if (!imported.baseTemplateName && templateParam !== null && templateParam !== 'custom') {
    const index = Number.parseInt(templateParam, 10);
    if (Number.isInteger(index) && index >= 0 && index < templates.length) {
      imported.baseTemplateName = templates[index].name;
    }
  }
  return imported;
}

export async function encodeShareCode(template: TemplateConfig): Promise<string> {
  const json = JSON.stringify(template);
  const raw = new TextEncoder().encode(json);
  const compressed = await compressBytes(raw);
  const encrypted = xorCipher(compressed, SHARE_KEY);
  return uint8ToBase64(encrypted);
}

// ── Cross-fork import compatibility ──
// Share codes produced by other pv-tool forks may reference effect/template
// identifiers that differ from ours. These maps translate those identifiers to
// our own on import so such share codes render correctly. This is an interop
// shim over an external data format, not a code dependency.
const IMPORT_EFFECT_TYPE_ALIASES: Record<string, string> = {
  victimOutline: 'chalkFigure',
  crayonShatter: 'crayonScrawl',
  shatterText: 'shardText',
};

const IMPORT_TEMPLATE_ID_ALIASES: Record<string, string> = {
  tpl_haruhikage: 'tpl_springAfterglow',
  '春日影': 'tpl_springAfterglow',
  Haruhikage: 'tpl_springAfterglow',
};

function remapImportedIdentifiers(template: TemplateConfig): TemplateConfig {
  for (const effect of template.effects) {
    const mapped = IMPORT_EFFECT_TYPE_ALIASES[effect.type];
    if (mapped) effect.type = mapped;
  }
  if (template.nameKey && IMPORT_TEMPLATE_ID_ALIASES[template.nameKey]) {
    template.nameKey = IMPORT_TEMPLATE_ID_ALIASES[template.nameKey];
  }
  if (template.baseTemplateName && IMPORT_TEMPLATE_ID_ALIASES[template.baseTemplateName]) {
    template.baseTemplateName = IMPORT_TEMPLATE_ID_ALIASES[template.baseTemplateName];
  }
  return template;
}

export async function decodeShareCode(code: string): Promise<TemplateConfig> {
  const cleaned = normalizeShareCodeInput(code);
  const encrypted = base64ToUint8(cleaned);
  const compressed = xorCipher(encrypted, SHARE_KEY);
  const raw = await decompressBytes(compressed);
  const json = new TextDecoder().decode(raw);
  const template = JSON.parse(json) as TemplateConfig;
  if (!template.name || !template.palette || !Array.isArray(template.effects)) {
    throw new Error('Invalid template data');
  }
  return remapImportedIdentifiers(template);
}
