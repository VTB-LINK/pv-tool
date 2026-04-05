<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import ColorValueControl from '../common/ColorValueControl.svelte';
  import Slider from '../common/Slider.svelte';
  import StringArrayValueControl from '../common/StringArrayValueControl.svelte';
  import { t } from '../../i18n';
  import type { ConfigField } from '../../effects/v2/schema';
  import { resolveLocalized } from '../../effects/v2/schema';
  import { getEditableStringArrayConfigEntries, getScalarConfigEntries } from '../../services/effectConfigFields';

  let {
    config = $bindable<Record<string, any>>({}),
    onchange = (_key: string, _value: any) => {},
    schema = undefined as ConfigField[] | undefined,
    effectType = '',
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

  const paletteColors = ['$primary', '$secondary', '$accent', '$text', '$background', '$line'];

  function getDefaultPaletteValue(value: unknown): string {
    return typeof value === 'string' && value.startsWith('$') ? value : '$primary';
  }

  function getDefaultCustomColor(value: unknown): string {
    return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : '#ffffff';
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
              <span class="field-label" title={resolveLocalized(field.label)}>{resolveLocalized(field.label)}</span>
              <ColorValueControl
                value={val as string}
                allowPalette={Boolean(ft.paletteRef)}
                paletteOptions={paletteColors}
                defaultPaletteValue={getDefaultPaletteValue(ft.default)}
                defaultCustomValue={getDefaultCustomColor(ft.default)}
                onchange={(nextValue: string) => handleChange(field.key, nextValue)}
              />
            </div>

          {:else if ft.kind === 'string' && ft.options}
            <div class="field-row">
              <span class="field-label" title={resolveLocalized(field.label)}>{resolveLocalized(field.label)}</span>
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
              <span class="field-label" title={resolveLocalized(field.label)}>{resolveLocalized(field.label)}</span>
              <input
                type="text"
                class="pv-input pv-input-compact pv-control-grow"
                value={val}
                oninput={(e: Event) => handleChange(field.key, (e.target as HTMLInputElement).value)}
              />
            </div>

          {:else if ft.kind === 'boolean'}
            <label class="field-row toggle-field">
              <span class="field-label" title={resolveLocalized(field.label)}>{resolveLocalized(field.label)}</span>
              <input
                type="checkbox"
                checked={val}
                onchange={(e: Event) => handleChange(field.key, (e.target as HTMLInputElement).checked)}
              />
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

    {#each getEditableStringArrayConfigEntries(effectType, config) as arrayField}
      <div class="field-card">
        <span class="field-card-label">{arrayField.label}</span>
        <StringArrayValueControl
          value={arrayField.value}
          options={arrayField.options}
          allowCustom={arrayField.allowCustom}
          onchange={(nextValue: string[]) => handleChange(arrayField.key, nextValue)}
        />
      </div>
    {/each}

  {:else}
    <!-- ═══ V1 Heuristic fallback ═══ -->
    {#each getScalarConfigEntries(config) as [key, value]}
      {@const kind = detectKind(key, value)}
      <div class="field">
        {#if kind === 'color' || kind === 'palette-ref'}
          <div class="field-row">
            <span class="field-label" title={label(key)}>{label(key)}</span>
            <ColorValueControl
              value={value as string}
              allowPalette={true}
              paletteOptions={paletteColors}
              defaultPaletteValue={getDefaultPaletteValue(value)}
              defaultCustomValue={getDefaultCustomColor(value)}
              onchange={(nextValue: string) => handleChange(key, nextValue)}
            />
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
          <label class="field-row toggle-field">
            <span class="field-label" title={label(key)}>{label(key)}</span>
            <input
              type="checkbox"
              checked={value}
              onchange={(e: Event) => handleChange(key, (e.target as HTMLInputElement).checked)}
            />
          </label>

        {:else if kind === 'string'}
          <div class="field-row">
            <span class="field-label" title={label(key)}>{label(key)}</span>
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

    {#each getEditableStringArrayConfigEntries(effectType, config) as arrayField}
      <div class="field-card">
        <span class="field-card-label">{arrayField.label}</span>
        <StringArrayValueControl
          value={arrayField.value}
          options={arrayField.options}
          allowCustom={arrayField.allowCustom}
          onchange={(nextValue: string[]) => handleChange(arrayField.key, nextValue)}
        />
      </div>
    {/each}

    {#if getScalarConfigEntries(config).length === 0 && getEditableStringArrayConfigEntries(effectType, config).length === 0}
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

  /* Toggle */
  .toggle-field {
    cursor: pointer;
  }

  .toggle-field input[type="checkbox"] {
    flex-shrink: 0;
    accent-color: var(--pv-accent);
    cursor: pointer;
    width: 16px;
    height: 16px;
  }

  .empty-hint {
    font-size: 0.72rem;
    color: var(--pv-text-muted);
    text-align: center;
    padding: 8px 0;
  }

  /* Card layout for complex (array) fields */
  .field-card {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--pv-border);
    border-radius: 6px;
    padding: 6px 8px;
  }

  .field-card-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--pv-text-secondary);
    text-transform: capitalize;
    white-space: nowrap;
    flex-shrink: 0;
  }
</style>
