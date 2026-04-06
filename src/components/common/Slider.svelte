<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  let {
    label = '',
    value = $bindable(0),
    min = 0,
    max = 1,
    step = 0.01,
    format = (v: number) => v.toFixed(2),
    oninput = (_v: number) => {},
  } = $props();

  let isEditing = $state(false);
  let editValue = $state(0);
  let isCancelled = $state(false);

  function handleInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    value = v;
    oninput(v);
  }

  function startEdit() {
    editValue = value;
    isEditing = true;
    isCancelled = false;
    // Auto-select text after DOM updates
    setTimeout(() => {
      const input = document.querySelector('.slider-input') as HTMLInputElement;
      input?.select();
    }, 0);
  }

  function finishEdit() {
    if (isCancelled) return;
    value = editValue;
    oninput(value);
    isEditing = false;
  }
</script>

<div class="slider-control">
  <div class="slider-header">
    <span class="slider-label">{label}</span>
    {#if isEditing}
      <input
        type="number"
        {min}
        {max}
        {step}
        bind:value={editValue}
        onblur={finishEdit}
        onkeydown={(e) => {
          if (e.key === 'Enter') finishEdit();
          if (e.key === 'Escape') {
            isCancelled = true;
            isEditing = false;
          }
        }}
        class="slider-input"
        use:actionHighlight
      />
    {:else}
      <span class="slider-value" role="button" tabindex="0" ondblclick={startEdit} onkeydown={(e) => e.key === 'Enter' && startEdit()}>{format(value)}</span>
    {/if}
  </div>

  <script>
    function actionHighlight(node: HTMLInputElement) {
      node.focus();
      node.select();
    }
  </script>
  <input
    type="range"
    {min}
    {max}
    {step}
    {value}
    oninput={handleInput}
    class="slider"
  />
</div>

<style>
  .slider-control {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .slider-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--pv-text-secondary);
    text-transform: capitalize;
    letter-spacing: 0.5px;
  }

  .slider-value {
    font-size: 0.7rem;
    font-family: var(--pv-font-mono);
    color: var(--pv-accent);
    min-width: 36px;
    text-align: right;
  }

  .slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: var(--pv-bg-hover);
    cursor: pointer;
    outline: none;
    transition: background var(--pv-duration);
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--pv-accent);
    border: 2px solid var(--pv-bg-surface);
    box-shadow: 0 0 8px var(--pv-accent-glow);
    cursor: pointer;
    transition: transform 0.15s var(--pv-ease), box-shadow 0.15s;
  }

  .slider-value {
    font-size: 0.7rem;
    font-family: var(--pv-font-mono);
    color: var(--pv-accent);
    min-width: 36px;
    text-align: right;
    cursor: pointer;
  }

  .slider-input {
    width: 60px;
    font-size: 0.7rem;
    font-family: var(--pv-font-mono);
    background: var(--pv-bg-surface);
    color: var(--pv-accent);
    border: 1px solid var(--pv-accent);
    border-radius: 4px;
    text-align: right;
    outline: none;
  }

  /* Remove spin buttons */
  .slider-input::-webkit-outer-spin-button,
  .slider-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .slider-input {
    -moz-appearance: textfield;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 14px var(--pv-accent-glow);
  }

  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--pv-accent);
    border: 2px solid var(--pv-bg-surface);
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .slider {
      height: 6px;
    }
    .slider::-webkit-slider-thumb {
      width: 20px;
      height: 20px;
    }
  }
</style>
