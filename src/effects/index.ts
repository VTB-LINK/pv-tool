// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Unified Effects Registry — merges V1 (manual) + V2 (auto-discovered)

import * as PIXI from 'pixi.js';
import type { ColorPalette } from '../types/engine';

// V1: Legacy effects (manual registry)
import { BaseEffect } from './v1/base';
import { createEffect as createV1Effect } from './v1/index';

// V2: Auto-discovered effects
import { v2Registry } from './v2/registry';
import { BaseEffectV2 } from './v2/BaseEffect';

// Re-export types for consumers
export { BaseEffect } from './v1/base';
export { BaseEffectV2 } from './v2/BaseEffect';
export type { EffectMeta, ConfigField, ConfigFieldType } from './v2/schema';
export { v2Registry, v2Metas } from './v2/registry';
export { buildDefaultConfig } from './v2/schema';

/**
 * Unified effect factory — tries V2 registry first, falls back to V1.
 */
export function createEffect(
  type: string,
  container: PIXI.Container,
  config: Record<string, any>,
  palette: ColorPalette,
): BaseEffect | BaseEffectV2 {
  // Try V2 first
  const V2Ctor = v2Registry.get(type);
  if (V2Ctor) {
    const effect = new V2Ctor();
    effect.init(container, config, palette);
    return effect;
  }

  // Fall back to V1
  return createV1Effect(type, container, config, palette);
}
