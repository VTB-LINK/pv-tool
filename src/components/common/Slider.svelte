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

  function handleInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    value = v;
    oninput(v);
  }
</script>

<div class="slider-control">
  <div class="slider-header">
    <span class="slider-label">{label}</span>
    <span class="slider-value">{format(value)}</span>
  </div>
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
