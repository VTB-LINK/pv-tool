<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { PVEngine } from '../../engine/PVEngine';
  import { resolveTemplateWithOptions, hydratePreviewEngine } from '../../stores/engine.svelte';
  import type { MissingMode } from '../../stores/engine.svelte';
  import type { TemplateConfig } from '../../types/engine';
  import { t } from '../../i18n';

  let {
    incomingConfig = null as TemplateConfig | null,
    missingMode = 'reset' as MissingMode,
    collapsed = false,
    onToggleCollapse = () => {},
  }: {
    incomingConfig?: TemplateConfig | null;
    missingMode?: MissingMode;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
  } = $props();

  let containerEl: HTMLDivElement | undefined = $state(undefined);
  let previewEngine: PVEngine | null = $state(null);
  let ready = $state(false);
  let error = $state(false);

  // Track the last hydrated config to avoid redundant re-hydrations
  let lastHydratedKey = '';

  onMount(() => {
    return () => {
      // Cleanup on unmount
      destroyPreview();
    };
  });

  function destroyPreview() {
    if (previewEngine) {
      try {
        previewEngine.destroy();
      } catch {
        // Ignore destroy errors
      }
      previewEngine = null;
    }
    ready = false;
    lastHydratedKey = '';
  }

  async function initPreview() {
    if (!containerEl || !incomingConfig) return;

    // Destroy any existing preview engine first
    destroyPreview();

    // Yield to next frame so the dialog and skeleton can render first
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Re-check state after yield (user may have collapsed or closed the dialog)
    if (!containerEl || !incomingConfig || collapsed) return;

    try {
      const eng = new PVEngine();
      
      // Initialize with explicit resolution to avoid container-based scaling artifacts
      await eng.init(containerEl, { fixedWidth: 1920, fixedHeight: 1080 });
      previewEngine = eng;

      // Resolve and hydrate
      const resolved = resolveTemplateWithOptions(incomingConfig, { missingMode });
      hydratePreviewEngine(eng, resolved);
      lastHydratedKey = buildHydrateKey(incomingConfig, missingMode);

      ready = true;
      error = false;
    } catch (e) {
      console.error('[TemplateLivePreview] init failed:', e);
      error = true;
      destroyPreview();
    }
  }

  function buildHydrateKey(tpl: TemplateConfig, mode: MissingMode): string {
    return `${tpl.name ?? ''}:${mode}:${JSON.stringify(tpl.palette)}`;
  }

  // Re-hydrate when missingMode changes (without re-creating the engine)
  $effect(() => {
    if (!previewEngine || !incomingConfig || !ready) return;
    const key = buildHydrateKey(incomingConfig, missingMode);
    if (key === lastHydratedKey) return;

    try {
      const resolved = resolveTemplateWithOptions(incomingConfig, { missingMode });
      hydratePreviewEngine(previewEngine, resolved);
      lastHydratedKey = key;
    } catch (e) {
      console.error('[TemplateLivePreview] re-hydrate failed:', e);
    }
  });

  // Init when container becomes available and we have config
  $effect(() => {
    if (containerEl && incomingConfig && !previewEngine && !collapsed) {
      initPreview();
    }
  });

  // When collapsed state changes, init or destroy
  $effect(() => {
    if (collapsed) {
      destroyPreview();
    } else if (containerEl && incomingConfig && !previewEngine) {
      initPreview();
    }
  });
</script>

<div class="diff-preview-wrapper">
  <button
    class="diff-preview-toggle"
    type="button"
    onclick={() => onToggleCollapse()}
    aria-expanded={!collapsed}
  >
    <svg class="diff-preview-chevron" class:diff-preview-chevron-collapsed={collapsed} viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
      <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="diff-preview-toggle-label">{t('diff_preview')}</span>
  </button>

  {#if !collapsed}
<div class="diff-preview-canvas-wrap">
  {#if !ready && !error}
    <div class="diff-preview-skeleton">
      <span class="diff-preview-loading">{t('diff_preview_loading')}</span>
    </div>
  {/if}
  <div 
    class="diff-preview-canvas" 
    class:is-ready={ready}
    bind:this={containerEl}
  ></div>
  {#if error}
    <div class="diff-preview-error">{t('diff_preview_unavailable')}</div>
  {/if}
</div>
  {/if}
</div>

<style>
  .diff-preview-wrapper {
    flex-shrink: 0;
    border-bottom: 1px solid var(--pv-border);
    margin-bottom: 8px;
  }

  .diff-preview-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 0;
    border: none;
    background: transparent;
    color: var(--pv-text-muted);
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    cursor: pointer;
    text-align: left;
  }

  .diff-preview-toggle:hover {
    color: var(--pv-text);
  }

  .diff-preview-chevron {
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  .diff-preview-chevron-collapsed {
    transform: rotate(-90deg);
  }

  .diff-preview-toggle-label {
    flex: 1;
  }

  .diff-preview-canvas-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--pv-radius-sm);
    overflow: hidden;
    background: rgba(30, 30, 35, 0.6);
    backdrop-filter: blur(4px);
    margin-bottom: 8px;
  }

  .diff-preview-canvas {
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }

  .diff-preview-canvas.is-ready {
    opacity: 1;
  }

  .diff-preview-canvas :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  .diff-preview-skeleton {
    position: absolute;
    inset: 0;
    background: rgba(40, 44, 52, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    z-index: 1;
  }

  .diff-preview-loading {
    font-size: 0.75rem;
    color: var(--pv-text-muted);
    animation: fadeInOut 1.5s infinite;
  }

  @keyframes fadeInOut {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .diff-preview-error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    color: var(--pv-text-muted);
    background: rgba(0, 0, 0, 0.6);
  }
</style>
