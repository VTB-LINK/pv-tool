<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import type { MissingMode } from '../../stores/engine.svelte';
  import { getTemplateEffectDiffs, getTemplateParamDiffGroups } from '../../services/templateDiff';
  import type { TemplateConfig } from '../../types/engine';
  import { effectCatalog } from '../../engine/effectCatalog';
  import { t } from '../../i18n';

  const effectLabelMap = new Map<string, string>();
  for (const preset of effectCatalog) {
    if (!effectLabelMap.has(preset.type)) effectLabelMap.set(preset.type, preset.label);
  }

  let {
    visible = false,
    currentConfig = null as TemplateConfig | null,
    incomingConfig = null as TemplateConfig | null,
    title = null as string | null,
    confirmLabel = null as string | null,
    showUnchangedEffects = true,
    missingMode = 'reset' as MissingMode,
    onMissingModeChange = (_mode: MissingMode) => {},
    onClose = () => {},
    onConfirm = (_opts: { missingMode: MissingMode }) => {},
  }: {
    visible?: boolean;
    currentConfig?: TemplateConfig | null;
    incomingConfig?: TemplateConfig | null;
    title?: string | null;
    confirmLabel?: string | null;
    showUnchangedEffects?: boolean;
    missingMode?: MissingMode;
    onMissingModeChange?: (mode: MissingMode) => void;
    onClose?: () => void;
    onConfirm?: (opts: { missingMode: MissingMode }) => void;
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
      label: effectLabelMap.get(item.type) ?? item.type,
    }))
  );

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

  function handleConfirm() {
    onConfirm({ missingMode });
    onClose();
  }

  function handleOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  }
</script>

{#if visible && currentConfig && incomingConfig}
  <div
    class="diff-overlay"
    role="button"
    tabindex="0"
    aria-label={t('cancel')}
    onclick={() => onClose()}
    onkeydown={handleOverlayKeydown}
  ></div>
  <div class="diff-dialog">
    <h3 class="diff-title">{title ?? (t('diff_title') + ': ' + (incomingConfig.nameKey ? t(incomingConfig.nameKey as any) : incomingConfig.name))}</h3>

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
            {#each effectDiffs as ed}
              <div class="diff-effect-card" class:added={ed.status === 'added'} class:removed={ed.status === 'removed'} class:modified={ed.status === 'modified'} class:unchanged={ed.status === 'unchanged'}>
                <div class="diff-effect-header">
                  <span class="diff-effect-badge">{t(ed.status === 'added' ? 'diff_effect_added' : ed.status === 'removed' ? 'diff_effect_removed' : ed.status === 'modified' ? 'diff_effect_modified' : 'diff_effect_unchanged')}</span>
                  <span class="diff-effect-name">{ed.label}</span>
                </div>
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
                <div class="diff-param-group-title">{group.label}</div>
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
        <button class="pv-btn pv-btn-accent btn accent" onclick={handleConfirm}>{confirmLabel ?? t('diff_confirm_load')}</button>
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
    max-height: 80vh;
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
    margin-bottom: 12px;
  }

  .diff-scroll {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-bottom: 4px;
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
  }
</style>
