<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    visible = false,
    children,
    padding = '8px',
    gap = '6px',
    marginTop = '4px',
  }: {
    visible?: boolean;
    children?: Snippet;
    padding?: string;
    gap?: string;
    marginTop?: string;
  } = $props();
</script>

{#if visible}
  <div
    class="expand-panel"
    style={`--expand-panel-padding:${padding}; --expand-panel-gap:${gap}; --expand-panel-margin-top:${marginTop};`}
  >
    {@render children?.()}
  </div>
{/if}

<style>
  .expand-panel {
    display: flex;
    flex-direction: column;
    gap: var(--expand-panel-gap);
    padding: var(--expand-panel-padding);
    margin-top: var(--expand-panel-margin-top);
    background: var(--pv-bg-elevated);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
    animation: expandPanelFadeIn 0.12s ease;
  }

  @keyframes expandPanelFadeIn {
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>