<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import Section from '../common/Section.svelte';
  import Slider from '../common/Slider.svelte';
  import ListenPanel from '../listen/ListenPanel.svelte';
  import {
    engine, setShake, setZoom, setTilt, setGlitch, setHueShift,
    setAlphaMode, setMediaOffset, setMediaScale, toggleRecording,
    setPostFxLocked, resetPostFx,
  } from '../../stores/engine.svelte';
  import { t } from '../../i18n';

  let { ready = false, autoStartNp = false, autoStartNwc = false, autoNwcWsAddr = '' } = $props();

  function formatRecTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
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
    <label class="toggle-row">
      <input type="checkbox" checked={engine.postFxLocked} onchange={(e: Event) => setPostFxLocked((e.target as HTMLInputElement).checked)} />
      <span>🔒 {t('postfx_lock')}</span>
    </label>
    <button class="btn btn-sm reset-btn" onclick={resetPostFx}>↺ {t('postfx_reset')}</button>
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
    <label class="toggle-row">
      <input type="checkbox" checked={engine.alphaMode} onchange={(e: Event) => setAlphaMode((e.target as HTMLInputElement).checked)} />
      <span>{t('alpha_export')}</span>
    </label>
    <button class="btn rec-btn" class:recording={engine.isRecording} onclick={toggleRecording}>
      <span class="rec-dot"></span>
      <span>{engine.isRecording ? `${t('stop')} ${formatRecTime(engine.recordingTime)}` : t('rec')}</span>
    </button>
  </Section>
  <!-- Footer -->
  <p class="agpl-footer">本镜像站基于 AGPL-3.0 协议运行。源代码及修改详情请见 <a href="https://github.com/VTB-LINK/pv-tool" target="_blank" rel="noopener noreferrer">GitHub 仓库</a>。</p>
</div>


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
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.78rem;
    color: var(--pv-text-secondary);
    cursor: pointer;
    transition: color var(--pv-duration);
  }

  .toggle-row:hover { color: var(--pv-text); }

  .toggle-row input[type="checkbox"] {
    accent-color: var(--pv-accent);
    cursor: pointer;
    width: 14px;
    height: 14px;
  }

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
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn:hover {
    background: var(--pv-bg-hover);
    border-color: var(--pv-border-hover);
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
    justify-content: space-between;
    gap: 8px;
    padding: 0 2px;
    margin-bottom: 4px;
  }

  .reset-btn {
    font-size: 0.7rem !important;
    padding: 3px 8px !important;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .reset-btn:hover { opacity: 1; }

  .btn-sm {
    font-size: 0.72rem;
    padding: 3px 10px;
  }

  @media (max-width: 768px) {
    .panel {
      width: 100%;
      border-radius: 0;
      max-height: none;
    }
    .btn { padding: 8px 16px; font-size: 0.85rem; min-height: 36px; }
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

  .agpl-footer a {
    color: #58a6ff;
    text-decoration: none;
  }

  .agpl-footer a:hover {
    text-decoration: underline;
  }
</style>
