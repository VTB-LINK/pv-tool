// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

import { t } from '../i18n';
import type { TemplateConfig } from '../types/engine';
import { getEffectDisplayLabel, normalizeEffectEntries } from '../engine/effectCatalog';
import {
  detectComplexConfigKind,
  formatComplexConfigValue,
  formatEffectConfigKeyLabel,
  shouldIncludeComplexConfigDiffKey,
  shouldIncludeScalarConfigDiffKey,
  summarizeComplexConfigValue,
} from './effectConfigFields';
import { v2Registry } from '../effects/v2/registry';

export interface ParamDiffItem {
  key: string;
  label: string;
  current: string;
  incoming: string;
  missing: boolean;
}

export interface ParamDiffGroup {
  id: 'template' | 'rhythm' | 'postfx' | 'features';
  label: string;
  items: ParamDiffItem[];
}

export interface EffectConfigDiffItem {
  key: string;
  label: string;
  current: string;
  incoming: string;
}

export interface EffectComplexConfigDiffItem {
  key: string;
  label: string;
  kind: 'array' | 'object';
  currentSummary: string;
  incomingSummary: string;
  currentRaw: string;
  incomingRaw: string;
}

export interface EffectDiffItem {
  type: string;
  label: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  visibilityChanged?: boolean;
  currentVisible?: boolean;
  incomingVisible?: boolean;
  configItems: EffectConfigDiffItem[];
  complexConfigItems: EffectComplexConfigDiffItem[];
}

function hasEffectVisibilityChanged(currentEffect: { visible?: boolean }, incomingEffect: { visible?: boolean }): boolean {
  return (currentEffect.visible !== false) !== (incomingEffect.visible !== false);
}

function formatNumber(value: number | undefined, fallback: number, digits = 2) {
  const target = value ?? fallback;
  return digits === 0 ? String(Math.round(target)) : target.toFixed(digits);
}

function formatMultiplier(value: number | undefined, fallback: number) {
  return `${formatNumber(value, fallback, 1)}x`;
}

function formatSeconds(value: number | undefined, fallback: number) {
  return `${formatNumber(value, fallback, 1)}s`;
}

function formatPercent(value: number | undefined, fallback: number) {
  return `${Math.round((value ?? fallback) * 100)}%`;
}

function formatBool(value: boolean | undefined) {
  if (value === undefined) return '—';
  return value ? t('diff_bool_on') : t('diff_bool_off');
}

function pushIfChanged(items: ParamDiffItem[], item: ParamDiffItem) {
  if (item.current !== item.incoming || item.missing) items.push(item);
}

function formatConfigValue(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return formatBool(value);
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function getEffectConfigDiffItems(currentConfig: Record<string, unknown>, incomingConfig: Record<string, unknown>, effectType: string): {
  configItems: EffectConfigDiffItem[];
  complexConfigItems: EffectComplexConfigDiffItem[];
} {
  const schemaKeys = v2Registry.get(effectType)?.meta?.fields.map(field => field.key) ?? null;
  const scalarKeys = schemaKeys
    ? new Set(schemaKeys)
    : new Set(
      [...Object.keys(currentConfig), ...Object.keys(incomingConfig)].filter(key => {
        return shouldIncludeScalarConfigDiffKey(key, currentConfig[key], incomingConfig[key]);
      })
    );
  const complexKeys = schemaKeys
    ? new Set(schemaKeys.filter(key => shouldIncludeComplexConfigDiffKey(key, currentConfig[key], incomingConfig[key])))
    : new Set(
      [...Object.keys(currentConfig), ...Object.keys(incomingConfig)].filter(key => {
        return shouldIncludeComplexConfigDiffKey(key, currentConfig[key], incomingConfig[key]);
      })
    );
  const items: EffectConfigDiffItem[] = [];
  const complexItems: EffectComplexConfigDiffItem[] = [];

  for (const key of scalarKeys) {
    if (!schemaKeys && !shouldIncludeScalarConfigDiffKey(key, currentConfig[key], incomingConfig[key])) continue;
    const current = formatConfigValue(currentConfig[key]);
    const incoming = formatConfigValue(incomingConfig[key]);
    if (current === incoming) continue;
    items.push({
      key,
      label: formatEffectConfigKeyLabel(effectType, key),
      current,
      incoming,
    });
  }

  for (const key of complexKeys) {
    const currentValue = currentConfig[key];
    const incomingValue = incomingConfig[key];
    if (!shouldIncludeComplexConfigDiffKey(key, currentValue, incomingValue)) continue;
    if (JSON.stringify(currentValue) === JSON.stringify(incomingValue)) continue;
    complexItems.push({
      key,
      label: formatEffectConfigKeyLabel(effectType, key),
      kind: detectComplexConfigKind(currentValue ?? incomingValue),
      currentSummary: summarizeComplexConfigValue(currentValue),
      incomingSummary: summarizeComplexConfigValue(incomingValue),
      currentRaw: formatComplexConfigValue(currentValue),
      incomingRaw: formatComplexConfigValue(incomingValue),
    });
  }

  return {
    configItems: items,
    complexConfigItems: complexItems,
  };
}

export function getTemplateEffectDiffs(currentConfig: TemplateConfig | null, incomingConfig: TemplateConfig | null, showUnchangedEffects = true): EffectDiffItem[] {
  if (!currentConfig || !incomingConfig) return [];

  const result: EffectDiffItem[] = [];
  const currentEffects = normalizeEffectEntries(currentConfig.effects);
  const incomingEffects = normalizeEffectEntries(incomingConfig.effects);
  const currentUsed = new Set<number>();
  const incomingMatched = new Set<number>();
  const currentJson = currentEffects.map(effect => JSON.stringify(effect.config));

  for (let incomingIndex = 0; incomingIndex < incomingEffects.length; incomingIndex++) {
    const incomingEffect = incomingEffects[incomingIndex];
    const incomingJson = JSON.stringify(incomingEffect.config);
    for (let currentIndex = 0; currentIndex < currentEffects.length; currentIndex++) {
      if (currentUsed.has(currentIndex)) continue;
      const currentEffect = currentEffects[currentIndex];
      if (currentEffect.type === incomingEffect.type && currentJson[currentIndex] === incomingJson && !hasEffectVisibilityChanged(currentEffect, incomingEffect)) {
        result.push({
          type: incomingEffect.type,
          label: getEffectDisplayLabel(incomingEffect),
          status: 'unchanged',
          visibilityChanged: false,
          currentVisible: currentEffect.visible !== false,
          incomingVisible: incomingEffect.visible !== false,
          configItems: [],
          complexConfigItems: [],
        });
        currentUsed.add(currentIndex);
        incomingMatched.add(incomingIndex);
        break;
      }
    }
  }

  for (let incomingIndex = 0; incomingIndex < incomingEffects.length; incomingIndex++) {
    if (incomingMatched.has(incomingIndex)) continue;
    const incomingEffect = incomingEffects[incomingIndex];
    for (let currentIndex = 0; currentIndex < currentEffects.length; currentIndex++) {
      if (currentUsed.has(currentIndex)) continue;
      const currentEffect = currentEffects[currentIndex];
      if (currentEffect.type === incomingEffect.type) {
        const diffItems = getEffectConfigDiffItems(currentEffect.config as Record<string, unknown>, incomingEffect.config as Record<string, unknown>, incomingEffect.type);
        result.push({
          type: incomingEffect.type,
          label: getEffectDisplayLabel(incomingEffect),
          status: 'modified',
          visibilityChanged: hasEffectVisibilityChanged(currentEffect, incomingEffect),
          currentVisible: currentEffect.visible !== false,
          incomingVisible: incomingEffect.visible !== false,
          configItems: diffItems.configItems,
          complexConfigItems: diffItems.complexConfigItems,
        });
        currentUsed.add(currentIndex);
        incomingMatched.add(incomingIndex);
        break;
      }
    }
  }

  for (let incomingIndex = 0; incomingIndex < incomingEffects.length; incomingIndex++) {
    if (incomingMatched.has(incomingIndex)) continue;
    const incomingEffect = incomingEffects[incomingIndex];
    result.push({
      type: incomingEffect.type,
      label: getEffectDisplayLabel(incomingEffect),
      status: 'added',
      visibilityChanged: false,
      incomingVisible: incomingEffect.visible !== false,
      configItems: [],
      complexConfigItems: [],
    });
  }

  for (let currentIndex = 0; currentIndex < currentEffects.length; currentIndex++) {
    if (currentUsed.has(currentIndex)) continue;
    const currentEffect = currentEffects[currentIndex];
    result.push({
      type: currentEffect.type,
      label: getEffectDisplayLabel(currentEffect),
      status: 'removed',
      visibilityChanged: false,
      currentVisible: currentEffect.visible !== false,
      configItems: [],
      complexConfigItems: [],
    });
  }

  return showUnchangedEffects ? result : result.filter(item => item.status !== 'unchanged');
}

export function getTemplateParamDiffGroups(currentConfig: TemplateConfig | null, incomingConfig: TemplateConfig | null): ParamDiffGroup[] {
  if (!currentConfig || !incomingConfig) return [];

  const templateItems: ParamDiffItem[] = [];
  pushIfChanged(templateItems, {
    key: 'segmentDuration',
    label: t('seg_duration'),
    current: formatSeconds(currentConfig.segmentDuration, 3),
    incoming: incomingConfig.segmentDuration === undefined ? '—' : formatSeconds(incomingConfig.segmentDuration, 3),
    missing: incomingConfig.segmentDuration === undefined,
  });
  pushIfChanged(templateItems, {
    key: 'animationSpeed',
    label: t('anim_speed'),
    current: formatMultiplier(currentConfig.animationSpeed, 2),
    incoming: incomingConfig.animationSpeed === undefined ? '—' : formatMultiplier(incomingConfig.animationSpeed, 2),
    missing: incomingConfig.animationSpeed === undefined,
  });
  pushIfChanged(templateItems, {
    key: 'motionIntensity',
    label: t('motion_intensity'),
    current: formatMultiplier(currentConfig.motionIntensity, 1),
    incoming: incomingConfig.motionIntensity === undefined ? '—' : formatMultiplier(incomingConfig.motionIntensity, 1),
    missing: incomingConfig.motionIntensity === undefined,
  });
  pushIfChanged(templateItems, {
    key: 'bgOpacity',
    label: t('bg_opacity'),
    current: formatPercent(currentConfig.bgOpacity, 1),
    incoming: incomingConfig.bgOpacity === undefined ? '—' : formatPercent(incomingConfig.bgOpacity, 1),
    missing: incomingConfig.bgOpacity === undefined,
  });

  const rhythmItems: ParamDiffItem[] = [];
  pushIfChanged(rhythmItems, {
    key: 'bpm',
    label: t('bpm'),
    current: formatNumber(currentConfig.bpm, 120, 0),
    incoming: incomingConfig.bpm === undefined ? '—' : formatNumber(incomingConfig.bpm, 120, 0),
    missing: incomingConfig.bpm === undefined,
  });
  pushIfChanged(rhythmItems, {
    key: 'beatReactivity',
    label: t('beat_react'),
    current: formatNumber(currentConfig.beatReactivity, 0.5, 2),
    incoming: incomingConfig.beatReactivity === undefined ? '—' : formatNumber(incomingConfig.beatReactivity, 0.5, 2),
    missing: incomingConfig.beatReactivity === undefined,
  });

  const postfxItems: ParamDiffItem[] = [];
  const postfxRows = [
    { key: 'shake', label: t('shake') },
    { key: 'zoom', label: t('zoom') },
    { key: 'tilt', label: t('tilt') },
    { key: 'glitch', label: t('glitch') },
    { key: 'hueShift', label: t('hue_shift') },
  ] as const;
  for (const row of postfxRows) {
    pushIfChanged(postfxItems, {
      key: row.key,
      label: row.label,
      current: formatNumber(currentConfig.postfx?.[row.key], 0, 2),
      incoming: incomingConfig.postfx?.[row.key] === undefined ? '—' : formatNumber(incomingConfig.postfx?.[row.key], 0, 2),
      missing: incomingConfig.postfx?.[row.key] === undefined,
    });
  }

  const featureItems: ParamDiffItem[] = [];
  const featureRows = [
    { key: 'mediaOutline', label: t('feature_media_outline') },
    { key: 'autoExtractColors', label: t('feature_auto_extract_colors') },
    { key: 'motionDetection', label: t('feature_motion_detection') },
    { key: 'invertMedia', label: t('feature_invert_media') },
    { key: 'thresholdMedia', label: t('feature_threshold_media') },
  ] as const;
  for (const row of featureRows) {
    pushIfChanged(featureItems, {
      key: row.key,
      label: row.label,
      current: formatBool(currentConfig.features?.[row.key]),
      incoming: incomingConfig.features?.[row.key] === undefined ? '—' : formatBool(incomingConfig.features?.[row.key]),
      missing: incomingConfig.features?.[row.key] === undefined,
    });
  }

  const groups: ParamDiffGroup[] = [
    { id: 'template', label: t('diff_group_template'), items: templateItems },
    { id: 'rhythm', label: t('diff_group_rhythm'), items: rhythmItems },
    { id: 'postfx', label: t('diff_group_postfx'), items: postfxItems },
    { id: 'features', label: t('diff_group_features'), items: featureItems },
  ];

  return groups.filter(group => group.items.length > 0);
}
