<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import { engine, getEngine } from '../../stores/engine.svelte';
  import { t } from '../../i18n';
  import { onMount, onDestroy } from 'svelte';

  let { ready = false } = $props();

  let currentTime = $state(0);
  let totalTime = $state(0);
  let seekValue = $state(0);
  let isSeeking = $state(false);
  let raf: number;

  function formatClock(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function tick() {
    if (ready && engine.instance) {
      currentTime = engine.instance.playbackTime;
      totalTime = engine.instance.timelineDuration;
      if (!isSeeking && totalTime > 0) {
        seekValue = currentTime / totalTime;
      }
    }
    raf = requestAnimationFrame(tick);
  }

  onMount(() => {
    raf = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    cancelAnimationFrame(raf);
  });

  function handleSeekInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    seekValue = v;
    if (engine.instance) {
      engine.instance.seek(v * totalTime);
    }
  }
</script>

<div class="bottom-bar">
  <div class="timeline">
    <span class="time-display">{formatClock(currentTime)}</span>
    <input
      type="range"
      class="seek-slider"
      min="0"
      max="1"
      step="0.001"
      value={seekValue}
      oninput={handleSeekInput}
      onmousedown={() => isSeeking = true}
      onmouseup={() => isSeeking = false}
      ontouchstart={() => isSeeking = true}
      ontouchend={() => isSeeking = false}
    />
    <span class="time-display">{formatClock(totalTime)}</span>
  </div>
</div>

<style>
  .bottom-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    padding: 8px 24px 12px;
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
    pointer-events: auto;
  }

  .timeline {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 600px;
    margin: 0 auto;
  }

  .time-display {
    font-family: var(--pv-font-mono);
    font-size: 0.72rem;
    color: var(--pv-text-secondary);
    min-width: 42px;
    text-align: center;
    user-select: none;
  }

  .seek-slider {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.15);
    cursor: pointer;
    outline: none;
    transition: height 0.15s;
  }

  .seek-slider:hover {
    height: 5px;
  }

  .seek-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--pv-text);
    border: none;
    cursor: pointer;
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.3);
    transition: transform 0.15s;
  }

  .seek-slider::-webkit-slider-thumb:hover {
    transform: scale(1.3);
  }

  .seek-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--pv-text);
    border: none;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .bottom-bar {
      padding: 6px 16px 10px;
    }
    .seek-slider { height: 5px; }
    .seek-slider::-webkit-slider-thumb { width: 18px; height: 18px; }
  }
</style>
