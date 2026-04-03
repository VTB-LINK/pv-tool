<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import ExpandPanel from '../common/ExpandPanel.svelte';
  import Section from '../common/Section.svelte';
  import { engine, showToast } from '../../stores/engine.svelte';
  import { getCurrentTemplateConfig } from '../../stores/engine.svelte';
  import { encodeShareCode } from '../../services/templateStore';
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
    // Mutual exclusion: deactivate WesingCap if active
    if (nwcActive) {
      eng.onNwcDisconnect = undefined;
      eng.wesingCapListening = false;
      nwcActive = false;
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
    // Mutual exclusion: deactivate NowPlaying if active
    if (npActive) {
      eng.nowPlayingListening = false;
      npActive = false;
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
  let urlOptPostFx = $state(true);
  let urlOptFeatures = $state(true);
   const wesingCapLogoUrl = `${import.meta.env.BASE_URL}metabox5.svg`;

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
      if (tplIdx >= 0 && !engine.customDirty) {
        params.set('t', String(tplIdx));
      } else {
        // Custom, user-saved, or modified builtin template: encode current state as sharecode
        const config = getCurrentTemplateConfig();
        if (config) {
          try {
            const code = await encodeShareCode(config);
            params.set('t', 'custom');
            params.set('sharecode', code);
          } catch {
            // fallback: omit template
          }
        }
      }
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
      // Always include explicit values so sharecode/defaults cannot override them.
      params.set('shake', engine.shake.toFixed(2));
      params.set('zoom', engine.zoom.toFixed(2));
      params.set('tilt', engine.tilt.toFixed(2));
      params.set('glitch', engine.glitch.toFixed(2));
      params.set('hue', String(engine.hueShift));
      params.set('seg', engine.segmentDuration.toFixed(2));
      params.set('speed', engine.animationSpeed.toFixed(2));
      params.set('motion', engine.motionIntensity.toFixed(2));
      params.set('opacity', engine.effectOpacity.toFixed(2));
      params.set('bpm', String(Math.round(engine.bpm)));
      params.set('beatreact', engine.beatReactivity.toFixed(2));
    }

    if (urlOptFeatures) {
      params.set('outline', engine.mediaOutline ? '1' : '0');
      params.set('autocolors', engine.autoExtractColors ? '1' : '0');
      params.set('motiondetect', engine.motionDetection ? '1' : '0');
      params.set('invertmedia', engine.invertMedia ? '1' : '0');
      params.set('thresholdmedia', engine.thresholdMedia ? '1' : '0');
    }

    const url = base + '?' + params.toString();
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('url_copied'));
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
      <button class="pv-btn listen-btn" class:active={npActive} onclick={toggleNowPlaying} disabled={npConnecting}>
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
      <button class="pv-btn listen-btn" class:active={nwcActive} onclick={toggleWesingCap} disabled={nwcConnecting}>
        {#if nwcConnecting}
          <span class="service-label">
            <span class="service-emoji" aria-hidden="true">⏳</span>
            <span>{t('listen_wesingcap')}...</span>
          </span>
        {:else if nwcActive}
          <span class="service-label">
            <span class="service-emoji" aria-hidden="true">✅</span>
            <span>{t('listen_wesingcap')}</span>
          </span>
        {:else}
          <span class="service-label">
              <img src={wesingCapLogoUrl} alt="" aria-hidden="true" class="service-logo" />
            <span>{t('listen_wesingcap')}</span>
          </span>
        {/if}
      </button>
      {#if nwcSongName}
        <div class="track-info">
          <span class="track-title">{nwcSongName}</span>
        </div>
      {/if}
      <button class="pv-btn-link settings-btn" onclick={() => nwcShowSettings = !nwcShowSettings}>
        ⚙ {t('nwc_settings_title')}
      </button>
      <ExpandPanel visible={nwcShowSettings}>
        {#snippet children()}
          <span class="form-label">{t('nwc_ws_addr')}</span>
          <input type="text" class="pv-input pv-input-compact pv-input-mono pv-input-surface pv-control-full" bind:value={nwcWsAddr} placeholder={t('nwc_ws_addr_placeholder')} />
          <button class="pv-btn pv-btn-xs pv-btn-outline-accent save-btn" onclick={saveNwcSettings}>{t('nwc_save')}</button>
        {/snippet}
      </ExpandPanel>
    </div>

    <!-- Copy OBS URL with options -->
    <button class="pv-btn pv-btn-block pv-btn-cta copy-url-btn" onclick={() => urlOptionsOpen = !urlOptionsOpen}>
      🔗 {t('copy_obs_url')}
    </button>
    <ExpandPanel visible={urlOptionsOpen}>
      {#snippet children()}
        <label class="pv-check-row">
          <input type="checkbox" bind:checked={urlOptAlpha} />
          <span class="pv-check-text">{t('url_opt_alpha')}</span>
        </label>
        <label class="pv-check-row">
          <input type="checkbox" bind:checked={urlOptTemplate} />
          <span class="pv-check-text">{t('url_opt_template')}</span>
        </label>
        <label class="pv-check-row">
          <input type="checkbox" bind:checked={urlOptListen} />
          <span class="pv-check-text">{t('url_opt_listen')}</span>
        </label>
        <label class="pv-check-row">
          <input type="checkbox" bind:checked={urlOptPostFx} />
          <span class="pv-check-text">{t('url_opt_postfx')}</span>
        </label>
        <label class="pv-check-row">
          <input type="checkbox" bind:checked={urlOptFeatures} />
          <span class="pv-check-text">{t('url_opt_features')}</span>
        </label>
        <button class="pv-btn pv-btn-sm pv-btn-accent pv-btn-block copy-confirm-btn" onclick={copyObsUrl}>
          📋 {t('copy')}
        </button>
      {/snippet}
    </ExpandPanel>
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
  }
  .listen-btn.active { border-color: var(--pv-accent); color: var(--pv-accent); }
  .listen-btn:disabled { cursor: wait; }

  .service-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
  }

  .service-emoji {
    flex-shrink: 0;
    line-height: 1;
  }

  .service-logo {
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    display: block;
    object-fit: contain;
  }

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
    justify-content: center;
  }

  .form-label {
    font-size: 0.65rem;
    color: var(--pv-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .copy-url-btn {
    font-weight: 600;
  }

  .copy-confirm-btn {
    margin-top: 2px;
    color: #000;
    font-weight: 600;
  }

  .copy-confirm-btn:hover {
    box-shadow: 0 0 12px var(--pv-accent-glow);
  }
</style>
