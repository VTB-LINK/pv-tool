<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  let { activeTab = $bindable('canvas'), onOpenEditor = () => {} } = $props();

  const tabs = [
    { id: 'canvas', icon: '🖼', label: 'Canvas' },
    { id: 'template', icon: '🎨', label: 'Template' },
    { id: 'controls', icon: '⚙', label: 'Controls' },
    { id: 'export', icon: '📤', label: 'Export' },
  ] as const;
</script>

<nav class="mobile-nav">
  {#each tabs as tab}
    <button
      class="nav-item"
      class:active={activeTab === tab.id}
      onclick={() => {
        if (tab.id === 'template' && activeTab === 'template') {
          onOpenEditor();
        } else {
          activeTab = tab.id;
        }
      }}
    >
      <span class="nav-icon">{tab.icon}</span>
      <span class="nav-label">{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .mobile-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    display: flex;
    height: 56px;
    background: var(--pv-bg-surface);
    backdrop-filter: blur(20px) saturate(1.6);
    border-top: 1px solid var(--pv-border);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: none;
    background: none;
    color: var(--pv-text-muted);
    font-size: 0.6rem;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.15s, transform 0.1s;
  }

  .nav-item:active {
    transform: scale(0.92);
  }

  .nav-item.active {
    color: var(--pv-accent);
  }

  .nav-icon {
    font-size: 1.2rem;
    line-height: 1;
  }

  .nav-label {
    font-weight: 500;
    letter-spacing: 0.3px;
  }
</style>
