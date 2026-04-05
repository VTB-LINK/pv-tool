<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import { t } from '../../i18n';

  type ColorMode = 'palette' | 'custom';

  let {
    value = '#ffffff',
    onchange = (_value: string) => {},
    allowPalette = false,
    paletteOptions = ['$primary', '$secondary', '$accent', '$text', '$background', '$line'],
    defaultPaletteValue = '$primary',
    defaultCustomValue = '#ffffff',
  }: {
    value?: string;
    onchange?: (value: string) => void;
    allowPalette?: boolean;
    paletteOptions?: string[];
    defaultPaletteValue?: string;
    defaultCustomValue?: string;
  } = $props();

  function isPaletteRef(input: unknown): input is string {
    return typeof input === 'string' && input.startsWith('$');
  }

  function isHexColor(input: unknown): input is string {
    return typeof input === 'string' && /^#[0-9a-f]{3,8}$/i.test(input);
  }

  let lastPaletteValue = $state('$primary');
  let lastCustomValue = $state('#ffffff');

  $effect(() => {
    if (isPaletteRef(defaultPaletteValue) && !isPaletteRef(lastPaletteValue)) {
      lastPaletteValue = defaultPaletteValue;
    }
    if (isHexColor(defaultCustomValue) && !isHexColor(lastCustomValue)) {
      lastCustomValue = defaultCustomValue;
    }
  });

  $effect(() => {
    if (isPaletteRef(value)) {
      lastPaletteValue = value;
    } else if (isHexColor(value)) {
      lastCustomValue = value;
    }
  });

  const mode = $derived<ColorMode>(allowPalette && isPaletteRef(value) ? 'palette' : 'custom');
  const paletteValue = $derived(isPaletteRef(value) ? value : lastPaletteValue);
  const customValue = $derived(isHexColor(value) ? value : lastCustomValue);

  function emit(valueToApply: string) {
    onchange(valueToApply);
  }

  function handleModeChange(nextMode: ColorMode) {
    if (nextMode === 'palette') {
      emit(lastPaletteValue);
      return;
    }
    emit(lastCustomValue);
  }

  function handlePaletteChange(nextValue: string) {
    lastPaletteValue = nextValue;
    emit(nextValue);
  }

  function handleCustomChange(nextValue: string) {
    lastCustomValue = nextValue;
    emit(nextValue);
  }
</script>

<div class="color-value-control">
  {#if allowPalette}
    <select
      class="pv-select pv-select-compact color-mode-select"
      value={mode}
      onchange={(e: Event) => handleModeChange((e.target as HTMLSelectElement).value as ColorMode)}
    >
      <option value="palette">{t('color_mode_palette')}</option>
      <option value="custom">{t('color_mode_custom')}</option>
    </select>
  {/if}

  {#if !allowPalette || mode === 'custom'}
    <input
      type="color"
      value={customValue}
      oninput={(e: Event) => handleCustomChange((e.target as HTMLInputElement).value)}
      class="color-input"
    />
    <span class="color-hex">{customValue}</span>
  {:else}
    <select
      class="pv-select pv-select-compact pv-select-mono palette-select"
      value={paletteValue}
      onchange={(e: Event) => handlePaletteChange((e.target as HTMLSelectElement).value)}
    >
      {#each paletteOptions as paletteOption}
        <option value={paletteOption}>{paletteOption}</option>
      {/each}
    </select>
  {/if}
</div>

<style>
  .color-value-control {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 6px;
  }

  .color-mode-select {
    min-width: 74px;
    font-family: inherit;
  }

  .palette-select {
    min-width: 92px;
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
</style>