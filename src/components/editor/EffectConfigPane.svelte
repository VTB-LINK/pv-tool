<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import Slider from '../common/Slider.svelte';
  import { t } from '../../i18n';
  import type { ConfigField, ConfigFieldType } from '../../effects/v2/schema';
  import { resolveLocalized } from '../../effects/v2/schema';

  let {
    config = $bindable<Record<string, any>>({}),
    onchange = (_key: string, _value: any) => {},
    schema = undefined as ConfigField[] | undefined,
  } = $props();

  // ── V2 schema mode ──
  // If schema is provided, render from schema fields (precise).
  // Otherwise fall back to V1 heuristic detection.

  // Group schema fields by group name
  function groupedFields(fields: ConfigField[]): { group: string; fields: ConfigField[] }[] {
    const map = new Map<string, ConfigField[]>();
    for (const f of fields) {
      const g = f.group ?? '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return Array.from(map.entries()).map(([group, fields]) => ({ group, fields }));
  }

  // ── V1 heuristic fallback ──
  type FieldKind = 'color' | 'palette-ref' | 'number' | 'boolean' | 'string' | 'position' | 'unknown';

  function detectKind(key: string, value: any): FieldKind {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
      if (value.startsWith('$')) return 'palette-ref';
      if (/^#[0-9a-f]{3,8}$/i.test(value)) return 'color';
      return 'string';
    }
    if (typeof value === 'number') {
      if (/^(x|y|anchorX|anchorY|focalX|focalY|waveY)$/.test(key)) return 'position';
      return 'number';
    }
    return 'unknown';
  }

  function guessRange(key: string, value: number): { min: number; max: number; step: number } {
    const k = key.toLowerCase();
    if (k === 'alpha' || k.endsWith('alpha')) return { min: 0, max: 1, step: 0.05 };
    if (k.includes('opacity')) return { min: 0, max: 1, step: 0.05 };
    if (k === 'x' || k === 'y' || k.includes('focal') || k.includes('anchor') || k === 'wavey')
      return { min: 0, max: 1, step: 0.01 };
    if (k.includes('speed') || k.includes('animspeed')) return { min: 0, max: 5, step: 0.1 };
    if (k.includes('fontsize') || k === 'fontsize') return { min: 8, max: 200, step: 1 };
    if (k.includes('count') || k === 'count') return { min: 1, max: 50, step: 1 };
    if (k.includes('size') || k.includes('radius') || k.includes('width') || k.includes('height'))
      return { min: 1, max: 500, step: 1 };
    if (k.includes('spacing') || k.includes('gap') || k.includes('margin'))
      return { min: 0, max: 200, step: 1 };
    if (k.includes('rotation') || k.includes('angle'))
      return { min: -180, max: 180, step: 1 };
    if (k === 'offset' || k.includes('offset'))
      return { min: -100, max: 100, step: 1 };
    if (k.includes('blur')) return { min: 0, max: 20, step: 0.5 };
    if (k.includes('scale')) return { min: 0.1, max: 5, step: 0.1 };
    if (k.includes('amount') || k.includes('intensity'))
      return { min: 0, max: 2, step: 0.05 };
    if (k.includes('delay')) return { min: 0, max: 2, step: 0.01 };
    const magnitude = Math.max(Math.abs(value), 1);
    return { min: 0, max: magnitude * 3, step: magnitude > 10 ? 1 : 0.1 };
  }

  const paletteColors = ['$primary', '$secondary', '$accent', '$text', '$background'];

  function sortedFields(cfg: Record<string, any>): [string, any][] {
    return Object.entries(cfg).filter(([k, v]) => {
      if (k.startsWith('_')) return false;
      if (Array.isArray(v)) return false;
      if (typeof v === 'object' && v !== null) return false;
      return true;
    });
  }

  function label(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim().toLowerCase();
  }

  function handleChange(key: string, value: any) {
    config[key] = value;
    onchange(key, value);
  }
</script>

<div class="config-pane">
  {#if schema && schema.length > 0}
    <!-- ═══ V2 Schema-driven UI ═══ -->
    {#each groupedFields(schema) as group}
      {#if group.group}
        <div class="group-label">{resolveLocalized(group.group)}</div>
      {/if}
      {#each group.fields as field}
        {@const ft = field.type}
        {@const val = config[field.key] ?? ft.default}
        <div class="field">
          {#if ft.kind === 'number' || ft.kind === 'integer'}
            <Slider
              label={resolveLocalized(field.label)}
              value={val as number}
              min={ft.min ?? 0}
              max={ft.max ?? 100}
              step={ft.kind === 'integer' ? 1 : (ft.step ?? 0.01)}
              oninput={(v: number) => handleChange(field.key, v)}
            />

          {:else if ft.kind === 'color'}
            <div class="field-row">
              <span class="field-label">{resolveLocalized(field.label)}</span>
              <div class="color-input-wrap">
                {#if ft.paletteRef && (val as string).startsWith('$')}
                  <select
                    class="pv-select pv-select-compact pv-select-mono"
                    value={val}
                    onchange={(e: Event) => handleChange(field.key, (e.target as HTMLSelectElement).value)}
                  >
                    {#each paletteColors as pc}
                      <option value={pc}>{pc}</option>
                    {/each}
                    <option value="">自定义颜色</option>
                  </select>
                {:else}
                  <input
                    type="color"
                    value={val}
                    oninput={(e: Event) => handleChange(field.key, (e.target as HTMLInputElement).value)}
                    class="color-input"
                  />
                  <span class="color-hex">{val}</span>
                  {#if ft.paletteRef}
                    <button class="palette-switch" onclick={() => handleChange(field.key, '$primary')} title="使用调色板">🎨</button>
                  {/if}
                {/if}
              </div>
            </div>

          {:else if ft.kind === 'string' && ft.options}
            <div class="field-row">
              <span class="field-label">{resolveLocalized(field.label)}</span>
              <select
                class="pv-select pv-select-compact pv-select-mono"
                value={val}
                onchange={(e: Event) => handleChange(field.key, (e.target as HTMLSelectElement).value)}
              >
                {#each ft.options as opt}
                  <option value={opt}>{opt}</option>
                {/each}
              </select>
            </div>

          {:else if ft.kind === 'string' || ft.kind === 'font'}
            <div class="field-row">
              <span class="field-label">{resolveLocalized(field.label)}</span>
              <input
                type="text"
                class="pv-input pv-input-compact pv-control-grow"
                value={val}
                oninput={(e: Event) => handleChange(field.key, (e.target as HTMLInputElement).value)}
              />
            </div>

          {:else if ft.kind === 'boolean'}
            <label class="pv-check-row toggle-field">
              <input
                type="checkbox"
                checked={val}
                onchange={(e: Event) => handleChange(field.key, (e.target as HTMLInputElement).checked)}
              />
              <span class="pv-check-text">{resolveLocalized(field.label)}</span>
            </label>

          {:else if ft.kind === 'vec2'}
            {@const vec = val as [number, number]}
            <Slider
              label={`${resolveLocalized(field.label)} X`}
              value={vec[0]}
              min={ft.min ?? 0}
              max={ft.max ?? 1}
              step={ft.step ?? 0.01}
              oninput={(v: number) => handleChange(field.key, [v, vec[1]])}
            />
            <Slider
              label={`${resolveLocalized(field.label)} Y`}
              value={vec[1]}
              min={ft.min ?? 0}
              max={ft.max ?? 1}
              step={ft.step ?? 0.01}
              oninput={(v: number) => handleChange(field.key, [vec[0], v])}
            />
          {/if}
        </div>
      {/each}
    {/each}

  {:else}
    <!-- ═══ V1 Heuristic fallback ═══ -->
    {#each sortedFields(config) as [key, value]}
      {@const kind = detectKind(key, value)}
      <div class="field">
        {#if kind === 'color'}
          <div class="field-row">
            <span class="field-label">{label(key)}</span>
            <div class="color-input-wrap">
              <input
                type="color"
                value={value}
                oninput={(e: Event) => handleChange(key, (e.target as HTMLInputElement).value)}
                class="color-input"
              />
              <span class="color-hex">{value}</span>
            </div>
          </div>

        {:else if kind === 'palette-ref'}
          <div class="field-row">
            <span class="field-label">{label(key)}</span>
            <select
              class="pv-select pv-select-compact pv-select-mono"
              value={value}
              onchange={(e: Event) => handleChange(key, (e.target as HTMLSelectElement).value)}
            >
              {#each paletteColors as pc}
                <option value={pc}>{pc}</option>
              {/each}
            </select>
          </div>

        {:else if kind === 'number'}
          {@const range = guessRange(key, value as number)}
          <Slider
            label={label(key)}
            value={value as number}
            min={range.min}
            max={range.max}
            step={range.step}
            oninput={(v: number) => handleChange(key, v)}
          />

        {:else if kind === 'position'}
          {@const range = guessRange(key, value as number)}
          <Slider
            label={label(key)}
            value={value as number}
            min={range.min}
            max={range.max}
            step={range.step}
            format={(v: number) => `${(v * 100).toFixed(0)}%`}
            oninput={(v: number) => handleChange(key, v)}
          />

        {:else if kind === 'boolean'}
          <label class="pv-check-row toggle-field">
            <input
              type="checkbox"
              checked={value}
              onchange={(e: Event) => handleChange(key, (e.target as HTMLInputElement).checked)}
            />
            <span class="pv-check-text">{label(key)}</span>
          </label>

        {:else if kind === 'string'}
          <div class="field-row">
            <span class="field-label">{label(key)}</span>
            <input
              type="text"
              class="pv-input pv-input-compact pv-control-grow"
              value={value}
              oninput={(e: Event) => handleChange(key, (e.target as HTMLInputElement).value)}
            />
          </div>
        {/if}
      </div>
    {/each}

    {#if sortedFields(config).length === 0}
      <div class="empty-hint">{t('no_params')}</div>
    {/if}
  {/if}
</div>

<style>
  .config-pane {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field {
    display: flex;
    flex-direction: column;
  }

  .field-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .field-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--pv-text-secondary);
    text-transform: capitalize;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 50%;
  }

  .group-label {
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--pv-text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 6px 0 2px;
    border-top: 1px solid var(--pv-border);
    margin-top: 4px;
  }

  .group-label:first-child {
    border-top: none;
    margin-top: 0;
  }

  /* Color */
  .color-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .color-input {
    -webkit-appearance: none;
    appearance: none;
    width: 28px;
    height: 28px;
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
    padding: 0;
    cursor: pointer;
    background: none;
  }

  .color-input::-webkit-color-swatch-wrapper { padding: 2px; }
  .color-input::-webkit-color-swatch {
    border-radius: 3px;
    border: none;
  }

  .color-hex {
    font-size: 0.65rem;
    font-family: var(--pv-font-mono);
    color: var(--pv-text-muted);
  }

  .palette-switch {
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 0.7rem;
    padding: 0;
    opacity: 0.5;
    transition: opacity 0.15s;
  }
  .palette-switch:hover { opacity: 1; }

  /* Toggle */
  .toggle-field {
    text-transform: capitalize;
  }

  .empty-hint {
    font-size: 0.72rem;
    color: var(--pv-text-muted);
    text-align: center;
    padding: 8px 0;
  }
</style>
