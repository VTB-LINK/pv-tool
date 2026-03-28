<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import type { TemplateConfig } from '../../types/engine';
  import { effectCatalog } from '../../engine/effectCatalog';
  import { t } from '../../i18n';

  const effectLabelMap = new Map<string, string>();
  for (const preset of effectCatalog) {
    if (!effectLabelMap.has(preset.type)) effectLabelMap.set(preset.type, preset.label);
  }

  let {
    visible = $bindable(false),
    currentConfig = null as TemplateConfig | null,
    incomingConfig = null as TemplateConfig | null,
    title = null as string | null,
    confirmLabel = null as string | null,
    showUnchangedEffects = true,
    onConfirm = (_opts: { resetMissing: boolean }) => {},
  } = $props();

  let resetMissing = $state(true);
  let paramsDiff = $derived(getParamsDiff());

  interface PaletteDiff {
    key: string;
    current: string;
    incoming: string;
  }

  interface EffectDiff {
    type: string;
    label: string;
    status: 'added' | 'removed' | 'unchanged';
  }

  interface ParamDiff {
    name: string;
    current: string;
    incoming: string;
    missing: boolean;
  }

  function getEffectsDiff(): EffectDiff[] {
    if (!currentConfig || !incomingConfig) return [];
    const currentTypes = new Set(currentConfig.effects.map(e => e.type));
    const incomingTypes = new Set(incomingConfig.effects.map(e => e.type));

    const result: EffectDiff[] = [];

    for (const e of incomingConfig.effects) {
      result.push({
        type: e.type,
        label: effectLabelMap.get(e.type) ?? e.type,
        status: currentTypes.has(e.type) ? 'unchanged' : 'added',
      });
    }

    for (const e of currentConfig.effects) {
      if (!incomingTypes.has(e.type)) {
        result.push({
          type: e.type,
          label: effectLabelMap.get(e.type) ?? e.type,
          status: 'removed',
        });
      }
    }

    return showUnchangedEffects ? result : result.filter(e => e.status !== 'unchanged');
  }

  function getPaletteDiff(): PaletteDiff[] {
    if (!currentConfig?.palette || !incomingConfig?.palette) return [];
    const keys = ['background', 'primary', 'secondary', 'accent', 'text'] as const;
    return keys
      .filter(k => currentConfig!.palette[k] !== incomingConfig!.palette[k])
      .map(k => ({ key: k, current: currentConfig!.palette[k], incoming: incomingConfig!.palette[k] }));
  }

  function getParamsDiff(): ParamDiff[] {
    if (!currentConfig || !incomingConfig) return [];
    const params: ParamDiff[] = [];
    const fmt = (v: any, def: any) => v !== undefined ? String(v) : String(def);

    params.push({
      name: 'BPM',
      current: fmt(currentConfig.bpm, 120),
      incoming: fmt(incomingConfig.bpm, '—'),
      missing: incomingConfig.bpm === undefined,
    });
    params.push({
      name: 'Animation Speed',
      current: fmt(currentConfig.animationSpeed, 2.0),
      incoming: fmt(incomingConfig.animationSpeed, '—'),
      missing: incomingConfig.animationSpeed === undefined,
    });
    params.push({
      name: 'BG Opacity',
      current: fmt(currentConfig.bgOpacity, 1.0),
      incoming: fmt(incomingConfig.bgOpacity, '—'),
      missing: incomingConfig.bgOpacity === undefined,
    });

    const pfxKeys = ['shake', 'zoom', 'tilt', 'glitch', 'hueShift'] as const;
    for (const k of pfxKeys) {
      params.push({
        name: `PostFX: ${k}`,
        current: fmt(currentConfig.postfx?.[k], 0),
        incoming: fmt(incomingConfig.postfx?.[k], '—'),
        missing: incomingConfig.postfx?.[k] === undefined,
      });
    }

    return params.filter(p => p.current !== p.incoming || p.missing);
  }

  function handleConfirm() {
    onConfirm({ resetMissing });
    visible = false;
  }
</script>

{#if visible && currentConfig && incomingConfig}
  <div class="diff-overlay" onclick={() => visible = false}></div>
  <div class="diff-dialog">
    <h3 class="diff-title">{title ?? (t('diff_title') + ': ' + incomingConfig.name)}</h3>

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
    {#if getEffectsDiff().length > 0}
      <div class="diff-section">
        <span class="diff-section-label">{t('effects_list')}</span>
        <div class="diff-effects">
          {#each getEffectsDiff() as ed}
            <span class="diff-effect" class:added={ed.status === 'added'} class:removed={ed.status === 'removed'} class:unchanged={ed.status === 'unchanged'}>
              {ed.status === 'added' ? '+' : ed.status === 'removed' ? '−' : '·'} {ed.label}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Params diff -->
    {#if paramsDiff.length > 0}
      <div class="diff-section">
        <span class="diff-section-label">{t('diff_params')}</span>
        <table class="diff-table">
          <thead>
            <tr>
              <th></th>
              <th>{t('diff_current')}</th>
              <th>{t('diff_after')}</th>
            </tr>
          </thead>
          <tbody>
            {#each paramsDiff as p}
              <tr class:missing={p.missing}>
                <td class="param-name">{p.name}</td>
                <td class="param-val">{p.current}</td>
                <td class="param-val">{p.missing ? t('diff_not_included') : p.incoming}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if paramsDiff.some(p => p.missing)}
        <div class="missing-hint">
          <span>{t('diff_missing_hint')}</span>
          <div class="missing-options">
            <label class="option-check">
              <input type="radio" name="missing" checked={resetMissing} onchange={() => resetMissing = true} />
              <span>{t('diff_reset_default')}</span>
            </label>
            <label class="option-check">
              <input type="radio" name="missing" checked={!resetMissing} onchange={() => resetMissing = false} />
              <span>{t('diff_keep_current')}</span>
            </label>
          </div>
        </div>
      {/if}
    {/if}

    <div class="diff-actions">
      <button class="btn accent" onclick={handleConfirm}>{confirmLabel ?? t('diff_confirm_load')}</button>
      <button class="btn" onclick={() => visible = false}>{t('cancel')}</button>
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
    overflow-y: auto;
    background: var(--pv-bg-surface);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-lg);
    box-shadow: var(--pv-shadow-lg);
    padding: 16px;
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

  .diff-effects {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .diff-effect {
    font-size: 0.68rem;
    padding: 2px 6px;
    border-radius: 3px;
    white-space: nowrap;
  }
  .diff-effect.added { background: rgba(50, 200, 80, 0.2); color: #4caf50; }
  .diff-effect.removed { background: rgba(255, 50, 50, 0.2); color: #f44336; text-decoration: line-through; }
  .diff-effect.unchanged { color: var(--pv-text-muted); }

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

  .diff-table {
    width: 100%;
    font-size: 0.7rem;
    border-collapse: collapse;
  }
  .diff-table th {
    font-weight: 600;
    color: var(--pv-text-muted);
    text-align: left;
    padding: 3px 6px;
    border-bottom: 1px solid var(--pv-border);
  }
  .diff-table td {
    padding: 3px 6px;
    color: var(--pv-text-secondary);
  }
  .diff-table tr.missing td { color: var(--pv-text-muted); font-style: italic; }

  .param-name { font-weight: 500; color: var(--pv-text); }

  .missing-hint {
    padding: 8px;
    background: var(--pv-bg-elevated);
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    margin: 8px 0;
    font-size: 0.7rem;
    color: var(--pv-text-secondary);
  }

  .missing-options {
    display: flex;
    gap: 12px;
    margin-top: 6px;
  }

  .option-check {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: var(--pv-text-secondary);
    cursor: pointer;
  }
  .option-check input { accent-color: var(--pv-accent); }

  .diff-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .btn {
    padding: 6px 14px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .btn:hover { background: var(--pv-bg-hover); }
  .btn.accent { background: var(--pv-accent); color: #fff; border-color: var(--pv-accent); }
  .btn.accent:hover { background: var(--pv-accent-hover); }

  @media (max-width: 768px) {
    .diff-dialog { width: 90vw; }
  }
</style>
