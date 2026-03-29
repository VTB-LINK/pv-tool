<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import Section from '../common/Section.svelte';
  import EffectConfigPane from './EffectConfigPane.svelte';
  import {
    engine, showToast,
    saveCurrentAsTemplate, deleteCustomTemplate,
    exportShareCode, importShareCode,
    reloadCurrentTemplate, getCurrentTemplateConfig,
    loadTemplateWithOptions, addCustomTemplate,
    loadCustomTemplateIntoEditor,
    markEditorDirty,
    resetPalette, resetEffects,
  } from '../../stores/engine.svelte';
  import type { SaveTemplateOptions } from '../../stores/engine.svelte';
  import { encodeShareCode, decodeShareCode } from '../../services/templateStore';
  import { effectCatalog, type EffectPreset } from '../../engine/effectCatalog';
  import type { EffectEntry, ColorPalette, TemplateConfig } from '../../types/engine';
  import { t } from '../../i18n';
  import { v2Registry } from '../../effects/v2/registry';
  import TemplateDiffDialog from './TemplateDiffDialog.svelte';

  // Build a lookup: effectType → localized label
  const effectLabelMap = new Map<string, string>();
  for (const preset of effectCatalog) {
    if (!effectLabelMap.has(preset.type)) effectLabelMap.set(preset.type, preset.label);
  }

  let { visible = $bindable(false) } = $props();

  // ── Local editor state ──
  let activeEffectIndex = $state<number | null>(null);
  let showCatalog = $state(false);
  let catalogFilter = $state('');
  let saveDialogOpen = $state(false);
  let saveName = $state('');
  let shareCodeInput = $state('');
  let shareDialogOpen = $state(false);

  // Save advanced options
  let saveAdvanced = $state(false);
  let saveIncludeAnimation = $state(true);
  let saveIncludePostfx = $state(true);
  let saveIncludeFeatures = $state(true);

  // Share dropdown
  let shareMenuIndex = $state<number | null>(null);

  // Delete confirmation
  let deleteConfirmIndex = $state<number | null>(null);

  // Diff dialog
  let diffVisible = $state(false);
  let diffIncoming = $state<TemplateConfig | null>(null);

  // Reset confirmation dialog
  let resetMode = $state<'palette' | 'effects' | null>(null);
  let resetDialogVisible = $state(false);
  let resetDialogIncoming = $state<TemplateConfig | null>(null);

  // Reactivity trigger: bump this to force re-render of effects list
  // (engine arrays are mutated in-place, Svelte 5 can't track that)
  let effectsVersion = $state(0);

  /** Precomputed per-effect origin array, re-derived whenever effectsVersion or base effects change. */
  let effectOrigins = $derived(computeEffectOrigins());

  /**
   * Compute origin for ALL current effects at once using bipartite matching.
   * Simple per-index lookup breaks when effects are reordered — a moved original
   * would no longer sit at its original index and would be misclassified as 'new'.
   *
   * Algorithm (3-pass greedy):
   *   Pass 1 — exact type+config match → 'original'  (unmodified originals, any order)
   *   Pass 2 — type-only match among still-unmatched → 'modified'  (edited originals)
   *   Pass 3 — remaining current effects with no base counterpart → 'new'
   *
   * Reading effectsVersion makes Svelte re-run this whenever configs mutate.
   */
  function computeEffectOrigins(): ('original' | 'modified' | 'new')[] {
    void effectsVersion;
    const currentEffects = getCurrentEffects();
    const baseEffects = engine.baseTemplateEffects;

    if (!baseEffects || baseEffects.length === 0) {
      return currentEffects.map(() => 'new');
    }

    const results: ('original' | 'modified' | 'new')[] = currentEffects.map(() => 'new');
    const baseUsed = new Set<number>();
    const curMatched = new Set<number>();

    // Pass 1: exact type + config → 'original'
    const baseJsons = baseEffects.map(b => JSON.stringify(b.config));
    for (let ci = 0; ci < currentEffects.length; ci++) {
      const cur = currentEffects[ci];
      const curJson = JSON.stringify(cur.config);
      for (let bi = 0; bi < baseEffects.length; bi++) {
        if (baseUsed.has(bi)) continue;
        if (baseEffects[bi].type === cur.type && baseJsons[bi] === curJson) {
          results[ci] = 'original';
          baseUsed.add(bi);
          curMatched.add(ci);
          break;
        }
      }
    }

    // Pass 2: same type, different config → 'modified'
    for (let ci = 0; ci < currentEffects.length; ci++) {
      if (curMatched.has(ci)) continue;
      const cur = currentEffects[ci];
      for (let bi = 0; bi < baseEffects.length; bi++) {
        if (baseUsed.has(bi)) continue;
        if (baseEffects[bi].type === cur.type) {
          results[ci] = 'modified';
          baseUsed.add(bi);
          curMatched.add(ci);
          break;
        }
      }
      // still not matched → remains 'new'
    }

    return results;
  }

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
      markEditorDirty();
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
      markEditorDirty();
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
      markEditorDirty();
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
      markEditorDirty();
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
      markEditorDirty();
    } catch (err) {
      console.warn('[TemplateEditor] updatePalette failed:', err);
    }
  }

  function handleSave() {
    if (!saveName.trim()) return;
    const opts: SaveTemplateOptions = {
      animation: saveIncludeAnimation,
      postfx: saveIncludePostfx,
      features: saveIncludeFeatures,
    };
    saveCurrentAsTemplate(saveName.trim(), opts);
    saveDialogOpen = false;
    saveName = '';
    saveAdvanced = false;
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

  async function handleCopyFullUrl(index: number) {
    try {
      const code = await exportShareCode(index);
      const base = window.location.origin + window.location.pathname;
      const url = base + '?t=custom&sharecode=' + encodeURIComponent(code);
      await navigator.clipboard.writeText(url);
      showToast(t('url_copied'));
    } catch {
      showToast('Copy URL failed');
    }
  }

  function handleCopyEffectsList(index: number) {
    const tpl = engine.customTemplates[index];
    if (!tpl) return;
    const lines = tpl.effects.map(e => '- ' + (effectLabelMap.get(e.type) ?? e.type));
    const text = `${tpl.name}:\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      showToast(t('copied'));
    }).catch(() => {
      showToast('Copy failed');
    });
  }

  function toggleShareMenu(index: number) {
    shareMenuIndex = shareMenuIndex === index ? null : index;
  }

  async function handleImport() {
    if (!shareCodeInput.trim()) return;
    try {
      const tpl = await decodeShareCode(shareCodeInput.trim());
      diffIncoming = tpl;
      diffVisible = true;
      shareDialogOpen = false;
      shareCodeInput = '';
    } catch {
      showToast('Import failed');
    }
  }

  function handleResetPaletteClick() {
    if (!engine.hasBaseTemplate) return;
    const cur = getCurrentTemplateConfig();
    if (!cur) return;
    const basePalette = engine.basePalette;
    if (!basePalette) return;
    resetDialogIncoming = { ...cur, name: engine.baseTemplateName ?? cur.name, palette: { ...basePalette } };
    resetMode = 'palette';
    resetDialogVisible = true;
  }

  function handleResetEffectsClick() {
    if (!engine.hasBaseTemplate) return;
    const cur = getCurrentTemplateConfig();
    if (!cur) return;
    resetDialogIncoming = {
      ...cur,
      name: engine.baseTemplateName ?? cur.name,
      effects: engine.baseTemplateEffects.map((e: EffectEntry) => ({ ...e, config: { ...e.config } })),
    };
    resetMode = 'effects';
    resetDialogVisible = true;
  }

  function handleResetConfirm(_opts: { resetMissing: boolean }) {
    if (resetMode === 'palette') {
      resetPalette();
      effectsVersion++;
      showToast(t('reset_palette'));
    } else if (resetMode === 'effects') {
      resetEffects();
      effectsVersion++;
      showToast(t('reset_effects'));
    }
    resetDialogVisible = false;
    resetMode = null;
  }

  function handleDiffConfirm(opts: { resetMissing: boolean }) {
    if (!diffIncoming) return;
    loadTemplateWithOptions(diffIncoming, opts);
    // Also persist to custom templates
    addCustomTemplate(diffIncoming);
    effectsVersion++;
    showToast(t('imported'));
    diffIncoming = null;
  }

  const layerIcons: Record<string, string> = {
    background: '◻',
    decoration: '◈',
    text: 'T',
    overlay: '◉',
  };

  const paletteKeys: (keyof ColorPalette)[] = ['background', 'primary', 'secondary', 'accent', 'text'];

  function formatDate(ts: number): string {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getBaseDisplayName(ct: TemplateConfig): string {
    if (!ct.baseTemplateName) return t('custom');
    // If it's a nameKey, try to localize it
    const localized = t(ct.baseTemplateName as any);
    if (localized !== ct.baseTemplateName) return localized;
    return ct.baseTemplateName;
  }
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
      {#snippet action()}
        <button class="section-reset-btn" disabled={!engine.hasBaseTemplate} onclick={handleResetPaletteClick}>↺ {t('reset_palette')}</button>
      {/snippet}
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
      {#snippet action()}
        <button class="section-reset-btn" disabled={!engine.hasBaseTemplate} onclick={handleResetEffectsClick}>↺ {t('reset_effects')}</button>
      {/snippet}
      <div class="effects-list">
        {#each getCurrentEffects() as effect, i}
          {@const origin = effectOrigins[i] ?? 'new'}
          <div
            class="effect-item effect-origin-{origin}"
            class:active={activeEffectIndex === i}
            onclick={() => activeEffectIndex = activeEffectIndex === i ? null : i}
          >
            <span class="effect-layer">{layerIcons[effect.layer] ?? '?'}</span>
            <span class="effect-label">{effectLabelMap.get(effect.type) ?? effect.type}</span>
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
                schema={v2Registry.get(effect.type)?.meta?.fields}
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
        <div class="save-advanced-toggle">
          <button class="btn-link" onclick={() => saveAdvanced = !saveAdvanced}>
            {saveAdvanced ? '▾' : '▸'} {t('save_advanced')}
          </button>
        </div>
        {#if saveAdvanced}
          <div class="save-advanced-options">
            <label class="option-check">
              <input type="checkbox" bind:checked={saveIncludeAnimation} />
              <span>{t('save_include_animation')}</span>
            </label>
            <label class="option-check">
              <input type="checkbox" bind:checked={saveIncludePostfx} />
              <span>{t('save_include_postfx')}</span>
            </label>
            <label class="option-check">
              <input type="checkbox" bind:checked={saveIncludeFeatures} />
              <span>{t('save_include_features')}</span>
            </label>
          </div>
        {/if}
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
            <div class="custom-item-card">
              <div class="custom-item-row">
                <span class="custom-name">⭐ {ct.name}</span>
                <div class="custom-actions">
                  <button class="icon-btn" title={t('load_template')} onclick={() => { loadCustomTemplateIntoEditor(i); effectsVersion++; showToast(t('loaded')); }}>▶</button>
                  <button class="icon-btn" title={t('share')} onclick={() => toggleShareMenu(i)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  </button>
                  <button class="icon-btn danger" title={t('delete_tpl')} onclick={() => deleteConfirmIndex = i}>✕</button>
                </div>
              </div>
              <div class="custom-item-meta">
                <span class="custom-base">{ct.baseTemplateName ? t('based_on') + ' ' + getBaseDisplayName(ct) : t('custom_from_scratch')}</span>
                {#if ct.lastModified}
                  <span class="custom-date">{formatDate(ct.lastModified)}</span>
                {/if}
              </div>
              {#if shareMenuIndex === i}
                <div class="share-panel">
                  <button class="share-panel-option" onclick={() => { handleExport(i); shareMenuIndex = null; }}>
                    🔗 {t('copy_sharecode')}
                  </button>
                  <button class="share-panel-option" onclick={() => { handleCopyFullUrl(i); shareMenuIndex = null; }}>
                    🌐 {t('copy_full_url')}
                  </button>
                  <button class="share-panel-option" onclick={() => { handleCopyEffectsList(i); shareMenuIndex = null; }}>
                    📝 {t('copy_effects_list')}
                  </button>
                </div>
              {/if}
              {#if deleteConfirmIndex === i}
                <div class="delete-confirm-bar">
                  <span class="delete-confirm-text">{t('confirm_delete')}?</span>
                  <button class="btn-sm danger" onclick={() => { deleteCustomTemplate(i); deleteConfirmIndex = null; }}>{t('confirm')}</button>
                  <button class="btn-sm" onclick={() => deleteConfirmIndex = null}>{t('cancel')}</button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </Section>
  </div>
{/if}

<TemplateDiffDialog
  bind:visible={diffVisible}
  currentConfig={getCurrentTemplateConfig()}
  incomingConfig={diffIncoming}
  onConfirm={handleDiffConfirm}
/>

<TemplateDiffDialog
  bind:visible={resetDialogVisible}
  currentConfig={getCurrentTemplateConfig()}
  incomingConfig={resetDialogIncoming}
  title={resetMode === 'palette' ? t('reset_palette') : t('reset_effects')}
  confirmLabel={t('diff_confirm_reset')}
  showUnchangedEffects={false}
  onConfirm={handleResetConfirm}
/>

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

  .section-reset-btn {
    padding: 2px 8px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: transparent;
    color: var(--pv-text-muted);
    font-size: 0.65rem;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--pv-duration);
  }
  .section-reset-btn:hover:not(:disabled) {
    background: var(--pv-bg-hover);
    color: var(--pv-text);
    border-color: var(--pv-border-hover);
  }
  .section-reset-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
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

  .effect-label {
    flex: 1;
    font-size: 0.73rem;
    color: var(--pv-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .effect-type {
    font-size: 0.6rem;
    color: var(--pv-text-muted);
    font-family: var(--pv-font-mono);
    flex-shrink: 0;
  }

  .effect-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .effect-item:hover .effect-actions { opacity: 1; }

  /* Effects origin coloring */
  .effect-origin-modified {
    border-left: 2px solid #e0a030;
  }
  .effect-origin-modified .effect-label { color: #e0a030; }
  .effect-origin-new {
    border-left: 2px solid #4caf50;
  }
  .effect-origin-new .effect-label { color: #4caf50; }

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
    gap: 4px;
    margin-top: 8px;
  }
  .custom-item-card {
    display: flex;
    flex-direction: column;
    padding: 6px 8px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid transparent;
    transition: background 0.1s, border-color 0.1s;
  }
  .custom-item-card:hover {
    background: var(--pv-bg-hover);
    border-color: var(--pv-border);
  }
  .custom-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .custom-name {
    font-size: 0.75rem;
    color: var(--pv-text);
    font-weight: 500;
  }
  .custom-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .custom-item-card:hover .custom-actions { opacity: 1; }
  .custom-item-meta {
    display: flex;
    justify-content: space-between;
    margin-top: 2px;
  }
  .custom-base {
    font-size: 0.6rem;
    color: var(--pv-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .custom-date {
    font-size: 0.6rem;
    color: var(--pv-text-muted);
    flex-shrink: 0;
    margin-left: 6px;
  }

  /* Share panel (OBS-like expand) */
  .share-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
    padding: 8px;
    background: var(--pv-bg-elevated);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
    animation: fadeIn 0.12s ease;
  }

  .share-panel-option {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: var(--pv-radius-sm);
    background: transparent;
    color: var(--pv-text-secondary);
    font-size: 0.72rem;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    transition: all 0.1s;
  }
  .share-panel-option:hover {
    background: var(--pv-bg-hover);
    color: var(--pv-text);
  }

  /* Delete confirm bar */
  .delete-confirm-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    padding: 4px 6px;
    background: rgba(255, 50, 50, 0.08);
    border: 1px solid rgba(255, 50, 50, 0.2);
    border-radius: var(--pv-radius-sm);
    animation: fadeIn 0.12s ease;
  }
  .delete-confirm-text {
    font-size: 0.68rem;
    color: var(--pv-danger, #f44);
    flex: 1;
  }
  .btn-sm {
    padding: 2px 8px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text-secondary);
    font-size: 0.65rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.1s;
  }
  .btn-sm:hover { background: var(--pv-bg-hover); color: var(--pv-text); }
  .btn-sm.danger {
    border-color: rgba(255, 50, 50, 0.4);
    color: var(--pv-danger, #f44);
  }
  .btn-sm.danger:hover {
    background: rgba(255, 50, 50, 0.15);
  }

  /* Save advanced */
  .save-advanced-toggle {
    margin-top: 4px;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--pv-text-muted);
    font-size: 0.68rem;
    font-family: inherit;
    cursor: pointer;
    padding: 2px 0;
    transition: color 0.15s;
  }
  .btn-link:hover { color: var(--pv-text); }

  .save-advanced-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    margin-top: 2px;
    background: var(--pv-bg-elevated);
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    animation: fadeIn 0.12s ease;
  }

  .option-check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--pv-text-secondary);
    cursor: pointer;
  }
  .option-check input[type="checkbox"] {
    accent-color: var(--pv-accent);
  }
  .option-check span { user-select: none; }

  @media (max-width: 768px) {
    .editor-panel {
      width: 100%;
      border-left: none;
    }
  }
</style>
