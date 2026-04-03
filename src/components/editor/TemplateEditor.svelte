<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import ExpandPanel from '../common/ExpandPanel.svelte';
  import { tick, untrack } from 'svelte';
  import Section from '../common/Section.svelte';
  import UnsavedChangesDialog from '../common/UnsavedChangesDialog.svelte';
  import EffectConfigPane from './EffectConfigPane.svelte';
  import TemplateDiffDialog from './TemplateDiffDialog.svelte';
  import {
    engine, showToast,
    saveCurrentAsTemplate, deleteCustomTemplate,
    exportShareCode,
    getCurrentTemplateConfig, getResetBaselineConfig,
    loadTemplateWithOptions, addCustomTemplate, overwriteCurrentToCustomTemplate,
    markEditorDirty,
    resetPalette, resetEffects,
    setMediaOutline, setAutoExtractColors, setMotionDetection, setInvertMedia, setThresholdMedia,
  } from '../../stores/engine.svelte';
  import type { MissingMode, SaveTemplateOptions } from '../../stores/engine.svelte';
  import { decodeShareCode } from '../../services/templateStore';
  import { effectCatalog, type EffectPreset } from '../../engine/effectCatalog';
  import type { EffectEntry, ColorPalette, TemplateConfig } from '../../types/engine';
  import { t } from '../../i18n';
  import { v2Registry } from '../../effects/v2/registry';

  // Build a lookup: effectType → localized label
  const effectLabelMap = new Map<string, string>();
  for (const preset of effectCatalog) {
    if (!effectLabelMap.has(preset.type)) effectLabelMap.set(preset.type, preset.label);
  }

  type EditorGuideRequest = {
    token: number;
    target: 'template-actions';
  } | null;

  let {
    visible = $bindable(false),
    guideRequest = null as EditorGuideRequest,
    onRequestTemplateGuide = () => {},
  } = $props();

  // ── Local editor state ──
  let activeEffectIndex = $state<number | null>(null);
  let showCatalog = $state(false);
  let catalogFilter = $state('');
  let saveDialogOpen = $state(false);
  let saveName = $state('');
  let saveNameInput = $state<HTMLInputElement | null>(null);
  let saveComboboxEl = $state<HTMLDivElement | null>(null);
  let saveSuggestionOpen = $state(false);
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
  let editorConfirmVisible = $state(false);
  let pendingEditorAction = $state<(() => void) | null>(null);

  type EditorDialogMode = 'import-share' | 'load-custom' | 'reset-template' | 'reset-palette' | 'reset-effects';

  let editorDialogVisible = $state(false);
  let editorDialogIncoming = $state<TemplateConfig | null>(null);
  let editorDialogMode = $state<EditorDialogMode | null>(null);
  let pendingCustomLoadIndex = $state<number | null>(null);
  let editorDialogMissingMode = $state<MissingMode>('reset');
  let loadedBaselineKey = $state<string | null>(null);
  let loadedBaselineConfig = $state<TemplateConfig | null>(null);
  let templateActionsAnchor = $state<HTMLDivElement | null>(null);
  let templateActionsGuided = $state(false);
  let handledGuideToken = $state(0);
  let templateActionsGuideTimer: ReturnType<typeof setTimeout> | null = null;

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

  function getReactiveCurrentTemplateConfig(): TemplateConfig | null {
    void effectsVersion;
    void engine.segmentDuration;
    void engine.animationSpeed;
    void engine.motionIntensity;
    void engine.effectOpacity;
    void engine.bpm;
    void engine.beatReactivity;
    void engine.shake;
    void engine.zoom;
    void engine.tilt;
    void engine.glitch;
    void engine.hueShift;
    void engine.mediaOutline;
    void engine.autoExtractColors;
    void engine.motionDetection;
    void engine.invertMedia;
    void engine.thresholdMedia;
    return getCurrentTemplateConfig();
  }

  function cloneTemplateConfig(tpl: TemplateConfig): TemplateConfig {
    return {
      ...tpl,
      palette: { ...tpl.palette },
      effects: tpl.effects.map(effect => ({ ...effect, config: { ...effect.config } })),
      postfx: tpl.postfx ? { ...tpl.postfx } : undefined,
      features: tpl.features ? { ...tpl.features } : undefined,
    };
  }

  function areEffectsEqual(left: EffectEntry[], right: EffectEntry[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((effect, index) => {
      const other = right[index];
      if (!other) return false;
      return effect.type === other.type
        && effect.layer === other.layer
        && JSON.stringify(effect.config) === JSON.stringify(other.config);
    });
  }

  function hasPaletteChangesAgainst(targetPalette: ColorPalette | null): boolean {
    if (!targetPalette) return false;
    const currentPalette = getCurrentPalette();
    return paletteKeys.some(key => currentPalette[key] !== targetPalette[key]);
  }

  function hasEffectsChangesAgainst(targetEffects: EffectEntry[] | null): boolean {
    if (!targetEffects) return false;
    return !areEffectsEqual(getCurrentEffects(), targetEffects);
  }

  function serializeTemplateForResetCheck(tpl: TemplateConfig | null): string {
    if (!tpl) return '';
    return JSON.stringify({
      palette: tpl.palette,
      effects: tpl.effects.map(effect => ({ type: effect.type, layer: effect.layer, config: effect.config })),
      segmentDuration: tpl.segmentDuration,
      bpm: tpl.bpm,
      beatReactivity: tpl.beatReactivity,
      animationSpeed: tpl.animationSpeed,
      motionIntensity: tpl.motionIntensity,
      bgOpacity: tpl.bgOpacity,
      postfx: {
        shake: tpl.postfx?.shake ?? 0,
        zoom: tpl.postfx?.zoom ?? 0,
        tilt: tpl.postfx?.tilt ?? 0,
        glitch: tpl.postfx?.glitch ?? 0,
        hueShift: tpl.postfx?.hueShift ?? 0,
      },
      features: {
        mediaOutline: tpl.features?.mediaOutline ?? false,
        autoExtractColors: tpl.features?.autoExtractColors ?? false,
        motionDetection: tpl.features?.motionDetection ?? false,
        invertMedia: tpl.features?.invertMedia ?? false,
        thresholdMedia: tpl.features?.thresholdMedia ?? false,
      },
    });
  }

  function canResetTemplate(): boolean {
    const current = getReactiveCurrentTemplateConfig();
    if (!current || !loadedBaselineConfig) return false;
    return serializeTemplateForResetCheck(current) !== serializeTemplateForResetCheck(loadedBaselineConfig);
  }

  function canResetPalette(): boolean {
    return hasPaletteChangesAgainst(loadedBaselineConfig?.palette ?? null);
  }

  function canResetEffects(): boolean {
    return hasEffectsChangesAgainst(loadedBaselineConfig?.effects ?? null);
  }

  function getResetTooltip(label: string, enabled: boolean): string | undefined {
    return enabled ? `⚠ ${label}` : undefined;
  }

  $effect(() => {
    void engine.resetBaselineVersion;
    const baseline = getResetBaselineConfig();
    const nextKey = baseline ? serializeTemplateForResetCheck(baseline) : null;

    if (nextKey !== loadedBaselineKey) {
      loadedBaselineKey = nextKey;
      loadedBaselineConfig = baseline
        ? untrack(() => cloneTemplateConfig(baseline))
        : null;
    }
  });

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

  function handleFeatureChange(feature: 'mediaOutline' | 'autoExtractColors' | 'motionDetection' | 'invertMedia' | 'thresholdMedia', checked: boolean) {
    if (feature === 'mediaOutline') setMediaOutline(checked);
    else if (feature === 'autoExtractColors') setAutoExtractColors(checked);
    else if (feature === 'motionDetection') setMotionDetection(checked);
    else if (feature === 'invertMedia') setInvertMedia(checked);
    else if (feature === 'thresholdMedia') setThresholdMedia(checked);

    if (checked) {
      if ((feature === 'mediaOutline' || feature === 'autoExtractColors' || feature === 'invertMedia' || feature === 'thresholdMedia') && !engine.mediaLoaded) {
        showToast(t('feature_preview_need_media'));
      }
      if (feature === 'motionDetection' && !engine.isVideoMedia) {
        showToast(t('feature_preview_need_video'));
      }
      if (feature === 'invertMedia' || feature === 'thresholdMedia') {
        showToast(t('feature_invert_threshold_exclusive'));
      }
    }

    markEditorDirty();
  }

  function getSaveOptions(): SaveTemplateOptions {
    return {
      animation: saveIncludeAnimation,
      postfx: saveIncludePostfx,
      features: saveIncludeFeatures,
    };
  }

  function normalizeTemplateName(name: string): string {
    return name.trim().toLocaleLowerCase();
  }

  function getExactSaveMatchIndex(): number | null {
    const normalized = normalizeTemplateName(saveName);
    if (!normalized) return null;
    const matchedIndex = engine.customTemplates.findIndex(template => normalizeTemplateName(template.name) === normalized);
    return matchedIndex >= 0 ? matchedIndex : null;
  }

  function getFilteredSaveSuggestions() {
    const normalized = normalizeTemplateName(saveName);
    return engine.customTemplates
      .map((template, index) => ({ template, index }))
      .filter(({ template }) => !normalized || normalizeTemplateName(template.name).includes(normalized));
  }

  function handleSaveAction() {
    if (!saveName.trim()) return;
    const exactMatchIndex = getExactSaveMatchIndex();
    const opts: SaveTemplateOptions = {
      ...getSaveOptions(),
    };
    if (exactMatchIndex !== null) {
      overwriteCurrentToCustomTemplate(exactMatchIndex, opts);
      closeSaveDialog();
      showToast(t('overwrite_saved'));
      return;
    }

    saveCurrentAsTemplate(saveName.trim(), opts);
    closeSaveDialog();
    showToast(t('saved'));
  }

  function openSaveDialog() {
    if (saveDialogOpen) {
      closeSaveDialog();
      return;
    }
    saveDialogOpen = true;
    shareDialogOpen = false;
    shareCodeInput = '';
    saveName = '';
    saveAdvanced = false;
    saveSuggestionOpen = false;
  }

  function closeSaveDialog() {
    saveDialogOpen = false;
    saveName = '';
    saveAdvanced = false;
    saveSuggestionOpen = false;
  }

  function openImportDialog() {
    if (shareDialogOpen) {
      closeImportDialog();
      return;
    }
    shareDialogOpen = true;
    saveDialogOpen = false;
    saveName = '';
    saveAdvanced = false;
    saveSuggestionOpen = false;
  }

  function closeImportDialog() {
    shareDialogOpen = false;
    shareCodeInput = '';
  }

  function selectSaveSuggestion(name: string) {
    saveName = name;
    saveNameInput?.focus();
  }

  function handleSaveComboboxFocusIn() {
    saveSuggestionOpen = true;
  }

  function handleSaveComboboxFocusOut() {
    setTimeout(() => {
      if (!saveComboboxEl?.contains(document.activeElement)) {
        saveSuggestionOpen = false;
      }
    }, 0);
  }

  function guardEditorSwitch(action: () => void) {
    if (engine.customDirty) {
      pendingEditorAction = action;
      editorConfirmVisible = true;
    } else {
      action();
    }
  }

  function handleEditorConfirmDiscard() {
    editorConfirmVisible = false;
    pendingEditorAction?.();
    pendingEditorAction = null;
  }

  function handleEditorConfirmCancel() {
    editorConfirmVisible = false;
    pendingEditorAction = null;
  }

  function handleEditorConfirmSave() {
    editorConfirmVisible = false;
    if (pendingEditorAction) onRequestTemplateGuide();
    pendingEditorAction = null;
  }

  function triggerTemplateActionsGuide() {
    if (templateActionsGuideTimer) {
      clearTimeout(templateActionsGuideTimer);
    }
    templateActionsGuided = false;
    requestAnimationFrame(() => {
      templateActionsGuided = true;
      templateActionsGuideTimer = setTimeout(() => {
        templateActionsGuided = false;
      }, 1800);
    });
  }

  $effect(() => {
    const request = guideRequest;
    if (!visible || !request || request.token === handledGuideToken) return;
    handledGuideToken = request.token;

    void (async () => {
      await tick();
      if (request.target === 'template-actions' && templateActionsAnchor) {
        templateActionsAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        triggerTemplateActionsGuide();
      }
    })();
  });

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

  function openEditorDialog(mode: EditorDialogMode, incoming: TemplateConfig, customIndex: number | null = null) {
    editorDialogMode = mode;
    editorDialogIncoming = incoming;
    pendingCustomLoadIndex = customIndex;
    editorDialogMissingMode = incoming.baseTemplateName ? 'builtin' : 'reset';
    editorDialogVisible = true;
  }

  function closeEditorDialog() {
    editorDialogVisible = false;
    editorDialogIncoming = null;
    editorDialogMode = null;
    pendingCustomLoadIndex = null;
  }

  async function handleImport() {
    if (!shareCodeInput.trim()) return;
    try {
      const tpl = await decodeShareCode(shareCodeInput.trim());
      guardEditorSwitch(() => {
        openEditorDialog('import-share', tpl);
        shareDialogOpen = false;
        shareCodeInput = '';
      });
    } catch {
      showToast('Import failed');
    }
  }

  function handleLoadCustomTemplate(index: number) {
    const tpl = engine.customTemplates[index];
    if (!tpl) return;
    guardEditorSwitch(() => openEditorDialog('load-custom', tpl, index));
  }

  function handleResetPaletteClick() {
    if (!canResetPalette()) return;
    const cur = getCurrentTemplateConfig();
    if (!cur) return;
    const baseline = loadedBaselineConfig;
    if (!baseline?.palette) return;
    openEditorDialog('reset-palette', {
      ...cur,
      name: baseline.nameKey ? t(baseline.nameKey as any) : baseline.name,
      palette: { ...baseline.palette },
    });
  }

  function handleResetEffectsClick() {
    if (!canResetEffects()) return;
    const cur = getCurrentTemplateConfig();
    if (!cur) return;
    const baseline = loadedBaselineConfig;
    if (!baseline) return;
    openEditorDialog('reset-effects', {
      ...cur,
      name: baseline.nameKey ? t(baseline.nameKey as any) : baseline.name,
      effects: baseline.effects.map((e: EffectEntry) => ({ ...e, config: { ...e.config } })),
    });
  }

  function handleResetTemplateClick() {
    if (!canResetTemplate()) return;
    const incoming = loadedBaselineConfig;
    if (!incoming) return;
    openEditorDialog('reset-template', incoming);
  }

  function handleEditorDialogConfirm() {
    if (!editorDialogMode) return;

    if (editorDialogMode === 'import-share') {
      if (!editorDialogIncoming) return;
      const customIndex = addCustomTemplate(editorDialogIncoming);
      loadTemplateWithOptions(editorDialogIncoming, { missingMode: editorDialogMissingMode, customIndex });
      effectsVersion++;
      showToast(t('imported'));
    } else if (editorDialogMode === 'load-custom') {
      if (!editorDialogIncoming || pendingCustomLoadIndex === null) return;
      loadTemplateWithOptions(editorDialogIncoming, { missingMode: editorDialogMissingMode, customIndex: pendingCustomLoadIndex });
      effectsVersion++;
      showToast(t('loaded'));
    } else if (editorDialogMode === 'reset-template') {
      if (!editorDialogIncoming) return;
      if (engine.currentTemplateIndex >= 0) {
        loadTemplateWithOptions(editorDialogIncoming, { missingMode: 'keep', builtinIndex: engine.currentTemplateIndex });
      } else if (engine.loadedCustomIndex >= 0) {
        loadTemplateWithOptions(editorDialogIncoming, { missingMode: 'keep', customIndex: engine.loadedCustomIndex });
      } else {
        loadTemplateWithOptions(editorDialogIncoming, { missingMode: 'keep' });
      }
      effectsVersion++;
      showToast(t('reset_template'));
    } else if (editorDialogMode === 'reset-palette') {
      resetPalette();
      effectsVersion++;
      showToast(t('reset_palette'));
    } else if (editorDialogMode === 'reset-effects') {
      resetEffects();
      effectsVersion++;
      showToast(t('reset_effects'));
    }

    closeEditorDialog();
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
        <button class="reset-btn" title={getResetTooltip(t('reset_template'), canResetTemplate())} disabled={!canResetTemplate()} onclick={handleResetTemplateClick}>↺ {t('reset_template')}</button>
        <button class="close-btn" onclick={() => visible = false}>✕</button>
      </div>
    </div>

    <!-- Palette Section -->
    <Section label={t('palette')}>
      {#snippet action()}
        <button class="section-reset-btn" title={getResetTooltip(t('reset_palette'), canResetPalette())} disabled={!canResetPalette()} onclick={handleResetPaletteClick}>↺ {t('reset_palette')}</button>
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

    <!-- Template Features -->
    <Section label={t('template_features')} open={false}>
      <div class="feature-list">
        <label class="feature-toggle">
          <input
            type="checkbox"
            checked={engine.mediaOutline}
            onchange={(e: Event) => handleFeatureChange('mediaOutline', (e.target as HTMLInputElement).checked)}
          />
          <div class="feature-copy">
            <span class="feature-label">{t('feature_media_outline')}</span>
            <span class="feature-hint">{t('feature_media_outline_hint')}</span>
          </div>
        </label>

        <label class="feature-toggle">
          <input
            type="checkbox"
            checked={engine.autoExtractColors}
            onchange={(e: Event) => handleFeatureChange('autoExtractColors', (e.target as HTMLInputElement).checked)}
          />
          <div class="feature-copy">
            <span class="feature-label">{t('feature_auto_extract_colors')}</span>
            <span class="feature-hint">{t('feature_auto_extract_colors_hint')}</span>
          </div>
        </label>

        <label class="feature-toggle">
          <input
            type="checkbox"
            checked={engine.motionDetection}
            onchange={(e: Event) => handleFeatureChange('motionDetection', (e.target as HTMLInputElement).checked)}
          />
          <div class="feature-copy">
            <span class="feature-label">{t('feature_motion_detection')}</span>
            <span class="feature-hint">{t('feature_motion_detection_hint')}</span>
          </div>
        </label>

        <label class="feature-toggle">
          <input
            type="checkbox"
            checked={engine.invertMedia}
            onchange={(e: Event) => handleFeatureChange('invertMedia', (e.target as HTMLInputElement).checked)}
          />
          <div class="feature-copy">
            <span class="feature-label">{t('feature_invert_media')}</span>
            <span class="feature-hint">{t('feature_invert_media_hint')}</span>
          </div>
        </label>

        <label class="feature-toggle">
          <input
            type="checkbox"
            checked={engine.thresholdMedia}
            onchange={(e: Event) => handleFeatureChange('thresholdMedia', (e.target as HTMLInputElement).checked)}
          />
          <div class="feature-copy">
            <span class="feature-label">{t('feature_threshold_media')}</span>
            <span class="feature-hint">{t('feature_threshold_media_hint')}</span>
          </div>
        </label>
      </div>
    </Section>

    <!-- Effects List -->
    <Section label={t('effects_list')}>
      {#snippet action()}
        <button class="section-reset-btn" title={getResetTooltip(t('reset_effects'), canResetEffects())} disabled={!canResetEffects()} onclick={handleResetEffectsClick}>↺ {t('reset_effects')}</button>
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
              <button class="pv-btn-icon icon-btn" title="Move up" onclick={(e: MouseEvent) => { e.stopPropagation(); moveEffect(i, -1); }}>↑</button>
              <button class="pv-btn-icon icon-btn" title="Move down" onclick={(e: MouseEvent) => { e.stopPropagation(); moveEffect(i, 1); }}>↓</button>
              <button class="pv-btn-icon pv-btn-icon-danger icon-btn danger" title="Remove" onclick={(e: MouseEvent) => { e.stopPropagation(); removeEffect(i); }}>✕</button>
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

      <button class="pv-btn btn add-btn" onclick={() => showCatalog = !showCatalog}>
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
    <div class="template-actions-anchor" bind:this={templateActionsAnchor} class:guided={templateActionsGuided}>
      <Section label={t('template_actions')}>
      <div class="action-row">
        <button class="pv-btn btn" onclick={openSaveDialog}>💾 {t('save_template')}</button>
        <button class="pv-btn btn" onclick={openImportDialog}>📥 {t('import_code')}</button>
      </div>

      {#if saveDialogOpen}
        {@const exactSaveMatchIndex = getExactSaveMatchIndex()}
        {@const saveSuggestions = getFilteredSaveSuggestions()}
        <div class="inline-dialog">
          <div
            class="save-combobox"
            bind:this={saveComboboxEl}
            onfocusin={handleSaveComboboxFocusIn}
            onfocusout={handleSaveComboboxFocusOut}
          >
            <input
              type="text"
              class="pv-input pv-input-compact pv-control-grow dialog-input save-input"
              placeholder={t('save_template_search_placeholder')}
              bind:this={saveNameInput}
              bind:value={saveName}
              onfocus={handleSaveComboboxFocusIn}
              onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSaveAction()}
            />

            {#if saveSuggestionOpen}
              <div class="save-suggestions" role="listbox" aria-label={t('save_template')}>
                {#if saveSuggestions.length > 0}
                  {#each saveSuggestions as { template, index }}
                    <button
                      class="save-suggestion-row custom-item-card"
                      class:selected={exactSaveMatchIndex === index}
                      title={`名称: ${template.name}\n基础: ${template.baseTemplateName ? getBaseDisplayName(template) : t('custom_from_scratch')}\n日期: ${template.lastModified ? formatDate(template.lastModified) : '--'}`}
                      onmousedown={(e: MouseEvent) => e.preventDefault()}
                      onclick={() => selectSaveSuggestion(template.name)}
                    >
                      <div class="custom-item-row">
                        <span class="custom-name">{template.name}</span>
                      </div>
                      <div class="custom-item-meta save-suggestion-meta">
                        <span class="custom-base">{template.baseTemplateName ? t('based_on') + ' ' + getBaseDisplayName(template) : t('custom_from_scratch')}</span>
                        <span class="custom-date save-suggestion-date-line">{template.lastModified ? formatDate(template.lastModified) : '--'}</span>
                      </div>
                    </button>
                  {/each}
                {:else}
                  <div class="save-suggestion-empty custom-item-card">{t('save_template_new_hint')}</div>
                {/if}
              </div>
            {/if}
          </div>

          <button class="pv-btn pv-btn-accent btn accent dialog-action-btn" onclick={handleSaveAction} disabled={!saveName.trim()}>
            {exactSaveMatchIndex !== null ? t('overwrite') : t('save')}
          </button>
          <button class="pv-btn btn dialog-action-btn" onclick={closeSaveDialog}>{t('cancel')}</button>
        </div>

        <div class="save-advanced-toggle">
          <button class="pv-btn-link btn-link" onclick={() => saveAdvanced = !saveAdvanced}>
            {saveAdvanced ? '▾' : '▸'} {t('save_advanced')}
          </button>
        </div>
        <ExpandPanel visible={saveAdvanced} padding="6px 8px" gap="4px" marginTop="2px">
          {#snippet children()}
            <label class="pv-check-row" title={t('save_include_animation')}>
              <input type="checkbox" bind:checked={saveIncludeAnimation} />
              <span class="pv-check-text">{t('save_include_animation')}</span>
            </label>
            <label class="pv-check-row" title={t('save_include_postfx')}>
              <input type="checkbox" bind:checked={saveIncludePostfx} />
              <span class="pv-check-text">{t('save_include_postfx')}</span>
            </label>
            <label class="pv-check-row" title={t('save_include_features')}>
              <input type="checkbox" bind:checked={saveIncludeFeatures} />
              <span class="pv-check-text">{t('save_include_features')}</span>
            </label>
          {/snippet}
        </ExpandPanel>
      {/if}

      {#if shareDialogOpen}
        <div class="inline-dialog">
          <input
            type="text"
            class="pv-input pv-input-compact pv-control-grow dialog-input"
            placeholder={t('paste_share_code')}
            bind:value={shareCodeInput}
          />
          <button class="pv-btn pv-btn-accent btn accent dialog-action-btn" onclick={handleImport}>{t('import')}</button>
          <button class="pv-btn btn dialog-action-btn" onclick={closeImportDialog}>{t('cancel')}</button>
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
                  <button class="pv-btn-icon icon-btn" title={t('load_template')} onclick={() => handleLoadCustomTemplate(i)}>▶</button>
                  <button class="pv-btn-icon icon-btn" title={t('share')} onclick={() => toggleShareMenu(i)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  </button>
                  <button class="pv-btn-icon pv-btn-icon-danger icon-btn danger" title={t('delete_tpl')} onclick={() => deleteConfirmIndex = i}>✕</button>
                </div>
              </div>
              <div class="custom-item-meta">
                <span class="custom-base">{ct.baseTemplateName ? t('based_on') + ' ' + getBaseDisplayName(ct) : t('custom_from_scratch')}</span>
                {#if ct.lastModified}
                  <span class="custom-date">{formatDate(ct.lastModified)}</span>
                {/if}
              </div>
              <ExpandPanel visible={shareMenuIndex === i}>
                {#snippet children()}
                  <button class="share-panel-option" onclick={() => { handleExport(i); shareMenuIndex = null; }}>
                    🔗 {t('copy_sharecode')}
                  </button>
                  <button class="share-panel-option" onclick={() => { handleCopyFullUrl(i); shareMenuIndex = null; }}>
                    🌐 {t('copy_full_url')}
                  </button>
                  <button class="share-panel-option" onclick={() => { handleCopyEffectsList(i); shareMenuIndex = null; }}>
                    📝 {t('copy_effects_list')}
                  </button>
                {/snippet}
              </ExpandPanel>
              {#if deleteConfirmIndex === i}
                <div class="delete-confirm-bar">
                  <span class="delete-confirm-text">{t('confirm_delete')}?</span>
                  <button class="pv-btn pv-btn-xs btn-sm danger" onclick={() => { deleteCustomTemplate(i); deleteConfirmIndex = null; }}>{t('confirm')}</button>
                  <button class="pv-btn pv-btn-xs btn-sm" onclick={() => deleteConfirmIndex = null}>{t('cancel')}</button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
      </Section>
    </div>
  </div>
{/if}

<UnsavedChangesDialog
  visible={editorConfirmVisible}
  onSave={handleEditorConfirmSave}
  onConfirm={handleEditorConfirmDiscard}
  onCancel={handleEditorConfirmCancel}
/>

<TemplateDiffDialog
  visible={editorDialogVisible}
  currentConfig={editorDialogVisible ? getCurrentTemplateConfig() : null}
  incomingConfig={editorDialogIncoming}
  title={editorDialogMode === 'reset-template' ? t('reset_template') : editorDialogMode === 'reset-palette' ? t('reset_palette') : editorDialogMode === 'reset-effects' ? t('reset_effects') : null}
  confirmLabel={editorDialogMode?.startsWith('reset-') ? t('diff_confirm_reset') : t('diff_confirm_load')}
  showUnchangedEffects={editorDialogMode === 'import-share' || editorDialogMode === 'load-custom'}
  missingMode={editorDialogMissingMode}
  onMissingModeChange={(mode: MissingMode) => editorDialogMissingMode = mode}
  onClose={closeEditorDialog}
  onConfirm={handleEditorDialogConfirm}
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

  .template-actions-anchor {
    border-radius: var(--pv-radius);
    scroll-margin-top: 12px;
    transition: box-shadow 0.2s ease, background 0.2s ease;
  }

  .template-actions-anchor.guided {
    background: linear-gradient(180deg, rgba(99, 102, 241, 0.08), transparent 72%);
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.45), 0 0 0 6px rgba(99, 102, 241, 0.12), 0 0 24px rgba(99, 102, 241, 0.16);
  }

  .save-combobox {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
  }

  .dialog-input,
  .save-input {
    width: 100%;
    min-height: 44px;
  }

  .save-suggestions {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius);
    background: rgba(19, 20, 32, 0.96);
    backdrop-filter: blur(18px) saturate(1.2);
    box-shadow: var(--pv-shadow-lg);
    max-height: min(280px, 42vh);
    overflow-y: auto;
  }

  .save-suggestion-row {
    width: 100%;
    padding: 8px 10px;
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    text-align: left;
    cursor: pointer;
  }

  .save-suggestion-row:hover {
    background: var(--pv-bg-hover);
    border-color: var(--pv-border);
  }

  .save-suggestion-row.selected {
    border-color: rgba(99, 102, 241, 0.6);
    background: rgba(99, 102, 241, 0.12);
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.22);
  }

  .save-suggestion-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    margin-top: 4px;
  }

  .save-suggestion-meta .custom-base,
  .save-suggestion-meta .custom-date {
    margin-left: 0;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .save-suggestion-date-line {
    display: block;
  }

  .save-suggestion-empty {
    display: block;
    padding: 8px 10px;
    background: var(--pv-bg-elevated);
    border-color: var(--pv-border);
    font-size: 0.68rem;
    color: var(--pv-text-muted);
  }

  .save-suggestion-empty {
    line-height: 1.5;
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
  .reset-btn:hover:not(:disabled) {
    background: var(--pv-bg-hover);
    color: var(--pv-text);
    border-color: var(--pv-border-hover);
  }
  .reset-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
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

  /* Features */
  .feature-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .feature-toggle {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 10px;
    border-radius: var(--pv-radius-sm);
    background: var(--pv-bg-elevated);
    border: 1px solid var(--pv-border);
    cursor: pointer;
  }

  .feature-toggle input[type="checkbox"] {
    margin-top: 2px;
    accent-color: var(--pv-accent);
  }

  .feature-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .feature-label {
    font-size: 0.72rem;
    color: var(--pv-text);
  }

  .feature-hint {
    font-size: 0.63rem;
    color: var(--pv-text-muted);
    line-height: 1.35;
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
    align-items: stretch;
    margin-top: 6px;
    animation: fadeIn 0.15s ease;
  }

  .dialog-action-btn {
    min-height: 44px;
    align-self: stretch;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

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
  }

  @media (max-width: 768px) {
    .editor-panel {
      width: 100%;
      border-left: none;
    }
  }
</style>
