<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import Section from '../common/Section.svelte';
  import Slider from '../common/Slider.svelte';
  import ListenPanel from '../listen/ListenPanel.svelte';
  import TemplateDiffDialog from '../editor/TemplateDiffDialog.svelte';
  import {
    engine, setShake, setZoom, setTilt, setGlitch, setHueShift,
    setAlphaMode, setMediaOffset, setMediaScale, toggleRecording,
    setPostFxLocked, resetPostFx, getCurrentTemplateConfig, getResetBaselineConfig, showToast,
  } from '../../stores/engine.svelte';
  import type { TemplateConfig } from '../../types/engine';
  import { t } from '../../i18n';
  import { getShortcutList } from '../../services/keyboard';

  let {
    autoStartNp = false,
    autoStartNwc = false,
    autoNwcWsAddr = '',
  }: {
    autoStartNp?: boolean;
    autoStartNwc?: boolean;
    autoNwcWsAddr?: string;
  } = $props();

  function formatRecTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── PostFX reset with diff dialog ──

  let postfxDiffVisible = $state(false);
  let postfxDiffIncoming = $state<TemplateConfig | null>(null);

  function getBaselinePostFx() {
    const baseline = getResetBaselineConfig();
    return baseline?.postfx ?? { shake: 0, zoom: 0, tilt: 0, glitch: 0, hueShift: 0 };
  }

  function canResetPostFx(): boolean {
    const base = getBaselinePostFx();
    return engine.shake !== (base.shake ?? 0)
      || engine.zoom !== (base.zoom ?? 0)
      || engine.tilt !== (base.tilt ?? 0)
      || engine.glitch !== (base.glitch ?? 0)
      || engine.hueShift !== (base.hueShift ?? 0);
  }

  function getResetTooltip(label: string, enabled: boolean): string | undefined {
    return enabled ? `⚠ ${label}` : undefined;
  }

  function handleResetPostFxClick() {
    if (!canResetPostFx()) return;
    const cur = getCurrentTemplateConfig();
    if (!cur) return;
    const base = getBaselinePostFx();
    postfxDiffIncoming = {
      ...cur,
      postfx: {
        shake: base.shake ?? 0,
        zoom: base.zoom ?? 0,
        tilt: base.tilt ?? 0,
        glitch: base.glitch ?? 0,
        hueShift: base.hueShift ?? 0,
      },
    };
    postfxDiffVisible = true;
  }

  function handlePostFxDiffConfirm() {
    resetPostFx();
    postfxDiffVisible = false;
    postfxDiffIncoming = null;
    showToast(t('postfx_reset'));
  }

  function closePostFxDiff() {
    postfxDiffVisible = false;
    postfxDiffIncoming = null;
  }

  // ── Keyboard shortcuts dialog ──

  let shortcutsVisible = $state(false);

  function getLocalizedShortcuts() {
    return getShortcutList().map(s => ({
      keyParts: s.keyParts,
      description: t(s.descriptionKey as any),
    }));
  }

  function closeShortcuts() {
    shortcutsVisible = false;
  }

  function handleShortcutsKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeShortcuts();
  }
</script>

<div class="panel right-panel">
  <!-- Post FX -->
  <Section label={t('postfx')}>
    <Slider label={t('shake')} value={engine.shake} min={0} max={1} step={0.05} oninput={setShake} />
    <Slider label={t('zoom')} value={engine.zoom} min={-1} max={1} step={0.05} oninput={setZoom} />
    <Slider label={t('tilt')} value={engine.tilt} min={-1} max={1} step={0.05}
      format={(v: number) => `${(v * 17.2).toFixed(0)}°`}
      oninput={setTilt}
    />
    <Slider label={t('glitch')} value={engine.glitch} min={0} max={1} step={0.05} oninput={setGlitch} />
    <Slider label={t('hue_shift')} value={engine.hueShift} min={-180} max={180} step={5}
      format={(v: number) => `${v.toFixed(0)}°`}
      oninput={setHueShift}
    />
  </Section>

  <!-- Post FX actions -->
  <div class="postfx-actions">
    <label class="pv-check-row pv-check-row-md toggle-row">
      <input type="checkbox" checked={engine.postFxLocked} onchange={(e: Event) => setPostFxLocked((e.target as HTMLInputElement).checked)} />
      <span class="pv-check-text" title={t('postfx_lock')}>🔒 {t('postfx_lock')}</span>
    </label>
    <button class="pv-btn pv-btn-sm btn btn-sm reset-btn"
      title={getResetTooltip(t('postfx_reset'), canResetPostFx())}
      disabled={!canResetPostFx()}
      onclick={handleResetPostFxClick}>↺ {t('postfx_reset')}</button>
  </div>

  <!-- Media position (only when media loaded) -->
  {#if engine.mediaLoaded}
    <Section label={t('media_position')}>
      <Slider label={t('offset_x')} value={engine.mediaOffsetX} min={-500} max={500} step={5}
        format={(v: number) => String(Math.round(v))}
        oninput={(v: number) => setMediaOffset(v, engine.mediaOffsetY)}
      />
      <Slider label={t('offset_y')} value={engine.mediaOffsetY} min={-500} max={500} step={5}
        format={(v: number) => String(Math.round(v))}
        oninput={(v: number) => setMediaOffset(engine.mediaOffsetX, v)}
      />
      <Slider label={t('scale')} value={engine.mediaScale} min={0.5} max={3} step={0.05}
        format={(v: number) => `${v.toFixed(1)}x`}
        oninput={setMediaScale}
      />
    </Section>
  {/if}

  <!-- Live MODE (NowPlaying / WesingCap + Copy URL) -->
  <ListenPanel {autoStartNp} {autoStartNwc} {autoNwcWsAddr} />

  <!-- Export -->
  <Section label={t('export')}>
    <label class="pv-check-row pv-check-row-md toggle-row">
      <input type="checkbox" checked={engine.alphaMode} onchange={(e: Event) => setAlphaMode((e.target as HTMLInputElement).checked)} />
      <span class="pv-check-text">{t('alpha_export')}</span>
    </label>
    <button class="pv-btn btn rec-btn" class:recording={engine.isRecording} onclick={toggleRecording}>
      <span class="rec-dot"></span>
      <span>{engine.isRecording ? `${t('stop')} ${formatRecTime(engine.recordingTime)}` : t('rec')}</span>
    </button>
  </Section>

  <!-- Keyboard shortcuts -->
  <button class="pv-btn btn shortcuts-btn" onclick={() => shortcutsVisible = true}>⌨ {t('keyboard_shortcuts')}</button>

  <!-- Footer -->
  <p class="agpl-footer">{@html t('agpl_footer')}</p>
</div>

<TemplateDiffDialog
  visible={postfxDiffVisible}
  currentConfig={postfxDiffVisible ? getCurrentTemplateConfig() : null}
  incomingConfig={postfxDiffIncoming}
  title={t('postfx_reset')}
  confirmLabel={t('diff_confirm_reset')}
  showUnchangedEffects={false}
  onClose={closePostFxDiff}
  onConfirm={handlePostFxDiffConfirm}
/>

{#if shortcutsVisible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sc-overlay" onclick={closeShortcuts} onkeydown={handleShortcutsKeydown}></div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sc-dialog" onkeydown={handleShortcutsKeydown}>
    <div class="sc-title">⌨ {t('keyboard_shortcuts')}</div>
    <div class="sc-scroll">
      <table class="sc-table">
        <colgroup>
          <col class="sc-col-key" />
          <col class="sc-col-desc" />
        </colgroup>
        <thead>
          <tr>
            <th>{t('shortcut_key')}</th>
            <th>{t('shortcut_action')}</th>
          </tr>
        </thead>
        <tbody>
          {#each getLocalizedShortcuts() as s}
            <tr>
              <td class="sc-key-cell">
                {#each s.keyParts as part, i}
                  {#if i > 0}<span class="sc-plus">+</span>{/if}<kbd class="sc-kbd">{part}</kbd>
                {/each}
              </td>
              <td class="sc-desc-cell">{s.description}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="sc-footer">
      <button class="pv-btn btn btn-sm" onclick={closeShortcuts}>{t('modal_confirm')}</button>
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
    scrollbar-gutter: stable;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: var(--pv-shadow);
  }

  .toggle-row input[type="checkbox"] {
    width: 14px;
    height: 14px;
  }

  .rec-btn {
    justify-content: center;
  }

  .rec-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--pv-danger);
    transition: all 0.2s;
  }

  .rec-btn.recording {
    border-color: var(--pv-danger);
    background: rgba(255, 50, 50, 0.15);
  }

  .rec-btn.recording .rec-dot {
    border-radius: 2px;
    background: var(--pv-text);
  }

  .postfx-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    flex-wrap: nowrap;
  }

  .postfx-actions .toggle-row {
    flex: 1;
    min-width: 0;
  }

  .postfx-actions .toggle-row span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .postfx-actions .reset-btn {
    flex-shrink: 0;
  }

  .reset-btn {
    font-size: 0.7rem !important;
    padding: 3px 8px !important;
    opacity: 0.7;
    transition: opacity 0.15s;
    white-space: nowrap;
  }

  .reset-btn:hover { opacity: 1; }

  .reset-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .panel {
      width: 100%;
      border-radius: 0;
      max-height: none;
    }
  }
  .agpl-footer {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--pv-border);
    font-size: 0.62rem;
    color: var(--pv-text-muted);
    line-height: 1.5;
    text-align: center;
  }

  .agpl-footer :global(a) {
    color: #58a6ff;
    text-decoration: none;
  }

  .agpl-footer :global(a:hover) {
    text-decoration: underline;
  }

  /* Shortcuts button */
  .shortcuts-btn {
    justify-content: center;
    opacity: 0.7;
    transition: opacity 0.15s;
  }
  .shortcuts-btn:hover { opacity: 1; }

  /* Shortcuts dialog — mirrors diff-dialog pattern */
  .sc-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.45);
  }

  .sc-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 201;
    width: 340px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--pv-bg-surface);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-lg);
    box-shadow: var(--pv-shadow-lg);
    padding: 16px 16px 0;
    animation: scFadeIn 0.15s ease;
  }

  @keyframes scFadeIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  .sc-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--pv-text);
    line-height: 1.2;
    margin-bottom: 12px;
  }

  .sc-scroll {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-bottom: 4px;
  }

  .sc-table {
    width: 100%;
    font-size: 0.7rem;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .sc-table col.sc-col-key { width: 35%; }
  .sc-table col.sc-col-desc { width: 65%; }
  .sc-table th {
    font-weight: 600;
    color: var(--pv-text-muted);
    text-align: left;
    padding: 3px 6px;
    border-bottom: 1px solid var(--pv-border);
  }
  .sc-table td {
    padding: 4px 6px;
    color: var(--pv-text-secondary);
  }

  .sc-key-cell {
    text-align: left;
    white-space: nowrap;
  }

  .sc-plus {
    margin: 0 2px;
    font-size: 0.62rem;
    color: var(--pv-text-muted);
    vertical-align: middle;
  }

  .sc-kbd {
    display: inline-block;
    padding: 2px 7px;
    font-size: 0.68rem;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--pv-border);
    border-radius: 4px;
    color: var(--pv-text);
    line-height: 1.4;
  }

  .sc-desc-cell {
    color: var(--pv-text-secondary);
  }

  .sc-footer {
    flex-shrink: 0;
    border-top: 1px solid var(--pv-border);
    padding: 10px 0 16px;
    display: flex;
    justify-content: flex-end;
  }
</style>
