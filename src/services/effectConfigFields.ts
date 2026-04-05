// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

import { resolveLocalized } from '../effects/v2/schema';
import { v2Registry } from '../effects/v2/registry';

export type ComplexConfigKind = 'array' | 'object';

export interface ComplexConfigField {
  key: string;
  label: string;
  kind: ComplexConfigKind;
  value: unknown;
}

export interface EditableStringArrayField {
  key: string;
  label: string;
  value: string[];
  options?: string[];
  allowCustom: boolean;
}

const STRING_ARRAY_FIELD_OPTIONS: Partial<Record<string, Partial<Record<string, { options: string[]; allowCustom?: boolean }>>>> = {
  compositionGuides: {
    guides: {
      options: ['thirds', 'phi', 'goldenSpiral', 'diagonal', 'center', 'baroque'],
      allowCustom: false,
    },
  },
  scatteredShapes: {
    shapes: {
      options: ['square', 'diamond', 'dot'],
      allowCustom: false,
    },
  },
};

function isPrivateConfigKey(key: string): boolean {
  return key.startsWith('_');
}

export function isComplexConfigValue(value: unknown): value is unknown[] | Record<string, unknown> {
  return Array.isArray(value) || (typeof value === 'object' && value !== null);
}

export function isStringArrayValue(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export function isScalarConfigValue(value: unknown, allowUndefined = false): boolean {
  if (value === undefined) return allowUndefined;
  return !isComplexConfigValue(value);
}

export function formatEffectConfigKeyLabel(effectType: string, key: string): string {
  const meta = v2Registry.get(effectType)?.meta;
  const field = meta?.fields.find(item => item.key === key);
  if (field) return resolveLocalized(field.label);
  return key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim();
}

export function getScalarConfigEntries(config: Record<string, any>): [string, any][] {
  return Object.entries(config).filter(([key, value]) => {
    if (isPrivateConfigKey(key)) return false;
    return isScalarConfigValue(value);
  });
}

export function getEditableStringArrayConfigEntries(effectType: string, config: Record<string, any>): EditableStringArrayField[] {
  return Object.entries(config).flatMap(([key, value]) => {
    if (isPrivateConfigKey(key)) return [];
    if (!isStringArrayValue(value)) return [];

    const metadata = STRING_ARRAY_FIELD_OPTIONS[effectType]?.[key];

    return [{
      key,
      label: formatEffectConfigKeyLabel(effectType, key),
      value,
      options: metadata?.options,
      allowCustom: metadata?.allowCustom ?? !metadata?.options,
    }];
  });
}

export function shouldIncludeScalarConfigDiffKey(key: string, currentValue: unknown, incomingValue: unknown): boolean {
  if (isPrivateConfigKey(key)) return false;
  if (!isScalarConfigValue(currentValue, true)) return false;
  if (!isScalarConfigValue(incomingValue, true)) return false;
  return currentValue !== undefined || incomingValue !== undefined;
}

export function shouldIncludeComplexConfigDiffKey(key: string, currentValue: unknown, incomingValue: unknown): boolean {
  if (isPrivateConfigKey(key)) return false;
  const currentComplex = currentValue !== undefined && isComplexConfigValue(currentValue);
  const incomingComplex = incomingValue !== undefined && isComplexConfigValue(incomingValue);
  return currentComplex || incomingComplex;
}

export function detectComplexConfigKind(value: unknown): ComplexConfigKind {
  return Array.isArray(value) ? 'array' : 'object';
}

export function summarizeComplexConfigValue(value: unknown): string {
  if (value === undefined) return '—';

  if (Array.isArray(value)) {
    if (value.length === 0) return '0 items';
    const scalarItems = value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item));
    if (scalarItems) {
      const preview = value.slice(0, 4).map(item => String(item)).join(', ');
      return value.length > 4 ? `${value.length} items [${preview}, ...]` : `${value.length} items [${preview}]`;
    }
    return `${value.length} items`;
  }

  if (typeof value === 'object' && value !== null) {
    return `${Object.keys(value).length} keys`;
  }

  return String(value);
}

export function formatComplexConfigValue(value: unknown): string {
  if (value === undefined) return '—';
  return JSON.stringify(value, null, 2);
}
