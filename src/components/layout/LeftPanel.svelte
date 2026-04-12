<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import SegmentedControl from '../common/SegmentedControl.svelte';
  import Section from '../common/Section.svelte';
  import SelectMenu from '../common/SelectMenu.svelte';
  import FontSelectMenu from '../common/FontSelectMenu.svelte';
  import Slider from '../common/Slider.svelte';
  import UnsavedChangesDialog from '../common/UnsavedChangesDialog.svelte';
  import TemplateDiffDialog from '../editor/TemplateDiffDialog.svelte';
  import ColorPickerAlpha from '../common/ColorPickerAlpha.svelte';
  import type { SegmentedControlOption, SelectMenuOption } from '../common/options';
  import {
    engine, selectTemplate, selectCustomTemplate, enterCustomMode,
    setText, setSegmentDuration, setAnimationSpeed, setMotionIntensity,
    setEffectOpacity, setBpm, setBeatReactivity, setCanvasColor, setAlphaMode, setFontFamily, setFontLocked, resetFont,
    loadMedia, loadAudio, loadLyrics, selectLyricsSource,
    clearMedia, clearAudio, clearLyrics, showToast,
    captureEditingSessionSnapshot, getCurrentTemplateConfig, loadTemplateWithOptions,
    restoreEditingSessionSnapshot, getResetBaselineConfig,
  } from '../../stores/engine.svelte';
  import { isLocalFontApiSupported, getLocalFontInfos, parsePrimaryFont, getLocalizedFontName } from '../../services/fontService';
  import type { FontInfo } from '../../services/fontService';
  import type { MissingMode } from '../../stores/engine.svelte';
  import { templates } from '../../templates';
  import { t } from '../../i18n';
  import type { TemplateConfig } from '../../types/engine';

  let {
    onOpenEditor = () => {},
    onRequestTemplateGuide = () => {},
    flashEditBtn = false,
  }: {
    onOpenEditor?: () => void;
    onRequestTemplateGuide?: () => void;
    flashEditBtn?: boolean;
  } = $props();

  let textInput = $state(engine.text);
  let textTimer: ReturnType<typeof setTimeout>;
  let textExpanded = $state(false);
  let mediaInput: HTMLInputElement;
  let audioInput: HTMLInputElement;
  let lyricsInput: HTMLInputElement;

  // Edit button flash animation
  let editBtnFlashing = $state(false);

  // Font selector state
  let fontDropdownOpen = $state(false);
  let localFonts = $state<FontInfo[]>([]);
  let localFontsLoaded = $state(false);
  let fontCustomMode = $state(false);
  let fontCustomInput = $state('');
  let fontCustomTimer: ReturnType<typeof setTimeout>;

  // Diff dialog for template selection (builtin & custom)
  let diffVisible = $state(false);
  let diffIncoming = $state<TemplateConfig | null>(null);
  let pendingDiffType = $state<'builtin' | 'custom' | null>(null);
  let pendingDiffIndex = $state(-1);
  let previousEditingSession = $state<import('../../stores/engine.svelte').EditingSessionSnapshot | null>(null);

  // Unsaved changes confirmation
  let confirmVisible = $state(false);
  let pendingAction = $state<(() => void) | null>(null);

  function guardSwitch(action: () => void) {
    if (engine.customDirty) {
      pendingAction = action;
      confirmVisible = true;
    } else {
      action();
    }
  }

  function handleConfirmDiscard() {
    confirmVisible = false;
    pendingAction?.();
    pendingAction = null;
  }

  function handleConfirmCancel() {
    confirmVisible = false;
    pendingAction = null;
  }

  function handleConfirmSave() {
    confirmVisible = false;
    if (pendingAction) onRequestTemplateGuide();
    pendingAction = null;
  }

  function showTemplateDiff(type: 'builtin' | 'custom', index: number) {
    const tpl = type === 'builtin' ? templates[index] : engine.customTemplates[index];
    if (!tpl) {
      if (type === 'builtin') selectTemplate(index);
      else selectCustomTemplate(index);
      return;
    }
    // Save current template state before showing diff
    previousEditingSession = captureEditingSessionSnapshot();
    diffIncoming = tpl;
    diffMissingMode = tpl.baseTemplateName ? 'builtin' : 'reset';
    pendingDiffType = type;
    pendingDiffIndex = index;
    diffVisible = true;
  }

  // ── Diff dialog logic ──
  let diffMissingMode = $state<MissingMode>('reset');

  function closeDiff() {
    restoreEditingSessionSnapshot(previousEditingSession);
    diffVisible = false;
    diffIncoming = null;
    pendingDiffType = null;
    pendingDiffIndex = -1;
    previousEditingSession = null;
  }

  function confirmDiff() {
    if (!diffIncoming || pendingDiffIndex < 0) return;
    if (pendingDiffType === 'builtin') {
      loadTemplateWithOptions(diffIncoming, { missingMode: diffMissingMode, builtinIndex: pendingDiffIndex });
    } else {
      loadTemplateWithOptions(diffIncoming, { missingMode: diffMissingMode, customIndex: pendingDiffIndex });
    }
    diffIncoming = null;
    pendingDiffType = null;
    pendingDiffIndex = -1;
    diffVisible = false;
    previousEditingSession = null;
  }

  function triggerFlash() {
    editBtnFlashing = true;
  }

  // Watch external flashEditBtn prop
  $effect(() => {
    if (flashEditBtn) triggerFlash();
  });

  let selectedValue = $derived(
    engine.isCustomMode ? 'custom'
    : engine.loadedCustomIndex >= 0 ? `user-${engine.loadedCustomIndex}`
    : String(engine.currentTemplateIndex)
  );

  let templateDropdownOpen = $state(false);
  let templateOptions = $derived<SelectMenuOption[]>([
    ...templates.map((tpl, i) => ({ value: String(i), label: tplName(tpl) })),
    ...engine.customTemplates.map((tpl, i) => ({ value: `user-${i}`, label: `⭐ ${tpl.name}` })),
    { value: 'custom', label: t('custom') },
  ]);
  let lyricsSourceOptions = $derived<SegmentedControlOption[]>([
    { value: 'embedded', label: t('use_embedded') },
    { value: 'file', label: t('use_file') },
  ]);

  // Canvas color: custom picker state
  let customCanvasColor = $state('#ff000080');
  let customPickerOpen = $state(false);
  let isCustomCanvasActive = $state(false);
  let isTransparentActive = $derived(engine.alphaMode);
  // Remember the last non-zero alpha so we can restore it when alphaMode is toggled off
  let lastNonZeroAlpha = 'ff';

  // When engine.canvasColor is reset externally (e.g. template switch), sync UI state
  $effect(() => {
    if (engine.canvasColor === null && !engine.alphaMode) {
      isCustomCanvasActive = false;
      customPickerOpen = false;
    }
  });

  // Sync custom color picker when alphaMode is toggled externally (e.g. export checkbox)
  $effect(() => {
    if (isCustomCanvasActive && customPickerOpen) {
      if (engine.alphaMode) {
        // Set picker to fully transparent
        customCanvasColor = customCanvasColor.slice(0, 7) + '00';
      } else {
        // Restore previous alpha
        customCanvasColor = customCanvasColor.slice(0, 7) + lastNonZeroAlpha;
      }
    }
  });

  const canvasColors = [
    { color: null, label: 'A', title: t('follow_template') },
    { color: '#ffffff', title: t('white') },
    { color: '#000000', title: t('black') },
    { color: '#1122ee', title: t('blue') },
    { color: '#8b1a1a', title: t('red') },
    { color: '#EEDD11', title: t('yellow') },
    { color: '#f5c6d0', title: t('pink') },
  ];

  function handleCustomCanvasClick() {
    customPickerOpen = !customPickerOpen;
    if (!customPickerOpen) return;
    isCustomCanvasActive = true;
    setAlphaMode(false);
    applyCustomCanvasColor(customCanvasColor);
  }

  function handleTransparentClick() {
    isCustomCanvasActive = false;
    customPickerOpen = false;
    setAlphaMode(true);
    setCanvasColor(null);
  }

  function handlePresetClick(color: string | null) {
    isCustomCanvasActive = false;
    customPickerOpen = false;
    setAlphaMode(false);
    setCanvasColor(color);
  }

  function applyCustomCanvasColor(hex8: string) {
    customCanvasColor = hex8;
    // Extract alpha from 8-digit hex
    const alphaByte = parseInt(hex8.slice(7, 9), 16);
    const alpha = alphaByte / 255;
    if (alpha > 0) {
      lastNonZeroAlpha = hex8.slice(7, 9);
    }
    // Set alpha mode FIRST, then canvas color — otherwise alphaMode setter resets alpha to 1
    if (alpha === 0) {
      setAlphaMode(true);
    } else {
      setAlphaMode(false);
    }
    setCanvasColor(hex8);
  }

  function getSelectedTemplateLabel(): string {
    if (engine.isCustomMode) return t('custom');
    if (engine.loadedCustomIndex >= 0) {
      return engine.customTemplates[engine.loadedCustomIndex]?.name ?? t('custom');
    }
    return tplName(templates[engine.currentTemplateIndex]);
  }

  function handleTemplatePick(val: string) {
    if (val === 'custom') {
      enterCustomMode();
      showToast(t('custom_mode_hint'));
      triggerFlash();
      onOpenEditor();
    } else if (val.startsWith('user-')) {
      guardSwitch(() => showTemplateDiff('custom', parseInt(val.split('-')[1])));
    } else {
      guardSwitch(() => showTemplateDiff('builtin', parseInt(val)));
    }
    templateDropdownOpen = false;
  }

  function handleTextInput() {
    clearTimeout(textTimer);
    textTimer = setTimeout(() => setText(textInput), 400);
  }

  function tplName(tpl: any): string {
    if (tpl.nameKey) return t(tpl.nameKey as any);
    return tpl.name;
  }

  // ── Font selector logic ──
  let fontSelectedValue = $derived(
    fontCustomMode ? '__custom__'
    : engine.fontFamily ? engine.fontFamily
    : ''
  );

  function getFontSelectedLabel(): string {
    if (fontCustomMode) return t('font_custom_input');
    if (engine.fontFamily) {
      const primary = parsePrimaryFont(engine.fontFamily);
      return getLocalizedFontName(primary);
    }
    return t('follow_template');
  }

  function handleFontPick(val: string) {
    fontDropdownOpen = false;
    if (val === '__custom__') {
      fontCustomMode = true;
      fontCustomInput = engine.fontFamily ?? '';
      return;
    }
    fontCustomMode = false;
    setFontFamily(val || null);
  }

  async function handleLoadLocalFonts() {
    const fonts = await getLocalFontInfos(true);
    localFonts = fonts;
    localFontsLoaded = true;
    if (fonts.length === 0) {
      showToast(t('load_local_fonts') + ' — 0');
    }
  }

  function handleFontCustomInput() {
    clearTimeout(fontCustomTimer);
    fontCustomTimer = setTimeout(() => {
      setFontFamily(fontCustomInput.trim() || null);
    }, 400);
  }

  function canResetFont(): boolean {
    const base = getResetBaselineConfig();
    return (engine.fontFamily ?? '') !== (base?.fontFamily ?? '');
  }

  function handleResetFont() {
    if (!canResetFont()) return;
    resetFont();
    showToast(t('font_reset'));
  }

  async function handleMediaFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await loadMedia(file, 'fit');
    }
    input.value = '';
  }

  async function handleAudioFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await loadAudio(file);
    input.value = '';
  }

  async function handleLyricsFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await loadLyrics(file);
    input.value = '';
  }
</script>

<div class="panel left-panel">
  <!-- Template -->
  <Section label={t('template')}>
    <div class="template-row">
      <div class="template-select">
        <SelectMenu
          items={templateOptions}
          selectedLabel={getSelectedTemplateLabel()}
          {selectedValue}
          bind:open={templateDropdownOpen}
          ariaLabel={t('template')}
          onSelect={handleTemplatePick}
        />
      </div>
      <button class="pv-btn pv-btn-sm btn btn-sm edit-btn" class:flashing={editBtnFlashing} onclick={() => onOpenEditor()} onanimationend={() => editBtnFlashing = false} title={t('open_editor')}>🎨</button>
    </div>
  </Section>

  <!-- Canvas Color -->
  <Section label={t('canvas_color')}>
    <div class="color-swatches">
      <div class="swatch-row">
        <!-- A: Follow template -->
        <button
          class="swatch"
          class:active={engine.canvasColor === null && !isCustomCanvasActive && !isTransparentActive}
          title={t('follow_template')}
          onclick={() => handlePresetClick(null)}
        >
          <span class="swatch-auto">A</span>
        </button>

        <!-- Custom color -->
        <button
          class="swatch"
          class:active={isCustomCanvasActive}
          title={t('canvas_custom')}
          style="background:{customCanvasColor}"
          onclick={handleCustomCanvasClick}
        >
          <span class="swatch-emoji">🎨</span>
        </button>

        <!-- Transparent -->
        <button
          class="swatch swatch-checker"
          class:active={isTransparentActive && !isCustomCanvasActive}
          title={t('canvas_transparent')}
          onclick={handleTransparentClick}
        >
          <span class="swatch-label">◇</span>
        </button>
      </div>

      <div class="swatch-row">
        <!-- Preset colors -->
        {#each canvasColors.slice(1) as swatch}
          <button
            class="swatch"
            class:active={engine.canvasColor === swatch.color && !isCustomCanvasActive && !isTransparentActive}
            title={swatch.title}
            style="background:{swatch.color}"
            onclick={() => handlePresetClick(swatch.color)}
          ></button>
        {/each}
      </div>
    </div>

    <!-- Custom color picker popup -->
    <ColorPickerAlpha
      value={customCanvasColor}
      onchange={applyCustomCanvasColor}
      bind:open={customPickerOpen}
    />
  </Section>

  <!-- Font Family -->
  <Section label={t('font_family')} open={false}>
    <div class="font-row">
      <div class="font-select">
        <FontSelectMenu
          fonts={localFonts}
          selectedLabel={getFontSelectedLabel()}
          selectedValue={fontSelectedValue}
          bind:open={fontDropdownOpen}
          ariaLabel={t('font_family')}
          onSelect={handleFontPick}
        />
      </div>
      {#if isLocalFontApiSupported()}
        <button class="pv-btn pv-btn-sm btn btn-sm font-load-btn" onclick={handleLoadLocalFonts} title={t('load_local_fonts')}>
          {localFontsLoaded ? '🔄' : '📂'}
        </button>
      {/if}
    </div>
    {#if fontCustomMode}
      <input
        class="pv-input pv-control-full font-custom-input"
        type="text"
        placeholder='"Noto Sans JP", sans-serif'
        bind:value={fontCustomInput}
        oninput={handleFontCustomInput}
      />
    {/if}
    <div class="font-actions">
      <label class="pv-check-row pv-check-row-md toggle-row">
        <input type="checkbox" checked={engine.fontLocked} onchange={(e: Event) => setFontLocked((e.target as HTMLInputElement).checked)} />
        <span class="pv-check-text" title={t('font_lock')}>🔒 {t('font_lock')}</span>
      </label>
      <button class="pv-btn pv-btn-sm btn btn-sm font-reset-btn"
        title={canResetFont() ? `⚠ ${t('font_reset')}` : undefined}
        disabled={!canResetFont()}
        onclick={handleResetFont}>↺ {t('font_reset')}</button>
    </div>
  </Section>

  <!-- Text -->
  <Section label={t('text_label')}>
    <textarea
      class="pv-input pv-control-full text-input"
      class:expanded={textExpanded}
      rows={textExpanded ? 6 : 1}
      placeholder="深夜東京/の6畳半夢"
      bind:value={textInput}
      oninput={handleTextInput}
      onfocus={() => textExpanded = true}
      onblur={() => textExpanded = false}
    ></textarea>
  </Section>

  <!-- Sliders -->
  <Section label={t('template')}>
    <Slider
      label={t('seg_duration')}
      value={engine.segmentDuration}
      min={1} max={10} step={0.5}
      format={(v: number) => `${v.toFixed(1)}s`}
      oninput={setSegmentDuration}
    />
    <Slider
      label={t('anim_speed')}
      value={engine.animationSpeed}
      min={0} max={4} step={0.1}
      format={(v: number) => `${v.toFixed(1)}x`}
      oninput={setAnimationSpeed}
    />
    <Slider
      label={t('motion_intensity')}
      value={engine.motionIntensity}
      min={0} max={2} step={0.1}
      format={(v: number) => `${v.toFixed(1)}x`}
      oninput={setMotionIntensity}
    />
    <Slider
      label={t('bg_opacity')}
      value={engine.effectOpacity}
      min={0} max={1} step={0.05}
      format={(v: number) => `${Math.round(v * 100)}%`}
      oninput={setEffectOpacity}
    />
  </Section>

  <!-- Media -->
  <Section label={t('media')}>
    <div class="file-row">
      <button class="pv-btn pv-btn-sm btn btn-sm" onclick={() => mediaInput.click()}>
        {t('choose_file')}
      </button>
      <span class="file-name" title={engine.mediaFileName || ''}>{engine.mediaFileName || t('no_file')}</span>
      <span class="format-hint" title="PNG, JPG, GIF, WebP, MP4, WebM">?</span>
      {#if engine.mediaLoaded}
        <button class="btn-clear" onclick={() => { clearMedia(); if (mediaInput) mediaInput.value = ''; }} title="Clear">×</button>
      {/if}
      <input bind:this={mediaInput} type="file" accept="image/*,video/mp4,video/webm" hidden onchange={handleMediaFile} />
    </div>
  </Section>

  <!-- Audio -->
  <Section label={t('audio')}>
    <div class="file-row">
      <button class="pv-btn pv-btn-sm btn btn-sm" onclick={() => audioInput.click()}>
        {t('choose_file')}
      </button>
      <span class="file-name" title={engine.audioFileName || ''}>{engine.audioFileName || t('no_file')}</span>
      <span class="format-hint" title="MP3, WAV, OGG, FLAC, AAC, M4A">?</span>
      {#if engine.audioLoaded}
        <button class="btn-clear" onclick={() => { clearAudio(); if (audioInput) audioInput.value = ''; }} title="Clear">×</button>
      {/if}
      <input bind:this={audioInput} type="file" accept="audio/*" hidden onchange={handleAudioFile} />
    </div>
  </Section>

  <!-- Lyrics -->
  <Section label={t('lyrics')}>
    <div class="file-row">
      <button class="pv-btn pv-btn-sm btn btn-sm" onclick={() => lyricsInput.click()}>
        {t('choose_file')}
      </button>
      <span class="file-name" title={engine.lyricsFileName || ''}>{engine.lyricsFileName || t('no_file')}</span>
      <span class="format-hint" title="LRC, SRT, ASS, SSA">?</span>
      {#if engine.lyricsLoaded && engine.embeddedLyricsSource !== 'embedded'}
        <button class="btn-clear" onclick={() => { clearLyrics(); if (lyricsInput) lyricsInput.value = ''; }} title="Clear">×</button>
      {/if}
      <input bind:this={lyricsInput} type="file" accept=".lrc,.srt,.ass,.ssa" hidden onchange={handleLyricsFile} />
    </div>
    {#if engine.embeddedLyricsRaw}
      <div class="embedded-lyrics-bar">
        <span class="embedded-label">{t('embedded_lyrics_found')}</span>
        <SegmentedControl
          items={lyricsSourceOptions}
          selectedValue={engine.embeddedLyricsSource === 'embedded' ? 'embedded' : 'file'}
          onSelect={(value: string) => {
            if (value === 'embedded') {
              selectLyricsSource('embedded');
            } else if (engine.hasFileLyrics) {
              selectLyricsSource('file');
            } else {
              lyricsInput.click();
            }
          }}
        />
      </div>
    {/if}
  </Section>

  <!-- BPM & Beat -->
  <Section label={t('bpm')}>
    <Slider
      label={t('bpm')}
      value={engine.bpm}
      min={30} max={240} step={1}
      format={(v: number) => String(Math.round(v))}
      oninput={setBpm}
    />
    <Slider
      label={t('beat_react')}
      value={engine.beatReactivity}
      min={0} max={1} step={0.05}
      format={(v: number) => v.toFixed(2)}
      oninput={setBeatReactivity}
    />
  </Section>
</div>

<TemplateDiffDialog
  visible={diffVisible}
  currentConfig={diffVisible ? getCurrentTemplateConfig() : null}
  incomingConfig={diffIncoming}
  missingMode={diffMissingMode}
  onMissingModeChange={(mode: MissingMode) => diffMissingMode = mode}
  onClose={closeDiff}
  onConfirm={confirmDiff}
/>

<UnsavedChangesDialog
  visible={confirmVisible}
  onSave={handleConfirmSave}
  onConfirm={handleConfirmDiscard}
  onCancel={handleConfirmCancel}
/>

<style>
  .panel {
    background: var(--pv-bg-surface);
    backdrop-filter: blur(20px) saturate(1.4);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-lg);
    padding: 16px;
    width: var(--pv-panel-width);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: var(--pv-shadow);
    transition: opacity var(--pv-duration-slow) var(--pv-ease);
  }

  .template-row {
    display: flex;
    gap: 6px;
    align-items: stretch;
  }
  .template-select {
    flex: 1;
    min-width: 0;
  }
  .edit-btn {
    flex-shrink: 0;
    font-size: 0.85rem !important;
    min-width: 42px;
    padding: 0 10px !important;
    border-radius: var(--pv-radius-sm) !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .edit-btn.flashing {
    animation: flash-glow 0.5s ease 3;
  }

  @keyframes flash-glow {
    0%, 100% { box-shadow: none; transform: scale(1); }
    50% { box-shadow: 0 0 10px 3px var(--pv-accent); transform: scale(1.15); }
  }
  .text-input {
    resize: none;
    overflow: hidden;
    transition: height 0.2s var(--pv-ease);
  }

  .text-input.expanded { overflow-y: auto; }

  /* Color swatches */
  .color-swatches {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .swatch-row {
    display: flex;
    gap: 6px;
  }

  .swatch {
    width: 28px;
    height: 28px;
    border-radius: var(--pv-radius-sm);
    border: 2px solid var(--pv-border);
    cursor: pointer;
    padding: 0;
    position: relative;
    transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .swatch:hover {
    border-color: var(--pv-border-hover);
    transform: scale(1.1);
  }

  .swatch.active {
    border-color: var(--pv-accent);
    box-shadow: var(--pv-glow);
  }

  .swatch-auto {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--pv-text-secondary);
    background: linear-gradient(135deg, #222 50%, #666 50%);
    border-radius: 4px;
    pointer-events: none;
  }

  .swatch-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--pv-text-secondary);
    border-radius: 4px;
    pointer-events: none;
  }

  .swatch-emoji {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 0.85rem;
    border-radius: 4px;
    pointer-events: none;
  }

  /* Checkerboard pattern for transparent swatch */
  .swatch-checker {
    background-image:
      linear-gradient(45deg, #808080 25%, transparent 25%),
      linear-gradient(-45deg, #808080 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #808080 75%),
      linear-gradient(-45deg, transparent 75%, #808080 75%) !important;
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
  }

  /* Font selector */
  .font-row {
    display: flex;
    gap: 6px;
    align-items: stretch;
  }
  .font-select {
    flex: 1;
    min-width: 0;
  }
  .font-load-btn {
    flex-shrink: 0;
    font-size: 0.85rem !important;
    min-width: 42px;
    padding: 0 10px !important;
    border-radius: var(--pv-radius-sm) !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .font-custom-input {
    margin-top: 6px;
    font-size: 0.78rem;
  }

  .font-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
  }
  .font-actions .toggle-row {
    flex: 1;
    min-width: 0;
  }
  .font-actions .toggle-row span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .font-reset-btn {
    flex-shrink: 0;
    font-size: 0.7rem !important;
    padding: 3px 8px !important;
    opacity: 0.7;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  .font-reset-btn:hover { opacity: 1; }
  .font-reset-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* File row */
  .file-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .file-name {
    font-size: 0.72rem;
    color: var(--pv-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 120px;
  }

  .btn-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: var(--pv-text-muted);
    font-size: 0.78rem;
    line-height: 1;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
  }

  .btn-clear:hover {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.12);
  }

  /* Format hint tooltip badge */
  .format-hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text-muted);
    font-size: 0.58rem;
    font-weight: 700;
    cursor: help;
    flex-shrink: 0;
    transition: color 0.15s, border-color 0.15s;
  }

  .format-hint:hover {
    color: var(--pv-text);
    border-color: var(--pv-border-hover);
  }

  /* Embedded lyrics chooser */
  .embedded-lyrics-bar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
    padding: 8px;
    background: var(--pv-bg-elevated);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
  }

  .embedded-label {
    font-size: 0.68rem;
    color: var(--pv-accent);
  }

  @media (max-width: 768px) {
    .panel {
      width: 100%;
      border-radius: 0;
      max-height: none;
    }
  }
</style>
