<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import { t } from '../../i18n';

  let {
    value = [],
    options = undefined as string[] | undefined,
    allowCustom = false,
    onchange = (_nextValue: string[]) => {},
  }: {
    value?: string[];
    options?: string[];
    allowCustom?: boolean;
    onchange?: (nextValue: string[]) => void;
  } = $props();

  let customValue = $state('');
  let selectedOption = $state('');

  const availableOptions = $derived((options ?? []).filter(option => !value.includes(option)));

  $effect(() => {
    if (!availableOptions.includes(selectedOption)) {
      selectedOption = availableOptions[0] ?? '';
    }
  });

  function addItem(item: string) {
    const nextItem = item.trim();
    if (!nextItem || value.includes(nextItem)) return;
    onchange([...value, nextItem]);
  }

  function removeItem(item: string) {
    onchange(value.filter(current => current !== item));
  }

  function handleAddSelected() {
    if (!selectedOption) return;
    addItem(selectedOption);
  }

  function handleAddCustom() {
    addItem(customValue);
    customValue = '';
  }
</script>

<div class="string-array-control">
  <div class="array-chip-list">
    {#each value as item}
      <button class="pv-btn pv-btn-xs array-chip" type="button" onclick={() => removeItem(item)}>
        <span class="array-chip-label">{item}</span>
        <span class="array-chip-remove">×</span>
      </button>
    {/each}
  </div>

  <div class="array-editor-row">
    {#if options && options.length > 0}
      <select class="pv-select pv-select-compact pv-select-mono array-select" bind:value={selectedOption} disabled={availableOptions.length === 0}>
        {#if availableOptions.length === 0}
          <option value="">—</option>
        {:else}
          {#each availableOptions as option}
            <option value={option}>{option}</option>
          {/each}
        {/if}
      </select>
      <button class="pv-btn pv-btn-xs" type="button" disabled={availableOptions.length === 0} onclick={handleAddSelected}>+ {t('array_add_item')}</button>
    {/if}

    {#if allowCustom}
      <input
        type="text"
        class="pv-input pv-input-compact pv-control-grow pv-input-mono"
        bind:value={customValue}
        placeholder={t('array_item_placeholder')}
        onkeydown={(event: KeyboardEvent) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleAddCustom();
          }
        }}
      />
      <button class="pv-btn pv-btn-xs" type="button" disabled={!customValue.trim()} onclick={handleAddCustom}>+ {t('array_add_item')}</button>
    {/if}
  </div>
</div>

<style>
  .string-array-control {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  .array-chip-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
    width: 100%;
  }

  .array-chip {
    gap: 6px;
    max-width: 100%;
  }

  .array-chip-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .array-chip-remove {
    font-size: 0.8em;
    opacity: 0.7;
  }

  .array-editor-row {
    display: flex;
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 6px;
  }

  .array-select {
    min-width: 120px;
  }
</style>