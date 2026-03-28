<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import './styles/global.css';
  import LeftPanel from './components/layout/LeftPanel.svelte';
  import RightPanel from './components/layout/RightPanel.svelte';
  import BottomBar from './components/layout/BottomBar.svelte';
  import Toast from './components/common/Toast.svelte';
  import TemplateEditor from './components/editor/TemplateEditor.svelte';
  import MobileNav from './components/mobile/MobileNav.svelte';
  import MobileSheet from './components/mobile/MobileSheet.svelte';
  import { engine, initEngine, selectTemplate, toggleRecording, resetPostFx, toggleAudio, setAlphaMode, setShake, setZoom, setTilt, setGlitch, setHueShift, loadShareCodeTemplate } from './stores/engine.svelte';
  import { decodeShareCode } from './services/templateStore';
  import { t } from './i18n';
  import { templates } from './templates';
  import { onMount, onDestroy } from 'svelte';
  import { bindSwipe, bindPinch } from './services/gestures';
  import { PerfMonitor, recommendedDpr } from './services/perfMonitor';
  import { bindKeyboard } from './services/keyboard';

  let canvasContainer: HTMLDivElement;
  let panelsVisible = $state(true);
  let ready = $state(false);
  let editorOpen = $state(false);

  // Flash the edit button when editor closes while in custom mode
  let flashEditBtn = $state(false);
  let editorWasOpen = false;

  $effect(() => {
    if (editorWasOpen && !editorOpen && engine.isCustomMode) {
      flashEditBtn = true;
      setTimeout(() => { flashEditBtn = false; }, 2000);
    }
    editorWasOpen = editorOpen;
  });

  // Mobile state
  let mobileTab = $state<string>('canvas');
  let mobileSheetVisible = $state(false);

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  // Performance monitor
  let perfMonitor: PerfMonitor | null = null;
  let cleanupGestures: (() => void)[] = [];
  let cleanupKeyboard: (() => void) | null = null;

  // URL param auto-start flags for ListenPanel
  let autoStartNp = $state(false);
  let autoStartNwc = $state(false);
  let autoNwcWsAddr = $state('');

  onMount(async () => {
    await initEngine(canvasContainer);
    ready = true;

    // ── URL Params (OBS mode restore) — must run AFTER engine init ──
    const params = new URLSearchParams(window.location.search);

    // Restore template
    const tpl = params.get('t');
    if (tpl !== null) {
      if (tpl === 'custom') {
        // Custom template via sharecode
        const sharecode = params.get('sharecode');
        if (sharecode) {
          try {
            const decoded = await decodeShareCode(sharecode);
            loadShareCodeTemplate(decoded);
          } catch (err) {
            console.warn('[PV] Failed to decode sharecode from URL:', err);
          }
        }
      } else {
        const idx = parseInt(tpl);
        if (!isNaN(idx) && idx >= 0 && idx < templates.length) {
          selectTemplate(idx);
        }
      }
    }

    // Hide panels for OBS
    if (params.get('panel') === '0') {
      panelsVisible = false;
    }

    // Transparent background
    if (params.get('bg') === '0') {
      setAlphaMode(true);
    }

    // Auto-connect NowPlaying / WesingCap (via props to ListenPanel)
    // New params (nwc, nwcws) take priority; fall back to legacy params only when new ones absent.
    if (params.get('np') === '1') autoStartNp = true;
    const nwcEnable = params.has('nwc') ? params.get('nwc') === '1'
      : params.get('metabox-nexus-wesingcap') === '1';
    if (nwcEnable) {
      autoStartNwc = true;
      const nwcws = params.get('nwcws');
      if (nwcws) {
        autoNwcWsAddr = nwcws;
      } else {
        const legacyAddr = params.get('metabox-nexus-wesingcap-addr');
        if (legacyAddr && legacyAddr !== '0') {
          autoNwcWsAddr = 'ws://' + decodeURIComponent(legacyAddr) + '/ws';
        }
      }
    }

    // Restore Post FX from URL
    const shake = params.get('shake');
    if (shake !== null) setShake(parseFloat(shake));
    const zoom = params.get('zoom');
    if (zoom !== null) setZoom(parseFloat(zoom));
    const tilt = params.get('tilt');
    if (tilt !== null) setTilt(parseFloat(tilt));
    const glitch = params.get('glitch');
    if (glitch !== null) setGlitch(parseFloat(glitch));
    const hue = params.get('hue');
    if (hue !== null) setHueShift(parseFloat(hue));

    // Start performance auto-scaling on mobile or low-end
    if (isMobile || recommendedDpr() < window.devicePixelRatio) {
      perfMonitor = new PerfMonitor((dpr) => {
        const eng = engine.instance;
        if (eng && (eng as any)._currentResolution !== undefined) {
          (eng as any)._currentResolution = dpr;
          (eng as any).syncResolution?.();
        }
      }, { targetFps: isMobile ? 24 : 30 });
      perfMonitor.start();
    }

    // Bind touch gestures on mobile
    if (isMobile && canvasContainer) {
      // Swipe left/right to change tabs
      const tabOrder = ['canvas', 'template', 'controls', 'export'];
      const swipeCleanup = bindSwipe(canvasContainer, (result) => {
        const idx = tabOrder.indexOf(mobileTab);
        if (result.direction === 'left' && idx < tabOrder.length - 1) {
          mobileTab = tabOrder[idx + 1];
          mobileSheetVisible = mobileTab !== 'canvas';
        } else if (result.direction === 'right' && idx > 0) {
          mobileTab = tabOrder[idx - 1];
          mobileSheetVisible = mobileTab !== 'canvas';
        } else if (result.direction === 'up' && mobileTab === 'canvas') {
          mobileSheetVisible = true;
          mobileTab = 'template';
        } else if (result.direction === 'down') {
          mobileSheetVisible = false;
          mobileTab = 'canvas';
        }
      });
      cleanupGestures.push(swipeCleanup);

      // Pinch to zoom media
      const pinchCleanup = bindPinch(canvasContainer, (result) => {
        const eng = engine.instance;
        if (eng) {
          const currentState = eng.getMediaState();
          if (currentState) {
            eng.setMediaScale(currentState.scale * result.scale);
          }
        }
      });
      cleanupGestures.push(pinchCleanup);
    }
  });

  onDestroy(() => {
    perfMonitor?.stop();
    cleanupGestures.forEach(fn => fn());
    cleanupKeyboard?.();
  });

  // Keyboard shortcuts — bind after engine init for template/recording actions
  $effect(() => {
    if (!ready) return;
    cleanupKeyboard?.();
    cleanupKeyboard = bindKeyboard({
      togglePanels: () => { panelsVisible = !panelsVisible; },
      toggleRecording,
      togglePlay: toggleAudio,
      openEditor: () => { editorOpen = true; },
      nextTemplate: () => {
        const idx = engine.currentTemplateIndex;
        if (idx < templates.length - 1) selectTemplate(idx + 1);
      },
      prevTemplate: () => {
        const idx = engine.currentTemplateIndex;
        if (idx > 0) selectTemplate(idx - 1);
      },
      resetPostFx,
    });
  });

  // Watch mobile tab changes
  $effect(() => {
    mobileSheetVisible = mobileTab !== 'canvas';
  });
</script>


<div class="app" class:panels-hidden={!panelsVisible} class:is-mobile={isMobile}>
  <!-- Canvas (always underneath) -->
  <div class="canvas-area" bind:this={canvasContainer}></div>

  {#if !isMobile}
    <!-- Desktop layout -->
    <div class="panels-desktop" class:hidden={!panelsVisible}>
      <LeftPanel {ready} onOpenEditor={() => editorOpen = true} {flashEditBtn} />
      <RightPanel {ready} {autoStartNp} {autoStartNwc} {autoNwcWsAddr} />
    </div>

    {#if panelsVisible}
      <BottomBar {ready} />
    {/if}

    <!-- Hint -->
    {#if panelsVisible}
      <div class="hint">{t('hint_press')} <kbd>H</kbd> {t('hint_hide_panels')}</div>
    {/if}
  {:else}
    <!-- Mobile layout -->
    {#if mobileSheetVisible}
      <div class="mobile-sheet" class:open={mobileSheetVisible}>
        <MobileSheet tab={mobileTab} onOpenEditor={() => editorOpen = true} />
      </div>
    {/if}

    <MobileNav bind:activeTab={mobileTab} onOpenEditor={() => editorOpen = true} />
  {/if}

  <Toast />
  <TemplateEditor bind:visible={editorOpen} />
</div>

<style>
  .app {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
    touch-action: manipulation;
  }

  .canvas-area {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  /* ── Desktop Panels ── */
  .panels-desktop {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    display: flex;
    justify-content: space-between;
    padding: 16px;
    gap: 16px;
    transition: opacity var(--pv-duration-slow) var(--pv-ease),
                transform var(--pv-duration-slow) var(--pv-ease);
  }

  .panels-desktop.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-8px);
  }

  .panels-desktop :global(> *) {
    pointer-events: auto;
  }

  /* ── Mobile ── */
  .mobile-sheet {
    position: fixed;
    bottom: 56px; /* above nav bar */
    left: 0;
    right: 0;
    z-index: 100;
    background: var(--pv-bg-surface);
    backdrop-filter: blur(20px) saturate(1.4);
    border-top: 1px solid var(--pv-border);
    border-radius: var(--pv-radius-lg) var(--pv-radius-lg) 0 0;
    animation: slideUp 0.25s var(--pv-ease);
    max-height: 55vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  @keyframes slideUp {
    from { transform: translateY(30%); opacity: 0.8; }
    to { transform: translateY(0); opacity: 1; }
  }

  /* ── Hint ── */
  .hint {
    position: absolute;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    font-size: 11px;
    color: var(--pv-text-muted);
    user-select: none;
    pointer-events: none;
    white-space: nowrap;
  }

  .hint kbd {
    display: inline-block;
    padding: 1px 6px;
    font-size: 10px;
    font-family: var(--pv-font-mono);
    color: var(--pv-text-secondary);
    background: var(--pv-bg-elevated);
    border: 1px solid var(--pv-border);
    border-radius: 4px;
    line-height: 1.4;
  }

  /* ── Mobile viewport adjustments ── */
  .is-mobile .canvas-area {
    bottom: 56px; /* space for nav bar */
  }

  @media (max-width: 768px) {
    .panels-desktop { display: none; }
    .hint { display: none; }
  }
</style>
