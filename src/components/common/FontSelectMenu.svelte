<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import type { FontInfo } from '../../services/fontService';
  import { t } from '../../i18n';

  let rootEl: HTMLDivElement | null = null;
  let searchInput = $state<HTMLInputElement | null>(null);

  let {
    fonts = [] as FontInfo[],
    selectedValue = null as string | null,
    selectedLabel = '',
    open = $bindable(false),
    ariaLabel = null as string | null,
    onSelect = (_value: string) => {},
  }: {
    fonts?: FontInfo[];
    selectedValue?: string | null;
    selectedLabel?: string;
    open?: boolean;
    ariaLabel?: string | null;
    onSelect?: (value: string) => void;
  } = $props();

  let search = $state('');

  let filteredItems = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fonts;
    return fonts.filter(f =>
      f.family.toLowerCase().includes(q) ||
      f.displayName.toLowerCase().includes(q)
    );
  });

  function handleToggle() {
    open = !open;
    if (open) {
      search = '';
      // Focus search input after opening
      requestAnimationFrame(() => searchInput?.focus());
    }
  }

  function handleSelect(value: string) {
    open = false;
    search = '';
    onSelect(value);
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (!open || !rootEl) return;
    const target = event.target;
    if (target instanceof Node && !rootEl.contains(target)) {
      open = false;
      search = '';
    }
  }

  function handleWindowKeyDown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') {
      open = false;
      search = '';
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeyDown} />

<div class="select-menu" bind:this={rootEl}>
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
      <div class="search-box">
        <input
          bind:this={searchInput}
          class="search-input"
          type="text"
          placeholder="🔍"
          bind:value={search}
          onclick={(e: MouseEvent) => e.stopPropagation()}
        />
      </div>
      <!-- Pinned items -->
      <button
        class="select-option pinned"
        class:active={!selectedValue}
        type="button"
        role="option"
        aria-selected={!selectedValue}
        onclick={() => handleSelect('')}
      >{t('follow_template')}</button>
      <button
        class="select-option pinned"
        class:active={selectedValue === '__custom__'}
        type="button"
        role="option"
        aria-selected={selectedValue === '__custom__'}
        onclick={() => handleSelect('__custom__')}
      >{t('font_custom_input')}</button>
      {#if filteredItems.length > 0}
        <div class="divider"></div>
      {/if}
      <!-- Font list -->
      {#each filteredItems as font}
        <button
          class="select-option"
          class:active={font.family === selectedValue}
          class:cjk={font.cjk}
          type="button"
          role="option"
          aria-selected={font.family === selectedValue}
          onclick={() => handleSelect(font.family)}
          style="font-family: '{font.family}', sans-serif"
        >
          <span class="font-display">{font.displayName}</span>
          {#if font.displayName !== font.family}
            <span class="font-family-hint">{font.family}</span>
          {/if}
        </button>
      {/each}
      {#if fonts.length > 0 && filteredItems.length === 0}
        <div class="no-results">—</div>
      {/if}
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
    max-height: 320px;
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

  .search-box {
    padding: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    position: sticky;
    top: 0;
    background: var(--pv-bg-surface);
    z-index: 1;
  }

  .search-input {
    width: 100%;
    padding: 5px 8px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.75rem;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
  }

  .search-input:focus {
    border-color: var(--pv-accent);
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 2px 0;
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
    display: flex;
    align-items: baseline;
    gap: 6px;
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

  .select-option.pinned {
    font-size: 0.73rem;
    color: var(--pv-text-secondary);
  }

  .font-display {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .font-family-hint {
    font-size: 0.65rem;
    color: var(--pv-text-muted);
    opacity: 0.6;
    flex-shrink: 0;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .no-results {
    padding: 12px 10px;
    text-align: center;
    color: var(--pv-text-muted);
    font-size: 0.73rem;
  }
</style>
