<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import { t } from '../../i18n';

  let {
    visible = false,
    message = null as string | null,
    saveLabel = null as string | null,
    confirmLabel = null as string | null,
    cancelLabel = null as string | null,
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
  <div class="confirm-dialog" role="dialog" aria-modal="true" aria-label={message ?? t('unsaved_changes_hint')}>
    <p class="confirm-text">{message ?? t('unsaved_changes_hint')}</p>
    <div class="confirm-actions">
      <button class="pv-btn btn" onclick={handleConfirm}>{confirmLabel ?? t('discard_and_switch')}</button>
      <button class="pv-btn pv-btn-accent btn accent" onclick={handleSave}>{saveLabel ?? t('save_before_switch')}</button>
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

  @keyframes unsavedDialogFadeIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  .confirm-text {
    font-size: 0.8rem;
    color: var(--pv-text);
    margin: 0 0 16px;
    line-height: 1.5;
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

</style>