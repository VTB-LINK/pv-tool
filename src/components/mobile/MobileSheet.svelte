<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import Section from '../common/Section.svelte';
  import Slider from '../common/Slider.svelte';
  import { engine, selectTemplate, selectCustomTemplate, showToast } from '../../stores/engine.svelte';
  import { templates } from '../../templates';
  import { t } from '../../i18n';

  let { tab = 'template', onOpenEditor = () => {} } = $props();

  function tplName(tpl: any): string {
    const key = `tpl_${tpl.name}`;
    const translated = t(key as any);
    return translated !== key ? translated : tpl.name;
  }

  function handleTemplateChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    if (v === 'custom') return;
    if (v.startsWith('user-')) {
      const idx = parseInt(v.replace('user-', ''));
      selectCustomTemplate(idx);
    } else {
      selectTemplate(parseInt(v));
    }
  }

  function handleTextInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    engine.instance?.setText(value);
  }

  function handleMediaFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) engine.instance?.addMedia(file, 'fit');
  }
</script>

<div class="mobile-sheet-content">
  {#if tab === 'template'}
    <Section label={t('template')}>
      <select class="select" onchange={handleTemplateChange}>
        {#each templates as tpl, i}
          <option value={i}>{tplName(tpl)}</option>
        {/each}
        <option value="custom">{t('custom')}</option>
      </select>
      <button class="btn edit-btn" onclick={onOpenEditor}>🎨 {t('open_editor')}</button>
    </Section>

    <Section label={t('text_label')}>
      <input
        type="text"
        class="text-input"
        placeholder={t('text_label')}
        oninput={handleTextInput}
      />
    </Section>

    <Section label={t('media')}>
      <input type="file" accept="image/*,video/*" onchange={handleMediaFile} class="file-input" />
    </Section>

  {:else if tab === 'controls'}
    <Section label={t('template')}>
      <Slider label={t('seg_duration')} value={engine.segDuration} min={0.5} max={10} step={0.5}
        format={(v: number) => `${v.toFixed(1)}s`}
        oninput={(v: number) => { if (engine.instance) engine.instance.segmentDuration = v; }} />
      <Slider label={t('anim_speed')} value={engine.animSpeed} min={0.1} max={5} step={0.1}
        format={(v: number) => `${v.toFixed(1)}x`}
        oninput={(v: number) => { if (engine.instance) engine.instance.animationSpeed = v; }} />
      <Slider label={t('bg_opacity')} value={engine.bgOpacity} min={0} max={1} step={0.05}
        format={(v: number) => `${Math.round(v * 100)}%`}
        oninput={(v: number) => { if (engine.instance) engine.instance.effectOpacity = v; }} />
    </Section>

    <Section label={t('postfx')}>
      <Slider label={t('shake')} value={engine.shake} min={0} max={20} step={0.5}
        oninput={(v: number) => { if (engine.instance) engine.instance.shake = v; }} />
      <Slider label={t('zoom')} value={engine.zoom} min={0} max={20} step={0.5}
        oninput={(v: number) => { if (engine.instance) engine.instance.zoom = v; }} />
      <Slider label={t('glitch')} value={engine.glitch} min={0} max={1} step={0.05}
        oninput={(v: number) => { if (engine.instance) engine.instance.glitch = v; }} />
      <Slider label={t('hue_shift')} value={engine.hueShift} min={-180} max={180} step={1}
        oninput={(v: number) => { if (engine.instance) engine.instance.hueShift = v; }} />
    </Section>

  {:else if tab === 'export'}
    <Section label={t('export')}>
      <div class="export-actions">
        <button class="btn accent" onclick={() => showToast(t('rec'))}>{t('rec')}</button>
        <button class="btn" onclick={() => showToast(t('copy_url'))}>{t('copy_url')}</button>
      </div>
    </Section>
  {/if}
</div>

<style>
  .mobile-sheet-content {
    padding: 12px 16px;
    padding-bottom: 72px; /* space for bottom nav */
    max-height: 50vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .select {
    width: 100%;
    padding: 10px 12px;
    border-radius: var(--pv-radius);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .text-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: var(--pv-radius);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
  }
  .text-input:focus { border-color: var(--pv-border-focus); }

  .file-input {
    width: 100%;
    font-size: 0.8rem;
    color: var(--pv-text-secondary);
  }

  .btn {
    padding: 10px 18px;
    border-radius: var(--pv-radius);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .btn.accent {
    background: var(--pv-accent);
    color: #fff;
    border-color: var(--pv-accent);
  }

  .edit-btn {
    width: 100%;
    margin-top: 8px;
  }

  .export-actions {
    display: flex;
    gap: 8px;
  }
  .export-actions .btn { flex: 1; text-align: center; }
</style>
