<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import Section from '../common/Section.svelte';
  import Slider from '../common/Slider.svelte';
  import {
    engine, selectTemplate, selectCustomTemplate, enterCustomMode,
    setText, setSegmentDuration, setAnimationSpeed, setMotionIntensity,
    setEffectOpacity, setBpm, setBeatReactivity, setCanvasColor,
    loadMedia, loadAudio, loadLyrics, selectLyricsSource,
    clearMedia, clearAudio, clearLyrics, showToast,
    getCurrentTemplateConfig, loadTemplateWithOptions,
  } from '../../stores/engine.svelte';
  import { templates } from '../../templates';
  import { t } from '../../i18n';
  import type { TemplateConfig } from '../../types/engine';
  import TemplateDiffDialog from '../editor/TemplateDiffDialog.svelte';

  let { ready = false, onOpenEditor = () => {}, flashEditBtn = false } = $props();

  let textInput = $state(engine.text);
  let textTimer: ReturnType<typeof setTimeout>;
  let textExpanded = $state(false);
  let mediaInput: HTMLInputElement;
  let audioInput: HTMLInputElement;
  let lyricsInput: HTMLInputElement;
  let pendingFile: File | null = null;

  // Edit button flash animation
  let editBtnFlashing = $state(false);

  // Diff dialog for user template selection
  let diffVisible = $state(false);
  let diffIncoming = $state<TemplateConfig | null>(null);
  let pendingUserIndex = $state(-1);

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

  function showUserTemplateDiff(index: number) {
    const tpl = engine.customTemplates[index];
    if (!tpl) { selectCustomTemplate(index); return; }
    diffIncoming = tpl;
    pendingUserIndex = index;
    diffVisible = true;
  }

  function handleUserDiffConfirm(opts: { resetMissing: boolean }) {
    if (pendingUserIndex >= 0 && diffIncoming) {
      loadTemplateWithOptions(diffIncoming, { ...opts, customIndex: pendingUserIndex });
    }
    diffIncoming = null;
    pendingUserIndex = -1;
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

  // OBS browser detection (CEF doesn't support native <select> popups)
  const isObs = typeof window !== 'undefined' && (
    'obsstudio' in window ||
    navigator.userAgent.includes('OBS') ||
    new URLSearchParams(window.location.search).has('panel')
  );
  let obsDropdownOpen = $state(false);

  const canvasColors = [
    { color: null, label: 'A', title: t('follow_template') },
    { color: '#ffffff', title: t('white') },
    { color: '#000000', title: t('black') },
    { color: '#1122ee', title: t('blue') },
    { color: '#8b1a1a', title: t('red') },
    { color: '#EEDD11', title: t('yellow') },
    { color: '#f5c6d0', title: t('pink') },
  ];

  function handleTemplateChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    if (val === 'custom') {
      enterCustomMode();
      showToast(t('custom_mode_hint'));
      triggerFlash();
      onOpenEditor();
    } else if (val.startsWith('user-')) {
      guardSwitch(() => showUserTemplateDiff(parseInt(val.split('-')[1])));
    } else {
      guardSwitch(() => selectTemplate(parseInt(val)));
    }
  }

  function handleTextInput() {
    clearTimeout(textTimer);
    textTimer = setTimeout(() => setText(textInput), 400);
  }

  function tplName(tpl: any): string {
    if (tpl.nameKey) return t(tpl.nameKey as any);
    return tpl.name;
  }

  async function handleMediaFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await loadMedia(file, 'fit');
    }
  }

  async function handleAudioFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) await loadAudio(file);
  }

  async function handleLyricsFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) await loadLyrics(file);
  }
</script>

<div class="panel left-panel">
  <!-- Template -->
  <Section label={t('template')}>
    <div class="template-row">
      {#if isObs}
        <!-- Custom dropdown for OBS browser (CEF can't do native <select>) -->
        <div class="obs-select-wrapper">
          <button class="obs-select-trigger" onclick={() => obsDropdownOpen = !obsDropdownOpen}>
            <span class="obs-select-label">
              {#if engine.isCustomMode}
                {t('custom')}
              {:else}
                {tplName(templates[engine.currentTemplateIndex])}
              {/if}
            </span>
            <span class="obs-select-arrow" class:open={obsDropdownOpen}>▾</span>
          </button>
          {#if obsDropdownOpen}
            <div class="obs-dropdown">
              {#each templates as tpl, i}
                <button
                  class="obs-option"
                  class:active={selectedValue === String(i)}
                  onclick={() => { guardSwitch(() => { selectTemplate(i); }); obsDropdownOpen = false; }}
                >{tplName(tpl)}</button>
              {/each}
              {#each engine.customTemplates as tpl, i}
                <button
                  class="obs-option"
                  class:active={selectedValue === `user-${i}`}
                  onclick={() => { guardSwitch(() => showUserTemplateDiff(i)); obsDropdownOpen = false; }}
                >⭐ {tpl.name}</button>
              {/each}
              <button
                class="obs-option"
                class:active={selectedValue === 'custom'}
                onclick={() => { enterCustomMode(); showToast(t('custom_mode_hint')); triggerFlash(); onOpenEditor(); obsDropdownOpen = false; }}
              >{t('custom')}</button>
            </div>
          {/if}
        </div>
      {:else}
        <select class="select" value={selectedValue} onchange={handleTemplateChange}>
          {#each templates as tpl, i}
            <option value={String(i)}>{tplName(tpl)}</option>
          {/each}
          {#each engine.customTemplates as tpl, i}
            <option value="user-{i}">⭐ {tpl.name}</option>
          {/each}
          <option value="custom">{t('custom')}</option>
        </select>
      {/if}
      <button class="btn btn-sm edit-btn" class:flashing={editBtnFlashing} onclick={onOpenEditor} onanimationend={() => editBtnFlashing = false} title={t('open_editor')}>🎨</button>
    </div>
  </Section>

  <!-- Canvas Color -->
  <Section label={t('canvas_color')}>
    <div class="color-swatches">
      {#each canvasColors as swatch}
        <button
          class="swatch"
          class:active={engine.canvasColor === swatch.color}
          title={swatch.title}
          style={swatch.color ? `background:${swatch.color}` : ''}
          onclick={() => setCanvasColor(swatch.color)}
        >
          {#if !swatch.color}
            <span class="swatch-auto">A</span>
          {/if}
        </button>
      {/each}
    </div>
  </Section>

  <!-- Text -->
  <Section label={t('text_label')}>
    <textarea
      class="text-input"
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
      format={(v) => `${v.toFixed(1)}s`}
      oninput={setSegmentDuration}
    />
    <Slider
      label={t('anim_speed')}
      value={engine.animationSpeed}
      min={0} max={4} step={0.1}
      format={(v) => `${v.toFixed(1)}x`}
      oninput={setAnimationSpeed}
    />
    <Slider
      label={t('motion_intensity')}
      value={engine.motionIntensity}
      min={0} max={2} step={0.1}
      format={(v) => `${v.toFixed(1)}x`}
      oninput={setMotionIntensity}
    />
    <Slider
      label={t('bg_opacity')}
      value={engine.effectOpacity}
      min={0} max={1} step={0.05}
      format={(v) => `${Math.round(v * 100)}%`}
      oninput={setEffectOpacity}
    />
  </Section>

  <!-- Media -->
  <Section label={t('media')}>
    <div class="file-row">
      <button class="btn btn-sm" onclick={() => mediaInput.click()}>
        {t('choose_file')}
      </button>
      <span class="file-name" title={engine.mediaFileName || ''}>{engine.mediaFileName || t('no_file')}</span>
      <span class="format-hint" title="PNG, JPG, GIF, WebP, MP4, WebM">?</span>
      {#if engine.mediaLoaded}
        <button class="btn-clear" onclick={clearMedia} title="Clear">×</button>
      {/if}
      <input bind:this={mediaInput} type="file" accept="image/*,video/mp4,video/webm" hidden onchange={handleMediaFile} />
    </div>
  </Section>

  <!-- Audio -->
  <Section label={t('audio')}>
    <div class="file-row">
      <button class="btn btn-sm" onclick={() => audioInput.click()}>
        {t('choose_file')}
      </button>
      <span class="file-name" title={engine.audioFileName || ''}>{engine.audioFileName || t('no_file')}</span>
      <span class="format-hint" title="MP3, WAV, OGG, FLAC, AAC, M4A">?</span>
      {#if engine.audioLoaded}
        <button class="btn-clear" onclick={clearAudio} title="Clear">×</button>
      {/if}
      <input bind:this={audioInput} type="file" accept="audio/*" hidden onchange={handleAudioFile} />
    </div>
  </Section>

  <!-- Lyrics -->
  <Section label={t('lyrics')}>
    <div class="file-row">
      <button class="btn btn-sm" onclick={() => lyricsInput.click()}>
        {t('choose_file')}
      </button>
      <span class="file-name" title={engine.lyricsFileName || ''}>{engine.lyricsFileName || t('no_file')}</span>
      <span class="format-hint" title="LRC, SRT, ASS, SSA">?</span>
      {#if engine.lyricsLoaded && engine.embeddedLyricsSource !== 'embedded'}
        <button class="btn-clear" onclick={clearLyrics} title="Clear">×</button>
      {/if}
      <input bind:this={lyricsInput} type="file" accept=".lrc,.srt,.ass,.ssa" hidden onchange={handleLyricsFile} />
    </div>
    {#if engine.embeddedLyricsRaw}
      <div class="embedded-lyrics-bar">
        <span class="embedded-label">{t('embedded_lyrics_found')}</span>
        <div class="embedded-btns">
          <button
            class="btn btn-xs"
            class:active={engine.embeddedLyricsSource === 'embedded'}
            onclick={() => selectLyricsSource('embedded')}
          >{t('use_embedded')}</button>
          <button
            class="btn btn-xs"
            class:active={engine.embeddedLyricsSource === 'file'}
            onclick={() => {
              if (engine.hasFileLyrics) {
                selectLyricsSource('file');
              } else {
                lyricsInput.click();
              }
            }}
          >{t('use_file')}</button>
        </div>
      </div>
    {/if}
  </Section>

  <!-- BPM & Beat -->
  <Section label={t('bpm')}>
    <Slider
      label={t('bpm')}
      value={engine.bpm}
      min={30} max={240} step={1}
      format={(v) => String(Math.round(v))}
      oninput={setBpm}
    />
    <Slider
      label={t('beat_react')}
      value={engine.beatReactivity}
      min={0} max={1} step={0.05}
      format={(v) => v.toFixed(2)}
      oninput={setBeatReactivity}
    />
  </Section>
</div>

<TemplateDiffDialog
  bind:visible={diffVisible}
  currentConfig={getCurrentTemplateConfig()}
  incomingConfig={diffIncoming}
  onConfirm={handleUserDiffConfirm}
/>

{#if confirmVisible}
  <div class="confirm-overlay" onclick={handleConfirmCancel} role="none"></div>
  <div class="confirm-dialog">
    <p class="confirm-text">{t('unsaved_changes_hint')}</p>
    <div class="confirm-actions">
      <button class="btn accent" onclick={handleConfirmDiscard}>{t('discard_and_switch')}</button>
      <button class="btn" onclick={handleConfirmCancel}>{t('cancel')}</button>
    </div>
  </div>
{/if}

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

  .select {
    width: 100%;
    padding: 7px 10px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.82rem;
    font-family: inherit;
    outline: none;
    cursor: pointer;
    transition: border-color var(--pv-duration);
  }

  .select:hover { border-color: var(--pv-border-hover); }
  .select:focus { border-color: var(--pv-border-focus); }

  .template-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .template-row .select {
    flex: 1;
    min-width: 0;
  }
  .edit-btn {
    flex-shrink: 0;
    font-size: 0.85rem !important;
    padding: 4px 8px !important;
  }
  .edit-btn.flashing {
    animation: flash-glow 0.5s ease 3;
  }

  @keyframes flash-glow {
    0%, 100% { box-shadow: none; transform: scale(1); }
    50% { box-shadow: 0 0 10px 3px var(--pv-accent); transform: scale(1.15); }
  }

  .select option {
    background: #1a1a2e;
    color: var(--pv-text);
  }

  /* OBS custom dropdown */
  .obs-select-wrapper {
    flex: 1;
    position: relative;
  }

  .obs-select-trigger {
    width: 100%;
    padding: 6px 10px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.78rem;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    transition: border-color var(--pv-duration);
  }

  .obs-select-trigger:hover { border-color: var(--pv-border-hover); }

  .obs-select-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .obs-select-arrow {
    font-size: 0.7rem;
    transition: transform 0.2s;
  }

  .obs-select-arrow.open {
    transform: rotate(180deg);
  }

  .obs-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 240px;
    overflow-y: auto;
    background: var(--pv-bg-surface);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
    z-index: 100;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(12px);
  }

  .obs-option {
    padding: 7px 10px;
    border: none;
    background: transparent;
    color: var(--pv-text-muted);
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .obs-option:last-child { border-bottom: none; }
  .obs-option:hover { background: var(--pv-bg-hover); color: var(--pv-text); }
  .obs-option.active { color: var(--pv-accent); font-weight: 600; }

  .text-input {
    width: 100%;
    padding: 7px 10px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.82rem;
    font-family: inherit;
    outline: none;
    resize: none;
    overflow: hidden;
    transition: border-color var(--pv-duration), height 0.2s var(--pv-ease);
  }

  .text-input:focus { border-color: var(--pv-border-focus); }
  .text-input.expanded { overflow-y: auto; }

  /* Color swatches */
  .color-swatches {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
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

  /* Buttons */
  .btn {
    padding: 6px 14px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.78rem;
    font-family: inherit;
    cursor: pointer;
    transition: background var(--pv-duration), border-color var(--pv-duration);
    white-space: nowrap;
  }

  .btn:hover {
    background: var(--pv-bg-hover);
    border-color: var(--pv-border-hover);
  }

  .btn-sm {
    padding: 4px 10px;
    font-size: 0.72rem;
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

  .embedded-btns {
    display: flex;
    gap: 6px;
  }

  .embedded-btns :global(.btn-xs),
  .embedded-btns .btn-xs {
    flex: 1;
    text-align: center;
  }

  .btn-xs {
    padding: 2px 8px;
    font-size: 0.66rem;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .btn-xs:hover {
    color: var(--pv-text);
    border-color: var(--pv-border-hover);
  }

  .btn-xs.active {
    background: var(--pv-accent);
    color: #fff;
    border-color: var(--pv-accent);
  }

  @media (max-width: 768px) {
    .panel {
      width: 100%;
      border-radius: 0;
      max-height: none;
    }
    .btn { padding: 8px 16px; font-size: 0.85rem; min-height: 36px; }
  }

  /* Unsaved changes confirm dialog */
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
  }
  .confirm-dialog {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 201;
    width: 320px;
    background: var(--pv-bg-surface);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-lg);
    box-shadow: var(--pv-shadow-lg);
    padding: 20px;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  .confirm-text {
    font-size: 0.8rem;
    color: var(--pv-text);
    margin: 0 0 16px;
    line-height: 1.5;
  }
  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
