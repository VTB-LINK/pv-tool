<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import { t } from '../../i18n';

  type DialogPosition = 'center' | 'right';
  type ActionLayout = 'default' | 'primary-first';

  let {
    visible = false,
    message = null as string | null,
    messageName = null as string | null,
    saveLabel = null as string | null,
    confirmLabel = null as string | null,
    cancelLabel = null as string | null,
    position = 'center' as DialogPosition,
    actionLayout = 'default' as ActionLayout,
    onSave = () => {},
    onConfirm = () => {},
    onCancel = () => {},
  } = $props();

  function handleSave() {
    onSave();
  }

  function handleConfirm() {
    onConfirm();
  }

  function handleCancel() {
    onCancel();
  }
</script>

{#if visible}
  <div
    class="confirm-overlay"
    role="button"
    tabindex="0"
    aria-label={cancelLabel ?? t('cancel')}
    onclick={handleCancel}
    onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && handleCancel()}
  ></div>
  <div class="confirm-dialog" class:right={position === 'right'} role="dialog" aria-modal="true" aria-label={message ?? t('unsaved_changes_hint')}>
    <p class="confirm-text">
      <span class="confirm-text-prefix">{message ?? t('unsaved_changes_hint')}</span>
      {#if messageName}
        <span class="confirm-text-name">&quot;{messageName}&quot;</span>
      {/if}
    </p>
    <div class="confirm-actions">
      {#if actionLayout === 'primary-first'}
        <button class="pv-btn pv-btn-accent btn accent" onclick={handleSave}>{saveLabel ?? t('save_before_switch')}</button>
        <button class="pv-btn btn" onclick={handleConfirm}>{confirmLabel ?? t('discard_and_switch')}</button>
      {:else}
        <button class="pv-btn btn" onclick={handleConfirm}>{confirmLabel ?? t('discard_and_switch')}</button>
        <button class="pv-btn pv-btn-accent btn accent" onclick={handleSave}>{saveLabel ?? t('save_before_switch')}</button>
      {/if}
      <button class="pv-btn btn" onclick={handleCancel}>{cancelLabel ?? t('cancel')}</button>

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
    max-width: min(560px, calc(100vw - 40px));
    background: var(--pv-bg-surface);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-lg);
    box-shadow: var(--pv-shadow-lg);
    padding: 20px;
    animation: unsavedDialogFadeIn 0.15s ease;
  }

  .confirm-dialog.right {
    left: auto;
    right: 0;
    width: min(340px, 100vw);
    min-width: min(340px, 100vw);
    max-width: min(340px, 100vw);
    transform: translateY(-50%);
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  @keyframes unsavedDialogFadeIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  .confirm-dialog.right {
    animation: unsavedDialogFadeInRight 0.15s ease;
  }

  @keyframes unsavedDialogFadeInRight {
    from { opacity: 0; transform: translateY(-50%) scale(0.96); }
    to { opacity: 1; transform: translateY(-50%) scale(1); }
  }

  .confirm-text {
    font-size: 0.8rem;
    color: var(--pv-text);
    margin: 0 0 16px;
    line-height: 1.5;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35ch;
    align-items: baseline;
    min-width: 0;
  }

  .confirm-text-prefix {
    flex: 0 1 auto;
  }

  .confirm-text-name {
    flex: 1 1 220px;
    min-width: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  @media (max-width: 900px) {
    .confirm-dialog.right {
      left: 50%;
      right: auto;
      transform: translate(-50%, -50%);
      animation: unsavedDialogFadeIn 0.15s ease;
    }
  }

</style>