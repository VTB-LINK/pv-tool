<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import Section from '../common/Section.svelte';
  import { engine, showToast } from '../../stores/engine.svelte';
  import { t } from '../../i18n';
  import {
    testNowPlayingConnection,
    type NowPlayingTrack,
  } from '../../services/NowPlayingService';
  import {
    testWesingCapConnection,
  } from '../../services/WesingCapService';
  import { onDestroy } from 'svelte';

  // Props for auto-connecting from URL params
  let { autoStartNp = false, autoStartNwc = false, autoNwcWsAddr = '' } = $props();

  // NowPlaying state
  let npActive = $state(false);
  let npConnecting = $state(false);

  // WesingCap state
  let nwcActive = $state(false);
  let nwcConnecting = $state(false);
  let nwcWsAddr = $state('ws://localhost:8765/ws');
  let nwcShowSettings = $state(false);

  // Derived from engine state
  let npTrack = $derived<NowPlayingTrack | null>(engine.instance?.nowPlayingTrack ?? null);
  let nwcSongName = $derived(engine.instance?.wesingCapSongTitle ?? '');

  // Auto-start from URL params (triggered by props after engine init)
  $effect(() => {
    if (autoStartNp && !npActive && !npConnecting) {
      toggleNowPlaying();
    }
  });

  $effect(() => {
    if (autoStartNwc && !nwcActive && !nwcConnecting) {
      if (autoNwcWsAddr) nwcWsAddr = autoNwcWsAddr;
      toggleWesingCap();
    }
  });

  async function toggleNowPlaying() {
    const eng = engine.instance;
    if (!eng) return;

    if (npActive) {
      eng.nowPlayingListening = false;
      npActive = false;
      return;
    }
    npConnecting = true;
    const ok = await testNowPlayingConnection();
    npConnecting = false;
    if (!ok) {
      showToast(t('np_fail_title'));
      return;
    }
    eng.nowPlayingListening = true;
    npActive = true;
  }

  async function toggleWesingCap() {
    const eng = engine.instance;
    if (!eng) return;

    if (nwcActive) {
      eng.onNwcDisconnect = undefined;
      eng.wesingCapListening = false;
      nwcActive = false;
      return;
    }
    nwcConnecting = true;
    eng.wesingCapWsUrl = nwcWsAddr;
    const ok = await testWesingCapConnection(nwcWsAddr);
    nwcConnecting = false;
    if (!ok) {
      showToast(t('nwc_fail_title'));
      return;
    }
    eng.wesingCapListening = true;
    nwcActive = true;
    eng.onNwcDisconnect = () => {
      nwcActive = false;
      showToast(t('nwc_disconnected'));
    };
  }

  function saveNwcSettings() {
    const eng = engine.instance;
    if (eng) eng.wesingCapWsUrl = nwcWsAddr;
    nwcShowSettings = false;
    showToast(t('nwc_saved'));
  }

  // URL copy options
  let urlOptionsOpen = $state(false);
  let urlOptAlpha = $state(true);
  let urlOptTemplate = $state(true);
  let urlOptListen = $state(true);
  let urlOptPostFx = $state(false);

  /** Build a URL that restores the current state for OBS browser source */
  async function copyObsUrl() {
    const base = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();

    // Always hide panels for OBS
    params.set('panel', '0');

    // Optional: transparent background
    if (urlOptAlpha) params.set('bg', '0');

    // Optional: current template
    if (urlOptTemplate) {
      const tplIdx = engine.currentTemplateIndex;
      if (tplIdx >= 0) params.set('t', String(tplIdx));
    }

    // Optional: listen state
    if (urlOptListen) {
      if (npActive) params.set('np', '1');
      if (nwcActive) {
        params.set('nwc', '1');
        // Also emit old param name for backward compat with legacy pv-tool
        params.set('metabox-nexus-wesingcap', '1');
        // Include custom WS address if not default
        if (nwcWsAddr && nwcWsAddr !== 'ws://localhost:8765/ws') {
          params.set('nwcws', nwcWsAddr);
          // Also emit old-format param (host:port only) for backward compat
          const hostPort = nwcWsAddr.replace(/^ws:\/\//, '').replace(/\/ws\/?$/, '');
          if (hostPort) params.set('metabox-nexus-wesingcap-addr', hostPort);
        }
      }
    }

    // Optional: Post FX values
    if (urlOptPostFx) {
      if (engine.shake !== 0) params.set('shake', engine.shake.toFixed(2));
      if (engine.zoom !== 0) params.set('zoom', engine.zoom.toFixed(2));
      if (engine.tilt !== 0) params.set('tilt', engine.tilt.toFixed(2));
      if (engine.glitch !== 0) params.set('glitch', engine.glitch.toFixed(2));
      if (engine.hueShift !== 0) params.set('hue', String(engine.hueShift));
    }

    const url = base + '?' + params.toString();
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('url_copied'));
      urlOptionsOpen = false;
    } catch {
      prompt('Copy URL:', url);
    }
  }

  onDestroy(() => {
    const eng = engine.instance;
    if (eng) {
      if (npActive) eng.nowPlayingListening = false;
      if (nwcActive) {
        eng.onNwcDisconnect = undefined;
        eng.wesingCapListening = false;
      }
    }
  });
</script>

<div class="listen-panel">
  <Section label={`📡 ${t('live_mode')}`}>
    <!-- NowPlaying -->
    <div class="service-row">
      <button class="listen-btn" class:active={npActive} onclick={toggleNowPlaying} disabled={npConnecting}>
        {#if npConnecting}
          ⏳ {t('listen_nowplaying')}...
        {:else if npActive}
          ✅ {t('listen_nowplaying')}
        {:else}
          🎵 {t('listen_nowplaying')}
        {/if}
      </button>
      {#if npTrack}
        <div class="track-info">
          {#if npTrack.cover}
            <img src={npTrack.cover} alt="cover" class="track-cover" />
          {/if}
          <div class="track-meta">
            <span class="track-title">{npTrack.title}</span>
            <span class="track-artist">{npTrack.author}</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- WesingCap -->
    <div class="service-row">
      <button class="listen-btn" class:active={nwcActive} onclick={toggleWesingCap} disabled={nwcConnecting}>
        {#if nwcConnecting}
          ⏳ {t('listen_wesingcap')}...
        {:else if nwcActive}
          ✅ {t('listen_wesingcap')}
        {:else}
          🎤 {t('listen_wesingcap')}
        {/if}
      </button>
      {#if nwcSongName}
        <div class="track-info">
          <span class="track-title">{nwcSongName}</span>
        </div>
      {/if}
      <button class="settings-btn" onclick={() => nwcShowSettings = !nwcShowSettings}>
        ⚙ {t('nwc_settings_title')}
      </button>
      {#if nwcShowSettings}
        <div class="settings-form">
          <span class="form-label">{t('nwc_ws_addr')}</span>
          <input type="text" class="form-input" bind:value={nwcWsAddr} placeholder={t('nwc_ws_addr_placeholder')} />
          <button class="save-btn" onclick={saveNwcSettings}>{t('nwc_save')}</button>
        </div>
      {/if}
    </div>

    <!-- Copy OBS URL with options -->
    <button class="copy-url-btn" onclick={() => urlOptionsOpen = !urlOptionsOpen}>
      🔗 {t('copy_obs_url')}
    </button>
    {#if urlOptionsOpen}
      <div class="url-options">
        <label class="url-opt-row">
          <input type="checkbox" bind:checked={urlOptAlpha} />
          <span>{t('url_opt_alpha')}</span>
        </label>
        <label class="url-opt-row">
          <input type="checkbox" bind:checked={urlOptTemplate} />
          <span>{t('url_opt_template')}</span>
        </label>
        <label class="url-opt-row">
          <input type="checkbox" bind:checked={urlOptListen} />
          <span>{t('url_opt_listen')}</span>
        </label>
        <label class="url-opt-row">
          <input type="checkbox" bind:checked={urlOptPostFx} />
          <span>{t('url_opt_postfx')}</span>
        </label>
        <button class="copy-confirm-btn" onclick={copyObsUrl}>
          📋 {t('copy')}
        </button>
      </div>
    {/if}
  </Section>
</div>

<style>
  .listen-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .service-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--pv-border);
    margin-bottom: 6px;
  }

  .service-row:last-of-type {
    margin-bottom: 8px;
  }

  .listen-btn {
    width: 100%;
    padding: 8px 14px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-elevated);
    color: var(--pv-text);
    font-size: 0.78rem;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--pv-duration);
    text-align: center;
  }

  .listen-btn:hover { background: var(--pv-bg-hover); border-color: var(--pv-border-hover); }
  .listen-btn.active { border-color: var(--pv-accent); color: var(--pv-accent); }
  .listen-btn:disabled { opacity: 0.5; cursor: wait; }

  .track-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }

  .track-cover {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    object-fit: cover;
    border: 1px solid var(--pv-border);
  }

  .track-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
  }

  .track-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--pv-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-artist {
    font-size: 0.65rem;
    color: var(--pv-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .settings-btn {
    width: 100%;
    padding: 3px 8px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--pv-text-muted);
    font-size: 0.68rem;
    font-family: inherit;
    cursor: pointer;
    text-align: center;
    transition: color var(--pv-duration);
  }

  .settings-btn:hover { color: var(--pv-text); }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 6px;
    background: var(--pv-bg-elevated);
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
  }

  .form-label {
    font-size: 0.65rem;
    color: var(--pv-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .form-input {
    padding: 5px 8px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-border);
    background: var(--pv-bg-surface);
    color: var(--pv-text);
    font-size: 0.72rem;
    font-family: var(--pv-font-mono);
    width: 100%;
    box-sizing: border-box;
  }

  .form-input::placeholder { color: var(--pv-text-muted); }

  .save-btn {
    padding: 3px 10px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-accent);
    background: transparent;
    color: var(--pv-accent);
    font-size: 0.7rem;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--pv-duration);
  }

  .save-btn:hover { background: var(--pv-accent); color: #000; }

  .copy-url-btn {
    width: 100%;
    padding: 8px 14px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-accent);
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
    color: var(--pv-accent);
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--pv-duration);
    text-align: center;
  }

  .copy-url-btn:hover {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25));
    border-color: var(--pv-accent-glow);
    box-shadow: 0 0 12px var(--pv-accent-glow);
  }

  .url-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: var(--pv-bg-elevated);
    border: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-sm);
    margin-top: 4px;
  }

  .url-opt-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--pv-text-secondary);
    cursor: pointer;
    transition: color 0.15s;
  }

  .url-opt-row:hover { color: var(--pv-text); }

  .url-opt-row input[type="checkbox"] {
    accent-color: var(--pv-accent);
    cursor: pointer;
    width: 13px;
    height: 13px;
  }

  .copy-confirm-btn {
    width: 100%;
    padding: 6px 12px;
    margin-top: 2px;
    border-radius: var(--pv-radius-sm);
    border: 1px solid var(--pv-accent);
    background: var(--pv-accent);
    color: #000;
    font-size: 0.72rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    text-align: center;
    transition: all var(--pv-duration);
  }

  .copy-confirm-btn:hover {
    box-shadow: 0 0 12px var(--pv-accent-glow);
  }
</style>
