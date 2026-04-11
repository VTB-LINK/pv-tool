<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import { engine, setAudioVolume } from '../../stores/engine.svelte';
  import { t } from '../../i18n';
  import { onMount, onDestroy } from 'svelte';

  let { ready = false, visible = true } = $props();

  let currentTime = $state(0);
  let totalTime = $state(0);
  let durationSource = $state<'nowPlaying' | 'nxpc' | 'audio' | 'lyrics' | 'media' | 'text'>('text');
  let seekValue = $state(0);
  let isSeeking = $state(false);
  let isPaused = $state(false);
  let isLooping = $state(true);
  let volume = $state(0.5);
  let prevVolume = $state(0.5);
  let raf: number;

  function formatClock(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function sourceLabel(source: 'nowPlaying' | 'nxpc' | 'audio' | 'lyrics' | 'media' | 'text'): string {
    if (source === 'nowPlaying') return t('duration_source_nowplaying');
    if (source === 'nxpc') return t('duration_source_nxpc');
    if (source === 'audio') return t('duration_source_audio');
    if (source === 'lyrics') return t('duration_source_lyrics');
    if (source === 'media') return t('duration_source_media');
    return t('duration_source_text');
  }

  function tick() {
    if (ready && engine.instance) {
      currentTime = engine.instance.playbackTime;
      totalTime = engine.instance.timelineDuration;
      durationSource = engine.instance.timelineDurationSource;
      isPaused = engine.instance.paused;
      isLooping = engine.instance.loopMode;
      volume = engine.audioVolume;
      if (volume > 0) {
        prevVolume = volume;
      }
      if (!isSeeking && totalTime > 0) {
        seekValue = Math.min(currentTime / totalTime, 1);
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

  function togglePlayPause() {
    if (!engine.instance) return;
    if (engine.instance.paused) {
      engine.instance.resume();
    } else {
      engine.instance.pause();
    }
  }

  function handleReplay() {
    if (!engine.instance) return;
    engine.instance.replay();
  }

  function toggleLoop() {
    if (!engine.instance) return;
    engine.instance.loopMode = !engine.instance.loopMode;
  }

  function handleVolumeInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    volume = v;
    setAudioVolume(v);
  }

  function toggleMute() {
    if (volume > 0) {
      prevVolume = volume;
      volume = 0;
    } else {
      volume = prevVolume > 0 ? prevVolume : 0.5;
    }
    setAudioVolume(volume);
  }
</script>

<div class="bottom-bar" class:hidden={!visible}>
  <div class="bottom-bar-content">
    <div class="duration-source">
      <span class="duration-source-label">{t('duration_source_label')}:</span>
      <span class="duration-source-value">{sourceLabel(durationSource)}</span>
    </div>
    <div class="timeline">
      <div class="transport-group">
        <button class="transport-btn" onclick={handleReplay} title="Replay">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </button>
        <button class="transport-btn play-btn" onclick={togglePlayPause} title={isPaused ? 'Play' : 'Pause'}>
          {#if isPaused}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,4 20,12 6,20"/>
            </svg>
          {:else}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="4" width="4" height="16"/><rect x="15" y="4" width="4" height="16"/>
            </svg>
          {/if}
        </button>
      </div>

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

      <div class="right-controls">
        <button class="transport-btn loop-btn" class:active={isLooping} onclick={toggleLoop} title={isLooping ? 'Loop' : 'Play once'}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>

        <div class="volume-group">
          <button class="transport-btn volume-btn" onclick={toggleMute} title={volume > 0 ? 'Mute' : 'Unmute'}>
            {#if volume === 0}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            {:else if volume < 0.5}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            {:else}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            {/if}
          </button>
          <div class="volume-popover">
            <input
              type="range"
              class="volume-slider"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              oninput={handleVolumeInput}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .bottom-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    padding: 6px 0 10px;
    background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%);
    pointer-events: none;
    opacity: 1;
    transform: translateY(0);
    transition: opacity var(--pv-duration-slow) var(--pv-ease),
                transform var(--pv-duration-slow) var(--pv-ease);
  }

  .bottom-bar.hidden {
    opacity: 0;
    transform: translateY(8px);
  }

  .bottom-bar-content {
    width: min(680px, calc(100vw - (var(--pv-panel-width) * 2) - 80px));
    margin: 0 auto;
    min-width: 0;
    pointer-events: auto;
  }

  .bottom-bar.hidden .bottom-bar-content {
    pointer-events: none;
  }

  .duration-source {
    width: 100%;
    margin: 0 0 4px;
    font-size: 0.62rem;
    color: var(--pv-text-muted);
    display: flex;
    align-items: baseline;
    gap: 4px;
    letter-spacing: 0.3px;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .duration-source-label,
  .duration-source-value {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .duration-source-label {
    flex: 0 0 auto;
  }

  .duration-source-value {
    min-width: 0;
  }

  .timeline {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin: 0;
    min-width: 0;
  }

  .transport-group {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .right-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .transport-btn {
    background: none;
    border: none;
    color: var(--pv-text-secondary);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    user-select: none;
    line-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
  }

  .transport-btn:hover {
    color: var(--pv-text);
    background: rgba(255, 255, 255, 0.08);
  }

  .play-btn {
    width: 30px;
    height: 30px;
  }

  .loop-btn {
    opacity: 0.35;
    transition: opacity 0.15s, color 0.15s, background 0.15s;
  }

  .loop-btn.active {
    opacity: 1;
    color: var(--pv-accent);
  }

  .volume-group {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .volume-btn {
    opacity: 0.6;
    transition: opacity 0.15s, color 0.15s;
  }

  .volume-btn:hover {
    opacity: 1;
  }

  .volume-popover {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 2px);
    width: 32px;
    height: 104px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 18, 0.92);
    border: 1px solid var(--pv-border);
    border-radius: 999px;
    box-shadow: var(--pv-shadow);
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 6px);
    transition: opacity var(--pv-duration) var(--pv-ease),
                transform var(--pv-duration) var(--pv-ease);
  }

  .volume-popover::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -12px;
    height: 12px;
  }

  .volume-group:hover .volume-popover,
  .volume-group:focus-within .volume-popover {
    opacity: 1;
    pointer-events: auto;
    transform: translate(-50%, 0);
  }

  .volume-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 72px;
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.15);
    cursor: pointer;
    outline: none;
    transform: rotate(-90deg);
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--pv-text-secondary);
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }

  .volume-slider::-webkit-slider-thumb:hover {
    background: var(--pv-text);
  }

  .volume-slider::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--pv-text-secondary);
    border: none;
    cursor: pointer;
  }

  .time-display {
    font-family: var(--pv-font-mono);
    font-size: 0.7rem;
    color: var(--pv-text-secondary);
    min-width: 38px;
    text-align: center;
    user-select: none;
  }

  .seek-slider {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    min-width: 0;
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
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.2);
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

  @media (max-width: 1180px) {
    .bottom-bar-content {
      width: calc(100vw - (var(--pv-panel-width) * 2) - 56px);
    }

    .duration-source {
      font-size: 0.58rem;
      margin-bottom: 3px;
    }

    .duration-source-label {
      display: none;
    }

    .timeline {
      gap: 6px;
    }

    .time-display {
      min-width: 34px;
      font-size: 0.66rem;
    }
  }

  @media (max-width: 768px) {
    .bottom-bar {
      padding: 6px 16px 10px;
      pointer-events: auto;
    }

    .bottom-bar-content {
      width: 100%;
    }

    .duration-source {
      font-size: 0.56rem;
      margin-bottom: 3px;
    }
    .seek-slider { height: 5px; }
    .seek-slider::-webkit-slider-thumb { width: 18px; height: 18px; }
    .volume-popover {
      display: none;
    }
  }
</style>
