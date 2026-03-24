<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import Slider from '../common/Slider.svelte';
  import { t } from '../../i18n';

  let {
    config = $bindable<Record<string, any>>({}),
    onchange = (_key: string, _value: any) => {},
  } = $props();

  // ── Value type detection ──
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

  // ── Slider range heuristics ──
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
    // Generic: center around current value
    const magnitude = Math.max(Math.abs(value), 1);
    return { min: 0, max: magnitude * 3, step: magnitude > 10 ? 1 : 0.1 };
  }

  // ── Palette reference options ──
  const paletteColors = ['$primary', '$secondary', '$accent', '$text', '$background'];

  // ── Sortable field list ──
  function sortedFields(cfg: Record<string, any>): [string, any][] {
    const entries = Object.entries(cfg);
    // Filter out complex objects/arrays and internal keys
    return entries.filter(([k, v]) => {
      if (k.startsWith('_')) return false;
      if (Array.isArray(v)) return false;
      if (typeof v === 'object' && v !== null) return false;
      return true;
    });
  }

  // ── Readable label ──
  function label(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .trim()
      .toLowerCase();
  }

  function handleChange(key: string, value: any) {
    config[key] = value;
    onchange(key, value);
  }
</script>

<div class="config-pane">
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
            class="mini-select"
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
        <label class="toggle-field">
          <input
            type="checkbox"
            checked={value}
            onchange={(e: Event) => handleChange(key, (e.target as HTMLInputElement).checked)}
          />
          <span>{label(key)}</span>
        </label>

      {:else if kind === 'string'}
        <div class="field-row">
          <span class="field-label">{label(key)}</span>
          <input
            type="text"
            class="text-field"
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

  /* Select */
  .mini-select {
    padding: 3px 6px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.72rem;
    font-family: var(--pv-font-mono);
    cursor: pointer;
    outline: none;
  }

  .mini-select option {
    background: #1a1a2e;
  }

  /* Text */
  .text-field {
    flex: 1;
    min-width: 0;
    padding: 3px 8px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.72rem;
    font-family: inherit;
    outline: none;
    transition: border-color var(--pv-duration);
  }
  .text-field:focus { border-color: var(--pv-border-focus); }

  /* Toggle */
  .toggle-field {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.72rem;
    color: var(--pv-text-secondary);
    cursor: pointer;
    text-transform: capitalize;
  }
  .toggle-field input[type="checkbox"] {
    accent-color: var(--pv-accent);
    cursor: pointer;
  }

  .empty-hint {
    font-size: 0.72rem;
    color: var(--pv-text-muted);
    text-align: center;
    padding: 8px 0;
  }
</style>
