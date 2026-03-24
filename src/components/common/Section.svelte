<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  let {
    label = '',
    open = $bindable(true),
    children,
  } = $props();
</script>

<details class="panel-section" bind:open>
  <summary class="section-title">
    <span class="arrow">{open ? '▾' : '▸'}</span>
    {label}
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

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 0;
  }
</style>
