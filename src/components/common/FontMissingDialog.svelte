<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import { t } from '../../i18n';
  import { onMount, onDestroy } from 'svelte';

  let {
    visible = false,
    fontName = '' as string,
    source: _source = 'template' as 'sharecode' | 'url' | 'template',
    onKeep = () => {},
    onReplace = () => {},
    onReset = () => {},
  }: {
    visible?: boolean;
    fontName?: string;
    source?: 'sharecode' | 'url' | 'template';
    onKeep?: () => void;
    onReplace?: () => void;
    onReset?: () => void;
  } = $props();

  function handleKeyDown(event: KeyboardEvent) {
    if (!visible) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onKeep();
    }
  }

  onMount(() => window.addEventListener('keydown', handleKeyDown));
  onDestroy(() => window.removeEventListener('keydown', handleKeyDown));
</script>

{#if visible}
  <div
    class="confirm-overlay"
    role="button"
    tabindex="0"
    aria-label={t('font_action_keep')}
    onclick={onKeep}
    onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onKeep()}
  ></div>
  <div class="confirm-dialog" role="dialog" aria-modal="true" aria-label={t('font_missing_title')}>
    <p class="confirm-title">{t('font_missing_title')}</p>
    <p class="confirm-text">
      <strong>{fontName}</strong><br />
      {t('font_missing_message')}
    </p>
    <div class="confirm-actions">
      <button class="pv-btn btn" onclick={onKeep}>{t('font_action_keep')}</button>
      <button class="pv-btn btn" onclick={onReplace}>{t('font_action_replace')}</button>
      <button class="pv-btn pv-btn-accent btn accent" onclick={onReset}>{t('font_action_reset')}</button>
    </div>
  </div>
{/if}

<style>
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
  }

  .confirm-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 201;
    width: fit-content;
    min-width: min(320px, calc(100vw - 40px));
    max-width: min(480px, calc(100vw - 40px));
    background: var(--pv-bg-surface);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-lg);
    box-shadow: var(--pv-shadow-lg);
    padding: 20px;
    animation: fontDialogFadeIn 0.15s ease;
  }

  @keyframes fontDialogFadeIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  .confirm-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--pv-text);
    margin: 0 0 8px;
  }

  .confirm-text {
    font-size: 0.78rem;
    color: var(--pv-text-secondary);
    margin: 0 0 16px;
    line-height: 1.5;
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
