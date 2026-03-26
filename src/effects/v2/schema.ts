// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Effects V2 — Config Schema Types

import type { LayerType } from '../../types/engine';
import { locale } from '../../i18n';

/** Localized string: either a plain string or per-locale object */
export type LocalizedString = string | { zh: string; en?: string; ja?: string };

/** Resolve a LocalizedString to the current locale */
export function resolveLocalized(s: LocalizedString): string {
  if (typeof s === 'string') return s;
  return (s as any)[locale] ?? s.zh ?? '';
}

// ── Field type descriptors ──

export type ConfigFieldType =
  | { kind: 'number'; min?: number; max?: number; step?: number; default: number }
  | { kind: 'integer'; min?: number; max?: number; default: number }
  | { kind: 'color'; default: string; paletteRef?: boolean }
  | { kind: 'string'; default: string; options?: string[] }
  | { kind: 'boolean'; default: boolean }
  | { kind: 'vec2'; default: [number, number]; min?: number; max?: number; step?: number }
  | { kind: 'font'; default: string };

export interface ConfigField {
  /** Config key in the effect's config object */
  key: string;
  /** Display label in the editor (supports multi-locale) */
  label: LocalizedString;
  /** Type descriptor — drives auto-generated UI */
  type: ConfigFieldType;
  /** Optional group name for collapsible sections */
  group?: string;
  /** If true, hidden by default in editor (show under "Advanced") */
  advanced?: boolean;
}

export interface EffectMeta {
  /** Unique type identifier (e.g. 'heroTextV2') */
  type: string;
  /** Display name — supports multi-locale */
  name: LocalizedString;
  /** Category for catalog grouping — supports multi-locale */
  category: LocalizedString;
  /** Default layer */
  layer: LayerType;
  /** Must be 2 */
  version: 2;
  /** Mark as GPU/CPU-heavy */
  heavy?: boolean;
  /** Parameter schema — used for auto-generated config UI + defaults */
  fields: ConfigField[];
}

/** Extract a default config object from an EffectMeta's fields array */
export function buildDefaultConfig(meta: EffectMeta): Record<string, any> {
  const config: Record<string, any> = {};
  for (const field of meta.fields) {
    config[field.key] = field.type.default;
  }
  return config;
}
