<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import { engine } from '../../stores/engine.svelte';

  let { message = $bindable(''), visible = $bindable(false) } = $props();
</script>

{#if engine.toastVisible}
  <div class="toast" class:show={engine.toastVisible}>
    {engine.toastMessage}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-10px);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    padding: 10px 28px;
    border-radius: var(--pv-radius);
    font-size: 0.85rem;
    z-index: 9999;
    pointer-events: none;
    border: 1px solid var(--pv-border);
    backdrop-filter: blur(16px);
    box-shadow: var(--pv-shadow);
    opacity: 0;
    animation: toastIn 0.3s var(--pv-ease) forwards,
               toastOut 0.3s var(--pv-ease) 1.7s forwards;
  }

  @keyframes toastIn {
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes toastOut {
    to {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
  }
</style>
