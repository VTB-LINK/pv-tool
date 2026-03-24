// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Effects V2 — Auto-discovery registry using Vite's import.meta.glob
//
// Any .ts file under effects/v2/ that exports a class with static `meta.version === 2`
// will be automatically registered. No manual import/register needed.

import type { BaseEffectV2 } from './BaseEffect';
import type { EffectMeta } from './schema';

type V2EffectConstructor = (new () => BaseEffectV2) & { readonly meta: EffectMeta };

// Eagerly import all .ts files under v2/ subdirectories (not this file or schema/BaseEffect)
const modules = import.meta.glob<Record<string, any>>([
  './**/*.ts',
  '!./schema.ts',
  '!./BaseEffect.ts',
  '!./registry.ts',
], { eager: true });

export const v2Registry = new Map<string, V2EffectConstructor>();
export const v2Metas: EffectMeta[] = [];

for (const [_path, mod] of Object.entries(modules)) {
  for (const exported of Object.values(mod)) {
    const ctor = exported as any;
    if (ctor?.meta?.version === 2 && typeof ctor === 'function') {
      v2Registry.set(ctor.meta.type, ctor as V2EffectConstructor);
      v2Metas.push(ctor.meta as EffectMeta);
    }
  }
}
