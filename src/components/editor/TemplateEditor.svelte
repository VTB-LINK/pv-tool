<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import Section from '../common/Section.svelte';
  import EffectConfigPane from './EffectConfigPane.svelte';
  import {
    engine, showToast,
    saveCurrentAsTemplate, deleteCustomTemplate,
    exportShareCode, importShareCode,
    reloadCurrentTemplate,
  } from '../../stores/engine.svelte';
  import { effectCatalog, type EffectPreset } from '../../engine/effectCatalog';
  import type { EffectEntry, ColorPalette } from '../../types/engine';
  import { t } from '../../i18n';

  let { visible = $bindable(false) } = $props();

  // ── Local editor state ──
  let activeEffectIndex = $state<number | null>(null);
  let showCatalog = $state(false);
  let catalogFilter = $state('');
  let saveDialogOpen = $state(false);
  let saveName = $state('');
  let shareCodeInput = $state('');
  let shareDialogOpen = $state(false);

  // Reactivity trigger: bump this to force re-render of effects list
  // (engine arrays are mutated in-place, Svelte 5 can't track that)
  let effectsVersion = $state(0);

  // ── Current template data (reactive from engine) ──
  function getCurrentEffects(): EffectEntry[] {
    // Access effectsVersion so Svelte tracks it as a dependency
    void effectsVersion;
    const eng = engine.instance;
    if (!eng) return [];
    return eng.currentEffects ?? [];
  }

  function getCurrentPalette(): ColorPalette {
    void effectsVersion;
    const eng = engine.instance;
    if (!eng) return { background: '#000', primary: '#fff', secondary: '#888', accent: '#f36', text: '#fff' };
    return eng.currentPalette ?? { background: '#000', primary: '#fff', secondary: '#888', accent: '#f36', text: '#fff' };
  }

  // ── Categories for catalog ──
  type CatalogCategory = { name: string; items: (EffectPreset & { index: number })[] };

  function getCatalogCategories(): CatalogCategory[] {
    const map = new Map<string, (EffectPreset & { index: number })[]>();
    effectCatalog.forEach((item, i) => {
      const q = catalogFilter.toLowerCase();
      if (q && !item.label.toLowerCase().includes(q) && !item.type.toLowerCase().includes(q)) return;
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push({ ...item, index: i });
    });
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
  }

  // ── Actions ──
  function addEffect(preset: EffectPreset) {
    const eng = engine.instance;
    if (!eng) return;
    try {
      const entry: EffectEntry = {
        type: preset.type,
        layer: preset.layer,
        config: { ...preset.config },
      };
      eng.addEffect(entry);
      effectsVersion++;
      showToast(`+ ${preset.label}`);
      showCatalog = false;
      // Select the newly added effect
      const effects = getCurrentEffects();
      activeEffectIndex = effects.length - 1;
    } catch (err) {
      console.warn('[TemplateEditor] addEffect failed:', err);
    }
  }

  function removeEffect(index: number) {
    const eng = engine.instance;
    if (!eng) return;
    try {
      eng.removeEffect(index);
      effectsVersion++;
      if (activeEffectIndex === index) activeEffectIndex = null;
      else if (activeEffectIndex !== null && activeEffectIndex > index) activeEffectIndex--;
      showToast(t('effect_removed'));
    } catch (err) {
      console.warn('[TemplateEditor] removeEffect failed:', err);
    }
  }

  function moveEffect(index: number, direction: -1 | 1) {
    const eng = engine.instance;
    if (!eng) return;
    const newIndex = index + direction;
    const effects = getCurrentEffects();
    if (newIndex < 0 || newIndex >= effects.length) return;
    try {
      eng.swapEffects(index, newIndex);
      effectsVersion++;
      activeEffectIndex = newIndex;
    } catch (err) {
      console.warn('[TemplateEditor] moveEffect failed:', err);
    }
  }

  function handleConfigChange(effectIndex: number, key: string, value: any) {
    const eng = engine.instance;
    if (!eng) return;
    try {
      eng.updateEffectConfig(effectIndex, key, value);
      effectsVersion++;
    } catch (err) {
      console.warn('[TemplateEditor] updateConfig failed:', err);
    }
  }

  function handlePaletteChange(key: keyof ColorPalette, color: string) {
    const eng = engine.instance;
    if (!eng) return;
    try {
      eng.updatePalette(key, color);
      effectsVersion++;
    } catch (err) {
      console.warn('[TemplateEditor] updatePalette failed:', err);
    }
  }

  function handleSave() {
    if (!saveName.trim()) return;
    saveCurrentAsTemplate(saveName.trim());
    saveDialogOpen = false;
    saveName = '';
    showToast(t('saved'));
  }

  async function handleExport(index: number) {
    try {
      const code = await exportShareCode(index);
      await navigator.clipboard.writeText(code);
      showToast(t('share_code_copied'));
    } catch {
      showToast('Export failed');
    }
  }

  async function handleImport() {
    if (!shareCodeInput.trim()) return;
    try {
      await importShareCode(shareCodeInput.trim());
      shareDialogOpen = false;
      shareCodeInput = '';
      showToast(t('imported'));
    } catch {
      showToast('Import failed');
    }
  }

  const layerIcons: Record<string, string> = {
    background: '◻',
    decoration: '◈',
    text: 'T',
    overlay: '◉',
  };

  const paletteKeys: (keyof ColorPalette)[] = ['background', 'primary', 'secondary', 'accent', 'text'];
</script>

{#if visible}
  <div class="editor-overlay" onclick={() => visible = false}></div>
  <div class="editor-panel">
    <div class="editor-header">
      <h3 class="editor-title">🎨 {t('template_editor')}</h3>
      <div class="header-actions">
        <button class="reset-btn" title={t('reset_template')} onclick={() => { reloadCurrentTemplate(); effectsVersion++; showToast(t('reset_template')); }}>↺ {t('reset_template')}</button>
        <button class="close-btn" onclick={() => visible = false}>✕</button>
      </div>
    </div>

    <!-- Palette Section -->
    <Section label={t('palette')}>
      <div class="palette-row">
        {#each paletteKeys as key}
          {@const palette = getCurrentPalette()}
          <div class="palette-item">
            <input
              type="color"
              class="palette-input"
              value={palette[key]}
              oninput={(e: Event) => handlePaletteChange(key, (e.target as HTMLInputElement).value)}
            />
            <span class="palette-label">{key}</span>
          </div>
        {/each}
      </div>
    </Section>

    <!-- Effects List -->
    <Section label={t('effects_list')}>
      <div class="effects-list">
        {#each getCurrentEffects() as effect, i}
          <div
            class="effect-item"
            class:active={activeEffectIndex === i}
            onclick={() => activeEffectIndex = activeEffectIndex === i ? null : i}
          >
            <span class="effect-layer">{layerIcons[effect.layer] ?? '?'}</span>
            <span class="effect-type">{effect.type}</span>
            <div class="effect-actions">
              <button class="icon-btn" title="Move up" onclick={(e: MouseEvent) => { e.stopPropagation(); moveEffect(i, -1); }}>↑</button>
              <button class="icon-btn" title="Move down" onclick={(e: MouseEvent) => { e.stopPropagation(); moveEffect(i, 1); }}>↓</button>
              <button class="icon-btn danger" title="Remove" onclick={(e: MouseEvent) => { e.stopPropagation(); removeEffect(i); }}>✕</button>
            </div>
          </div>

          <!-- Expanded config pane -->
          {#if activeEffectIndex === i}
            <div class="effect-config-wrapper">
              <EffectConfigPane
                config={effect.config}
                onchange={(key: string, value: any) => handleConfigChange(i, key, value)}
              />
            </div>
          {/if}
        {/each}

        {#if getCurrentEffects().length === 0}
          <div class="empty-msg">{t('no_effects')}</div>
        {/if}
      </div>

      <button class="btn add-btn" onclick={() => showCatalog = !showCatalog}>
        {showCatalog ? '▾ ' + t('hide_catalog') : '+ ' + t('add_effect')}
      </button>
    </Section>

    <!-- Effect Catalog -->
    {#if showCatalog}
      <Section label={t('effect_catalog')} open={true}>
        <input
          type="text"
          class="search-input"
          placeholder={t('search_effects')}
          bind:value={catalogFilter}
        />
        <div class="catalog-scroll">
          {#each getCatalogCategories() as category}
            <div class="catalog-category">
              <span class="catalog-cat-label">{category.name}</span>
              {#each category.items as item}
                <button
                  class="catalog-item"
                  onclick={() => addEffect(item)}
                  title={item.type}
                >
                  <span class="cat-layer">{layerIcons[item.layer] ?? '?'}</span>
                  <span>{item.label}</span>
                </button>
              {/each}
            </div>
          {/each}
        </div>
      </Section>
    {/if}

    <!-- Save / Import / Export -->
    <Section label={t('template_actions')}>
      <div class="action-row">
        <button class="btn" onclick={() => saveDialogOpen = true}>💾 {t('save_template')}</button>
        <button class="btn" onclick={() => shareDialogOpen = true}>📥 {t('import_code')}</button>
      </div>

      {#if saveDialogOpen}
        <div class="inline-dialog">
          <input
            type="text"
            class="save-input"
            placeholder={t('template_name')}
            bind:value={saveName}
            onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSave()}
          />
          <button class="btn accent" onclick={handleSave}>{t('save')}</button>
          <button class="btn" onclick={() => saveDialogOpen = false}>{t('cancel')}</button>
        </div>
      {/if}

      {#if shareDialogOpen}
        <div class="inline-dialog">
          <input
            type="text"
            class="save-input"
            placeholder={t('paste_share_code')}
            bind:value={shareCodeInput}
          />
          <button class="btn accent" onclick={handleImport}>{t('import')}</button>
          <button class="btn" onclick={() => shareDialogOpen = false}>{t('cancel')}</button>
        </div>
      {/if}

      <!-- Custom templates list -->
      {#if engine.customTemplates.length > 0}
        <div class="custom-list">
          {#each engine.customTemplates as ct, i}
            <div class="custom-item">
              <span class="custom-name">⭐ {ct.name}</span>
              <div class="custom-actions">
                <button class="icon-btn" title="Export" onclick={() => handleExport(i)}>📋</button>
                <button class="icon-btn danger" title="Delete" onclick={() => deleteCustomTemplate(i)}>✕</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Section>
  </div>
{/if}

<style>
  .editor-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 99;
  }

  .editor-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 340px;
    height: 100vh;
    z-index: 100;
    background: var(--pv-bg-surface);
    backdrop-filter: blur(24px) saturate(1.4);
    border-left: 1px solid var(--pv-border);
    box-shadow: var(--pv-shadow-lg);
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    animation: slideInRight 0.25s var(--pv-ease);
  }

  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--pv-border);
    margin-bottom: 8px;
  }

  .editor-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--pv-text);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: transparent;
    color: var(--pv-text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--pv-duration);
  }
  .close-btn:hover { background: var(--pv-bg-hover); color: var(--pv-text); }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .reset-btn {
    padding: 3px 10px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: transparent;
    color: var(--pv-text-muted);
    font-size: 0.68rem;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--pv-duration);
    white-space: nowrap;
  }
  .reset-btn:hover {
    background: var(--pv-bg-hover);
    color: var(--pv-text);
    border-color: var(--pv-border-hover);
  }

  /* Palette */
  .palette-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .palette-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .palette-input {
    -webkit-appearance: none;
    appearance: none;
    width: 36px;
    height: 36px;
    border: 2px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
    padding: 0;
    cursor: pointer;
    background: none;
    transition: border-color 0.15s;
  }
  .palette-input:hover { border-color: var(--pv-border-hover); }
  .palette-input::-webkit-color-swatch-wrapper { padding: 2px; }
  .palette-input::-webkit-color-swatch { border: none; border-radius: 3px; }
  .palette-label {
    font-size: 0.58rem;
    color: var(--pv-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Effects list */
  .effects-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 320px;
    overflow-y: auto;
  }

  .effect-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: var(--pv-radius-sm);
    cursor: pointer;
    transition: background var(--pv-duration);
  }
  .effect-item:hover { background: var(--pv-bg-hover); }
  .effect-item.active {
    background: var(--pv-bg-active);
    border-left: 2px solid var(--pv-accent);
  }

  .effect-layer {
    font-size: 0.75rem;
    color: var(--pv-accent);
    width: 18px;
    text-align: center;
  }

  .effect-type {
    flex: 1;
    font-size: 0.75rem;
    color: var(--pv-text);
    font-family: var(--pv-font-mono);
  }

  .effect-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .effect-item:hover .effect-actions { opacity: 1; }

  .icon-btn {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--pv-text-secondary);
    font-size: 0.65rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
  }
  .icon-btn:hover { background: var(--pv-bg-hover); color: var(--pv-text); }
  .icon-btn.danger:hover { background: rgba(255, 50, 50, 0.2); color: var(--pv-danger); }

  .effect-config-wrapper {
    padding: 8px 8px 8px 26px;
    border-left: 2px solid var(--pv-accent);
    margin-left: 8px;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .empty-msg {
    font-size: 0.72rem;
    color: var(--pv-text-muted);
    text-align: center;
    padding: 12px 0;
  }

  /* Buttons */
  .btn {
    padding: 6px 14px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    transition: background var(--pv-duration), border-color var(--pv-duration);
    white-space: nowrap;
  }
  .btn:hover { background: var(--pv-bg-hover); border-color: var(--pv-border-hover); }
  .btn.accent {
    background: var(--pv-accent);
    color: #fff;
    border-color: var(--pv-accent);
  }
  .btn.accent:hover { background: var(--pv-accent-hover); }

  .add-btn {
    width: 100%;
    text-align: center;
    margin-top: 6px;
  }

  /* Search */
  .search-input {
    width: 100%;
    padding: 6px 10px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.75rem;
    font-family: inherit;
    outline: none;
    margin-bottom: 6px;
  }
  .search-input:focus { border-color: var(--pv-border-focus); }

  /* Catalog */
  .catalog-scroll {
    max-height: 280px;
    overflow-y: auto;
  }

  .catalog-category {
    margin-bottom: 8px;
  }

  .catalog-cat-label {
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--pv-text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    display: block;
    padding: 4px 0;
  }

  .catalog-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 5px 8px;
    border-radius: var(--pv-radius-sm);
    border: none;
    background: transparent;
    color: var(--pv-text-secondary);
    font-size: 0.72rem;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: all 0.1s;
  }
  .catalog-item:hover {
    background: var(--pv-bg-hover);
    color: var(--pv-text);
  }

  .cat-layer {
    color: var(--pv-accent);
    font-size: 0.7rem;
    width: 14px;
    text-align: center;
  }

  /* Action row */
  .action-row {
    display: flex;
    gap: 6px;
  }

  .inline-dialog {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 6px;
    animation: fadeIn 0.15s ease;
  }

  .save-input {
    flex: 1;
    padding: 5px 8px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.75rem;
    font-family: inherit;
    outline: none;
  }
  .save-input:focus { border-color: var(--pv-border-focus); }

  /* Custom list */
  .custom-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 8px;
  }
  .custom-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    border-radius: var(--pv-radius-sm);
    transition: background 0.1s;
  }
  .custom-item:hover { background: var(--pv-bg-hover); }
  .custom-name {
    font-size: 0.75rem;
    color: var(--pv-text);
  }
  .custom-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .custom-item:hover .custom-actions { opacity: 1; }

  @media (max-width: 768px) {
    .editor-panel {
      width: 100%;
      border-left: none;
    }
  }
</style>
