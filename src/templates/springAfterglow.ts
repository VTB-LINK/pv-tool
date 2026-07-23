// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.
// Template — Spring Afterglow (春日残照)
// A hazy, dusk-toned kinetic style: soft periwinkle blocks and halftone under
// scattered crayon doodles, with the lyric line shattering and reassembling.

import type { TemplateConfig } from '../types/engine';

export const springAfterglowTemplate: TemplateConfig = {
  name: 'Spring Afterglow',
  nameKey: 'tpl_springAfterglow',
  palette: {
    background: '#b3c7d6', // hazy periwinkle dusk
    primary: '#5e3f5c',    // muted plum
    secondary: '#82a9c4',  // soft steel blue
    accent: '#d98a86',     // dusty rose afterglow
    text: '#4a3a50',       // deep mauve
  },
  bpm: 92,
  animationSpeed: 0.85,
  beatReactivity: 0.5,
  effects: [
    {
      type: 'backgroundBlocks',
      layer: 'background',
      config: { count: 6, alpha: 0.32 },
    },
    {
      type: 'halftoneBlocks',
      layer: 'background',
      config: { color: '$primary', alpha: 0.13, size: 3, spacing: 7 },
    },
    {
      type: 'crayonScrawl',
      layer: 'decoration',
      config: {
        shapeCount: 8,
        seed: 2035,
        roleMode: 'primaryAccent',
        strokeWidth: 4,
        wobble: 0.07,
        opacity: 0.82,
        halo: true,
        haloOpacity: 0.35,
        boilInterval: 0.13,
        spin: 0.06,
        pulse: 0.05,
        sizeMin: 0.06,
        sizeMax: 0.16,
      },
    },
    {
      type: 'shardText',
      layer: 'text',
      config: {
        shardColor: '$primary',
        maxFontSize: 88,
        shardWeight: '800',
        fitWidthFrac: 0.82,
        posYFrac: 0.5,
        assembleDuration: 1.2,
        scatterRadiusFrac: 0.4,
        maxSpin: 1.2,
        enableFloat: true,
        floatAmount: 7,
      },
    },
    {
      type: 'scanlines',
      layer: 'overlay',
      config: { color: '$text', alpha: 0.08, spacing: 3 },
    },
  ],
};
