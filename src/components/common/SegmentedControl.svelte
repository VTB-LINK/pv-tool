<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import type { SegmentedControlOption } from './options';

  let {
    items = [] as SegmentedControlOption[],
    selectedValue = '',
    size = 'compact' as 'compact' | 'regular',
    onSelect = (_value: string) => {},
  } = $props();
</script>

<div class="segmented-control" class:regular={size === 'regular'}>
  {#each items as item}
    <button
      class="segment-btn"
      class:active={selectedValue === item.value}
      type="button"
      onclick={() => onSelect(item.value)}
      title={item.label}
    >{item.label}</button>
  {/each}
</div>

<style>
  .segmented-control {
    display: flex;
    gap: 6px;
    width: 100%;
  }

  .segment-btn {
    flex: 1;
    min-width: 0;
    padding: 2px 8px;
    font-size: 0.66rem;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .segment-btn:hover {
    color: var(--pv-text);
    border-color: var(--pv-border-hover);
  }

  .segment-btn.active {
    background: var(--pv-accent);
    color: #fff;
    border-color: var(--pv-accent);
  }

  .segmented-control.regular .segment-btn {
    padding: 6px 10px;
    font-size: 0.76rem;
  }
</style>