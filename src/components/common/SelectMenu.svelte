<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import type { SelectMenuOption } from './options';

  let rootEl: HTMLDivElement | null = null;

  let {
    items = [] as SelectMenuOption[],
    selectedLabel = '',
    selectedValue = null as string | null,
    open = $bindable(false),
    size = 'compact' as 'compact' | 'regular',
    ariaLabel = null as string | null,
    onSelect = (_value: string) => {},
  } = $props();

  function isActive(item: SelectMenuOption): boolean {
    return item.active ?? item.value === selectedValue;
  }

  function handleToggle() {
    open = !open;
  }

  function handleSelect(value: string) {
    onSelect(value);
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (!open || !rootEl) return;
    const target = event.target;
    if (target instanceof Node && !rootEl.contains(target)) {
      open = false;
    }
  }

  function handleWindowKeyDown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') {
      open = false;
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeyDown} />

<div class="select-menu" class:regular={size === 'regular'} bind:this={rootEl}>
  <button
    class="select-trigger"
    type="button"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel ?? selectedLabel}
    onclick={handleToggle}
  >
    <span class="select-label">{selectedLabel}</span>
    <span class="select-arrow" class:open={open}>▾</span>
  </button>

  {#if open}
    <div class="select-dropdown" role="listbox" aria-label={ariaLabel ?? selectedLabel}>
      {#each items as item}
        <button
          class="select-option"
          class:active={isActive(item)}
          type="button"
          role="option"
          aria-selected={isActive(item)}
          onclick={() => handleSelect(item.value)}
        >{item.label}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .select-menu {
    position: relative;
    width: 100%;
  }

  .select-trigger {
    width: 100%;
    padding: 6px 10px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.78rem;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    transition: border-color var(--pv-duration), background var(--pv-duration);
  }

  .select-trigger:hover {
    border-color: var(--pv-border-hover);
    background: var(--pv-bg-hover);
  }

  .select-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .select-arrow {
    font-size: 0.7rem;
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .select-arrow.open {
    transform: rotate(180deg);
  }

  .select-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 240px;
    overflow-y: auto;
    background: var(--pv-bg-surface);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
    z-index: 100;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(12px);
  }

  .select-option {
    padding: 7px 10px;
    border: none;
    background: transparent;
    color: var(--pv-text-muted);
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .select-option:last-child {
    border-bottom: none;
  }

  .select-option:hover {
    background: var(--pv-bg-hover);
    color: var(--pv-text);
  }

  .select-option.active {
    color: var(--pv-accent);
    font-weight: 600;
  }

  .select-menu.regular .select-trigger {
    padding: 10px 12px;
    border-radius: var(--pv-radius);
    font-size: 0.85rem;
  }

  .select-menu.regular .select-dropdown {
    border-radius: var(--pv-radius);
  }

  .select-menu.regular .select-option {
    padding: 10px 12px;
    font-size: 0.82rem;
  }
</style>