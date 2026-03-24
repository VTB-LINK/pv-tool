<!-- VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE -->
<!-- Licensed under AGPL-3.0. -->
<script lang="ts">
  // CanvasView — just a transparent container, actual PixiJS canvas
  // is appended to the parent by the engine init
</script>

<div class="canvas-view"></div>

<style>
  .canvas-view {
    width: 100%;
    height: 100%;
  }

  .canvas-view :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
