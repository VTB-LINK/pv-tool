<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import ExpandPanel from '../common/ExpandPanel.svelte';
  import TemplateLivePreview from './TemplateLivePreview.svelte';
  import type { MissingMode } from '../../stores/engine.svelte';
  import { getTemplateEffectDiffs, getTemplateParamDiffGroups } from '../../services/templateDiff';
  import type { TemplateConfig } from '../../types/engine';
  import { getEffectDisplayLabel } from '../../engine/effectCatalog';
  import { t } from '../../i18n';
  import { engine } from '../../stores/engine.svelte';
  import { onMount, onDestroy } from 'svelte';

  let {
    visible = false,
    currentConfig = null as TemplateConfig | null,
    incomingConfig = null as TemplateConfig | null,
    title = null as string | null,
    confirmLabel = null as string | null,
    showUnchangedEffects = true,
    missingMode = 'reset' as MissingMode,
    requireName = false,
    showImportName = false,
    highlightImportName = false,
    importName = '',
    importNamePlaceholder = '',
    warningMessage = null as string | null,
    secondaryActionLabel = null as string | null,
    confirmAction = 'import' as 'import' | 'overwrite',
    onMissingModeChange = (_mode: MissingMode) => {},
    onImportNameChange = (_value: string) => {},
    onSecondaryAction = () => {},
    onClose = () => {},
    onConfirm = (_opts: { missingMode: MissingMode; importName?: string; importAction?: 'import' | 'overwrite' }) => {},
  }: {
    visible?: boolean;
    currentConfig?: TemplateConfig | null;
    incomingConfig?: TemplateConfig | null;
    title?: string | null;
    confirmLabel?: string | null;
    showUnchangedEffects?: boolean;
    missingMode?: MissingMode;
    requireName?: boolean;
    showImportName?: boolean;
    highlightImportName?: boolean;
    importName?: string;
    importNamePlaceholder?: string;
    warningMessage?: string | null;
    secondaryActionLabel?: string | null;
    confirmAction?: 'import' | 'overwrite';
    onMissingModeChange?: (mode: MissingMode) => void;
    onImportNameChange?: (value: string) => void;
    onSecondaryAction?: () => void;
    onClose?: () => void;
    onConfirm?: (opts: { missingMode: MissingMode; importName?: string; importAction?: 'import' | 'overwrite' }) => void;
  } = $props();
  let paramDiffGroups = $derived(getTemplateParamDiffGroups(currentConfig, incomingConfig));

  interface PaletteDiff {
    key: string;
    current: string;
    incoming: string;
  }

  let effectDiffs = $derived(
    getTemplateEffectDiffs(currentConfig, incomingConfig, showUnchangedEffects).map(item => ({
      ...item,
      label: getEffectDisplayLabel(item),
    }))
  );
  let expandedComplexKeys = $state<Record<string, boolean>>({});
  let previewCollapsed = $state(false);

  function getPaletteDiff(): PaletteDiff[] {
    if (!currentConfig?.palette || !incomingConfig?.palette) return [];
    const keys = ['background', 'primary', 'secondary', 'accent', 'text'] as const;
    return keys
      .filter(k => currentConfig!.palette[k] !== incomingConfig!.palette[k])
      .map(k => ({ key: k, current: currentConfig!.palette[k], incoming: incomingConfig!.palette[k] }));
  }

  function hasMissingParams() {
    return paramDiffGroups.some(group => group.items.some(item => item.missing));
  }

  function getEffectCardKey(index: number, effectType: string) {
    return `${index}:${effectType}`;
  }

  function isComplexExpanded(index: number, effectType: string) {
    return !!expandedComplexKeys[getEffectCardKey(index, effectType)];
  }

  function toggleComplexExpanded(index: number, effectType: string) {
    const key = getEffectCardKey(index, effectType);
    expandedComplexKeys = {
      ...expandedComplexKeys,
      [key]: !expandedComplexKeys[key],
    };
  }

  function getComplexToggleLabel(count: number, expanded: boolean) {
    return `${expanded ? t('collapse') : t('expand')} ${t('diff_effect_complex')} (${count})`;
  }

  function getComplexKindLabel(kind: 'array' | 'object') {
    return kind === 'array' ? t('diff_effect_array') : t('diff_effect_object');
  }

  $effect(() => {
    if (!visible) {
      expandedComplexKeys = {};
      previewCollapsed = false;
    }
  });

  function handleConfirm() {
    if (requireName && !importName.trim()) return;
    onConfirm({ missingMode, importName: importName.trim() || undefined, importAction: confirmAction });
    onClose();
  }

  function handleOverlayKeydown(event: KeyboardEvent) {
    if (!visible) return;
    
    // Let input fields handle their own keydown events
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleConfirm();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleOverlayKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleOverlayKeydown);
  });
</script>

{#if visible && currentConfig && incomingConfig}
  <div
    class="diff-overlay"
    role="button"
    tabindex="0"
    aria-label={t('cancel')}
    onclick={() => onClose()}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onClose()}
  ></div>
  <div class="diff-dialog">
    {#if showImportName}
      <div class="diff-title-row">
        <h3 class="diff-title">{title ?? t('diff_title')}</h3>
        <input
          type="text"
          class="pv-input pv-input-compact import-name-input"
          class:highlight={highlightImportName}
          value={importName}
          placeholder={importNamePlaceholder}
          oninput={(event: Event) => onImportNameChange((event.target as HTMLInputElement).value)}
        />
      </div>
      {#if warningMessage}
        <div class="diff-warning">{warningMessage}</div>
      {/if}
    {:else}
      <h3 class="diff-title">{title ?? (incomingConfig.name?.trim() ? (t('diff_title') + ': ' + (incomingConfig.nameKey ? t(incomingConfig.nameKey as any) : incomingConfig.name)) : t('diff_title'))}</h3>
    {/if}

    {#if incomingConfig}
      <TemplateLivePreview
        {incomingConfig}
        {missingMode}
        collapsed={previewCollapsed}
        onToggleCollapse={() => previewCollapsed = !previewCollapsed}
      />
    {/if}

    <div class="diff-scroll">
      <!-- Palette diff -->
      {#if getPaletteDiff().length > 0}
        <div class="diff-section">
          <span class="diff-section-label">{t('palette')}</span>
          <div class="diff-palette">
            {#each getPaletteDiff() as pd}
              <div class="palette-diff-row">
                <span class="pd-key">{pd.key}</span>
                <span class="pd-swatch" style="background: {pd.current}"></span>
                <span class="pd-arrow">→</span>
                <span class="pd-swatch" style="background: {pd.incoming}"></span>
                <span class="pd-hex">{pd.incoming}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Effects diff -->
      {#if effectDiffs.length > 0}
        <div class="diff-section">
          <span class="diff-section-label">{t('effects_list')}</span>
          <div class="diff-effect-list">
            {#each effectDiffs as ed, index}
              <div class="diff-effect-card" class:added={ed.status === 'added'} class:removed={ed.status === 'removed'} class:modified={ed.status === 'modified'} class:unchanged={ed.status === 'unchanged'}>
                <div class="diff-effect-header">
                  <span class="diff-effect-badge">{t(ed.status === 'added' ? 'diff_effect_added' : ed.status === 'removed' ? 'diff_effect_removed' : ed.status === 'modified' ? 'diff_effect_modified' : 'diff_effect_unchanged')}</span>
                  <span class="diff-effect-name">{ed.label}</span>
                </div>
                {#if ed.visibilityChanged}
                  <div class="diff-visibility-row">
                    <svg class="diff-vis-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">{#if ed.currentVisible}<path d="M10 4C4.5 4 1 10 1 10s3.5 6 9 6 9-6 9-6-3.5-6-9-6zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>{:else}<path d="M2.5 2.5l15 15M10 4c-1.4 0-2.7.4-3.8 1L8 6.8A4 4 0 0 1 13.2 12l2 2c1.6-1.2 3-2.8 3.8-4-1.5-2.7-4.8-6-9-6zM1 10s1.4-2.7 3.8-4.2l1.8 1.8A4 4 0 0 0 12.4 13.4l1.8 1.8C12.7 16.6 11.4 16 10 16c-5.5 0-9-6-9-6z"/>{/if}</svg>
                    <span>{ed.currentVisible ? t('diff_visibility_visible') : t('diff_visibility_hidden')}</span>
                    <span class="diff-vis-arrow">→</span>
                    <svg class="diff-vis-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">{#if ed.incomingVisible}<path d="M10 4C4.5 4 1 10 1 10s3.5 6 9 6 9-6 9-6-3.5-6-9-6zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>{:else}<path d="M2.5 2.5l15 15M10 4c-1.4 0-2.7.4-3.8 1L8 6.8A4 4 0 0 1 13.2 12l2 2c1.6-1.2 3-2.8 3.8-4-1.5-2.7-4.8-6-9-6zM1 10s1.4-2.7 3.8-4.2l1.8 1.8A4 4 0 0 0 12.4 13.4l1.8 1.8C12.7 16.6 11.4 16 10 16c-5.5 0-9-6-9-6z"/>{/if}</svg>
                    <span>{ed.incomingVisible ? t('diff_visibility_visible') : t('diff_visibility_hidden')}</span>
                  </div>
                {/if}
                {#if !ed.visibilityChanged && ed.status === 'added' && ed.incomingVisible === false}
                  <div class="diff-visibility-row diff-vis-hidden-note">
                    <svg class="diff-vis-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M2.5 2.5l15 15M10 4c-1.4 0-2.7.4-3.8 1L8 6.8A4 4 0 0 1 13.2 12l2 2c1.6-1.2 3-2.8 3.8-4-1.5-2.7-4.8-6-9-6zM1 10s1.4-2.7 3.8-4.2l1.8 1.8A4 4 0 0 0 12.4 13.4l1.8 1.8C12.7 16.6 11.4 16 10 16c-5.5 0-9-6-9-6z"/></svg>
                    <span>{t('diff_visibility_hidden')}</span>
                  </div>
                {/if}
                {#if ed.status === 'modified' && ed.configItems.length > 0}
                  <table class="diff-table effect-diff-table">
                    <colgroup>
                      <col class="param-col-label" />
                      <col class="param-col-value" />
                      <col class="param-col-value" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>{t('diff_effect_config')}</th>
                        <th>{t('diff_current')}</th>
                        <th>{t('diff_after')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each ed.configItems as item}
                        <tr>
                          <td class="param-name">{item.label}</td>
                          <td class="param-val">{item.current}</td>
                          <td class="param-val">{item.incoming}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {/if}
                {#if ed.status === 'modified' && ed.complexConfigItems.length > 0}
                  <button class="complex-toggle-btn" type="button" onclick={() => toggleComplexExpanded(index, ed.type)}>
                    {getComplexToggleLabel(ed.complexConfigItems.length, isComplexExpanded(index, ed.type))}
                  </button>
                  <ExpandPanel visible={isComplexExpanded(index, ed.type)} padding="8px" gap="8px" marginTop="8px">
                    <div class="complex-section-title">{t('diff_effect_complex')}</div>
                    {#each ed.complexConfigItems as item}
                      <div class="complex-item-card">
                        <div class="complex-item-header">
                          <span class="complex-item-name">{item.label}</span>
                          <span class="complex-item-kind">{getComplexKindLabel(item.kind)}</span>
                        </div>
                        <div class="complex-summary-grid">
                          <div class="complex-summary-col">
                            <span class="complex-summary-label">{t('diff_current')}</span>
                            <span class="complex-summary-value">{item.currentSummary}</span>
                          </div>
                          <div class="complex-summary-col">
                            <span class="complex-summary-label">{t('diff_after')}</span>
                            <span class="complex-summary-value">{item.incomingSummary}</span>
                          </div>
                        </div>
                        <div class="complex-raw-grid">
                          <div class="complex-raw-col">
                            <div class="complex-raw-label">{t('diff_current')}</div>
                            <pre class="complex-raw-pre">{item.currentRaw}</pre>
                          </div>
                          <div class="complex-raw-col">
                            <div class="complex-raw-label">{t('diff_after')}</div>
                            <pre class="complex-raw-pre">{item.incomingRaw}</pre>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </ExpandPanel>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Params diff -->
      {#if paramDiffGroups.length > 0}
        <div class="diff-section">
          <span class="diff-section-label">{t('diff_params')}</span>
          <div class="diff-param-groups">
            {#each paramDiffGroups as group}
              <div class="diff-param-group">
                <div class="diff-param-group-title">
                  {group.label}
                  {#if group.id === 'font' && engine.fontLocked}
                    <span class="lock-badge" title={t('font_lock')}>🔒</span>
                  {/if}
                  {#if group.id === 'postfx' && engine.postFxLocked}
                    <span class="lock-badge" title={t('postfx_lock')}>🔒</span>
                  {/if}
                </div>
                <table class="diff-table">
                  <colgroup>
                    <col class="param-col-label" />
                    <col class="param-col-value" />
                    <col class="param-col-value" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th></th>
                      <th>{t('diff_current')}</th>
                      <th>{t('diff_after')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each group.items as p}
                      <tr class:missing={p.missing}>
                        <td class="param-name">{p.label}</td>
                        <td class="param-val">{p.current}</td>
                        <td class="param-val">{p.missing ? t('diff_not_included') : p.incoming}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="diff-footer">
      {#if hasMissingParams()}
        <div class="missing-hint">
          <span>{t('diff_missing_hint')}</span>
          <div class="missing-options">
            {#if incomingConfig.baseTemplateName}
              <label class="pv-check-row">
                <input type="radio" name="missing" checked={missingMode === 'builtin'} onchange={() => onMissingModeChange('builtin')} />
                <span class="pv-check-text">{t('diff_use_builtin')}</span>
              </label>
            {/if}
            <label class="pv-check-row">
              <input type="radio" name="missing" checked={missingMode === 'keep'} onchange={() => onMissingModeChange('keep')} />
              <span class="pv-check-text">{t('diff_keep_current')}</span>
            </label>
            <label class="pv-check-row">
              <input type="radio" name="missing" checked={missingMode === 'reset'} onchange={() => onMissingModeChange('reset')} />
              <span class="pv-check-text">{t('diff_reset_default')}</span>
            </label>
          </div>
        </div>
      {/if}

      <div class="diff-actions">
        <button class="pv-btn pv-btn-accent btn accent" onclick={handleConfirm} disabled={requireName && !importName.trim()}>{confirmLabel ?? t('diff_confirm_load')}</button>
        {#if secondaryActionLabel}
          <button class="pv-btn btn" onclick={onSecondaryAction}>{secondaryActionLabel}</button>
        {/if}
        <button class="pv-btn btn" onclick={() => onClose()}>{t('cancel')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .diff-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
  }

  .diff-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 201;
    width: 380px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--pv-bg-surface);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-lg);
    box-shadow: var(--pv-shadow-lg);
    padding: 16px 16px 0;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  .diff-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--pv-text);
    line-height: 1.2;
    margin-bottom: 12px;
  }

  .diff-scroll {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-bottom: 4px;
  }

  .diff-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .diff-title-row .diff-title {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    height: 2.2rem;
    margin-bottom: 0;
  }

  .import-name-input {
    flex: 1 1 auto;
    min-width: 0;
    height: 2.2rem;
    min-height: 2.2rem;
    padding: 0 12px;
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.2;
    border-radius: 10px;
  }

  .import-name-input.highlight {
    border-color: rgba(255, 92, 92, 0.95);
    box-shadow: 0 0 0 1px rgba(255, 92, 92, 0.35);
    background: rgba(255, 92, 92, 0.08);
  }

  .diff-warning {
    margin: -4px 0 10px;
    font-size: 0.68rem;
    color: #ff8b8b;
    line-height: 1.35;
  }

  @media (max-width: 640px) {
    .diff-title-row {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
  }

  .diff-footer {
    flex-shrink: 0;
    border-top: 1px solid var(--pv-border);
    padding: 10px 0 16px;
  }

  .diff-section {
    margin-bottom: 10px;
  }

  .diff-section-label {
    display: block;
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--pv-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .diff-effect-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .diff-effect-card {
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
    background: rgba(255, 255, 255, 0.02);
    padding: 8px;
  }

  .diff-effect-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .diff-visibility-row {
    margin-top: 6px;
    font-size: 0.68rem;
    color: #f0bf64;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .diff-vis-icon {
    flex-shrink: 0;
  }

  .diff-vis-arrow {
    margin: 0 2px;
    opacity: 0.6;
  }

  .diff-vis-hidden-note {
    color: var(--pv-text-muted, #888);
  }

  .diff-effect-badge {
    font-size: 0.62rem;
    line-height: 1;
    padding: 3px 6px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .diff-effect-name {
    font-size: 0.72rem;
    color: var(--pv-text);
    font-weight: 600;
  }

  .diff-effect-card.added .diff-effect-badge { background: rgba(50, 200, 80, 0.2); color: #4caf50; }
  .diff-effect-card.removed .diff-effect-badge { background: rgba(255, 50, 50, 0.2); color: #f44336; }
  .diff-effect-card.modified .diff-effect-badge { background: rgba(255, 184, 77, 0.2); color: #ffb84d; }
  .diff-effect-card.unchanged .diff-effect-badge { background: rgba(255, 255, 255, 0.08); color: var(--pv-text-muted); }
  .diff-effect-card.removed .diff-effect-name { text-decoration: line-through; }

  .effect-diff-table {
    margin-top: 8px;
  }

  .complex-toggle-btn {
    margin-top: 8px;
    border: 0;
    background: transparent;
    color: var(--pv-accent, #86a8ff);
    font-size: 0.68rem;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  .complex-toggle-btn:hover {
    text-decoration: underline;
  }

  .complex-section-title {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--pv-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .complex-item-card {
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
    background: rgba(255, 255, 255, 0.02);
    padding: 8px;
  }

  .complex-item-header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .complex-item-name {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--pv-text);
  }

  .complex-item-kind {
    font-size: 0.62rem;
    color: var(--pv-text-muted);
    text-transform: uppercase;
  }

  .complex-summary-grid,
  .complex-raw-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .complex-summary-grid {
    margin-bottom: 8px;
  }

  .complex-summary-col,
  .complex-raw-col {
    min-width: 0;
  }

  .complex-summary-label,
  .complex-raw-label {
    display: block;
    font-size: 0.62rem;
    color: var(--pv-text-muted);
    margin-bottom: 4px;
  }

  .complex-summary-value {
    display: block;
    font-size: 0.68rem;
    color: var(--pv-text-secondary);
    line-height: 1.35;
  }

  .complex-raw-pre {
    margin: 0;
    padding: 8px;
    max-height: 160px;
    overflow: auto;
    border-radius: var(--pv-radius-sm);
    background: rgba(0, 0, 0, 0.18);
    color: var(--pv-text-secondary);
    font-size: 0.62rem;
    line-height: 1.35;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .diff-palette {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .palette-diff-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
  }

  .pd-key {
    width: 68px;
    color: var(--pv-text-muted);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }

  .pd-swatch {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }

  .pd-arrow {
    color: var(--pv-text-muted);
    font-size: 0.75rem;
  }

  .pd-hex {
    color: var(--pv-text-secondary);
    font-size: 0.65rem;
    font-family: monospace;
  }

  .diff-param-groups {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .diff-param-group {
    padding: 8px;
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
    background: rgba(255, 255, 255, 0.02);
  }

  .diff-param-group-title {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--pv-text);
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .lock-badge {
    font-size: 0.65rem;
    opacity: 0.8;
  }

  .diff-table {
    width: 100%;
    font-size: 0.7rem;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .diff-table col.param-col-label { width: 44%; }
  .diff-table col.param-col-value { width: 28%; }
  .diff-table th {
    font-weight: 600;
    color: var(--pv-text-muted);
    text-align: left;
    padding: 3px 6px;
    border-bottom: 1px solid var(--pv-border);
  }
  .diff-table th:not(:first-child) {
    text-align: center;
  }
  .diff-table td {
    padding: 3px 6px;
    color: var(--pv-text-secondary);
  }
  .diff-table td.param-val {
    text-align: center;
  }
  .diff-table tr.missing td { color: var(--pv-text-muted); font-style: italic; }

  .param-name {
    font-weight: 500;
    color: var(--pv-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .missing-hint {
    padding: 8px;
    background: var(--pv-bg-elevated);
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    margin-bottom: 8px;
    font-size: 0.7rem;
    color: var(--pv-text-secondary);
  }

  .missing-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .diff-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  @media (max-width: 768px) {
    .diff-dialog { width: 90vw; }

    .complex-summary-grid,
    .complex-raw-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
