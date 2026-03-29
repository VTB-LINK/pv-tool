<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label = '',
    open = $bindable(true),
    children,
    action,
  }: {
    label?: string;
    open?: boolean;
    children?: Snippet;
    action?: Snippet;
  } = $props();
</script>

<details class="panel-section" bind:open>
  <summary class="section-title">
    <span class="arrow">{open ? '▾' : '▸'}</span>
    <span class="section-label">{label}</span>
    {#if action}
      <span class="section-action" onclick={(e: MouseEvent) => e.stopPropagation()}>
        {@render action()}
      </span>
    {/if}
  </summary>
  <div class="section-body">
    {@render children?.()}
  </div>
</details>

<style>
  .panel-section {
    display: flex;
    flex-direction: column;
  }

  .section-title {
    cursor: pointer;
    user-select: none;
    list-style: none;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--pv-text-secondary);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    padding: 8px 0 6px;
    border-bottom: 1px solid var(--pv-border);
    display: flex;
    align-items: center;
    gap: 6px;
    transition: color var(--pv-duration);
  }

  .section-title::-webkit-details-marker {
    display: none;
  }

  .section-title:hover {
    color: var(--pv-text);
  }

  .arrow {
    font-size: 0.6em;
    color: var(--pv-text-muted);
    transition: color var(--pv-duration);
  }

  .section-label {
    flex: 1;
  }

  .section-action {
    margin-left: auto;
    flex-shrink: 0;
  }

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 0;
  }
</style>
