<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<!--
  ColorPickerAlpha — Popup color picker with alpha support.
  Props:
    value    — 8-digit hex (#RRGGBBAA)
    onchange — callback with new 8-digit hex
    open     — bindable open state
    title    — optional popup title
-->
<script lang="ts">
  import 'vanilla-colorful/hex-alpha-color-picker.js';
  import { t } from '../../i18n';

  let {
    value = '#ffffffff',
    onchange = (_value: string) => {},
    open = $bindable(false),
    title = '',
  }: {
    value?: string;
    onchange?: (value: string) => void;
    open?: boolean;
    title?: string;
  } = $props();

  let popoverEl: HTMLDivElement | undefined = $state();
  let hexInputText = $state('');
  let hexInputEl: HTMLInputElement | undefined = $state();
  // Track whether the last change came from the text input to avoid overwriting it
  let inputIsSource = false;

  // Sync input text when value changes from picker (not from input)
  $effect.pre(() => {
    const v = value.replace('#', '');
    if (!inputIsSource) {
      hexInputText = v;
    }
    inputIsSource = false;
  });

  function handlePickerChange(e: CustomEvent<{ value: string }>) {
    onchange(e.detail.value);
  }

  function bindPicker(el: HTMLElement) {
    el.addEventListener('color-changed', handlePickerChange as EventListener);
    return { destroy() { el.removeEventListener('color-changed', handlePickerChange as EventListener); } };
  }

  function handleHexInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value.replace('#', '');
    hexInputText = raw;
    inputIsSource = true;
    if (/^[0-9a-f]{6}$/i.test(raw)) {
      onchange('#' + raw.toLowerCase() + 'ff');
    } else if (/^[0-9a-f]{8}$/i.test(raw)) {
      onchange('#' + raw.toLowerCase());
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (popoverEl && !popoverEl.contains(e.target as Node)) {
      open = false;
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cpa-backdrop" onmousedown={handleBackdropClick}>
    <div class="cpa-popover" bind:this={popoverEl}>
      <div class="cpa-header">
        <span class="cpa-title">{title || t('canvas_custom_color')}</span>
        <button class="close-btn" type="button" onclick={() => open = false}>✕</button>
      </div>
      <hex-alpha-color-picker
        color={value}
        use:bindPicker
      ></hex-alpha-color-picker>
      <div class="cpa-input-row">
        <div class="cpa-preview-wrap">
          <div class="cpa-preview" style="background:{value}"></div>
        </div>
        <input
          class="cpa-hex-input"
          type="text"
          bind:this={hexInputEl}
          value={hexInputText}
          maxlength="9"
          spellcheck="false"
          oninput={handleHexInput}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .cpa-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9998;
  }

  .cpa-popover {
    position: fixed;
    z-index: 9999;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 240px;
    padding: 12px;
    background: rgba(20, 20, 30, 0.96);
    backdrop-filter: blur(24px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .cpa-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .cpa-title {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--pv-text, #e8e8f0);
  }

  /* Reuse TemplateEditor close-btn style */
  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: var(--pv-radius-sm, 6px);
    border: 1px solid var(--pv-border, rgba(255, 255, 255, 0.06));
    background: transparent;
    color: var(--pv-text-secondary, rgba(255, 255, 255, 0.55));
    font-size: 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .close-btn:hover {
    background: var(--pv-bg-hover, rgba(40, 40, 60, 0.6));
    color: var(--pv-text, #e8e8f0);
  }

  .cpa-popover :global(hex-alpha-color-picker) {
    width: 100%;
    height: 160px;
    gap: 6px;
  }

  .cpa-popover :global(hex-alpha-color-picker)::part(saturation) {
    border-radius: 8px;
  }

  .cpa-popover :global(hex-alpha-color-picker)::part(hue),
  .cpa-popover :global(hex-alpha-color-picker)::part(alpha) {
    border-radius: 5px;
    height: 12px;
  }

  .cpa-popover :global(hex-alpha-color-picker)::part(saturation-pointer),
  .cpa-popover :global(hex-alpha-color-picker)::part(hue-pointer),
  .cpa-popover :global(hex-alpha-color-picker)::part(alpha-pointer) {
    width: 18px;
    height: 18px;
  }

  .cpa-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cpa-preview-wrap {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    flex-shrink: 0;
    overflow: hidden;
    background-image:
      linear-gradient(45deg, #555 25%, transparent 25%),
      linear-gradient(-45deg, #555 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #555 75%),
      linear-gradient(-45deg, transparent 75%, #555 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .cpa-preview {
    width: 100%;
    height: 100%;
  }

  .cpa-hex-input {
    flex: 1;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    font-size: 0.78rem;
    font-family: var(--pv-font-mono, 'JetBrains Mono', monospace);
    color: #e8e8f0;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 6px 10px;
    outline: none;
    transition: border-color 0.15s;
  }

  .cpa-hex-input:focus {
    border-color: rgba(107, 138, 255, 0.5);
  }
</style>
