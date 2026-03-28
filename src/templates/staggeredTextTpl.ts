// Modified by VTB-LIVE on 2026-03-24
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import type { TemplateConfig } from '../types/engine';

export const staggeredTextTplTemplate: TemplateConfig = {
  name: '错落文字',
  nameKey: 'tpl_staggeredText',
  animationSpeed: 3.4,
  palette: {
    background: '#1a2a6c',
    primary: '#ffffff',
    secondary: '#8899cc',
    accent: '#4466dd',
    text: '#ffffff',
  },
  effects: [
    // Staggered text — the core effect cycling through 5 layout modes
    { type: 'staggeredText', layer: 'text', config: {
      color: '#ffffff', fontSize: 68, modeDuration: 3.5,
      transition: 0.5, colChars: 5,
      fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
      frameColor: '#ffffff', frameAlpha: 0.5, framePadding: 35,
    }},

    // Subtle chromatic aberration — blue-toned shift
    { type: 'chromaticAberration', layer: 'overlay', config: {
      amount: 3, angle: 0.1,
    }},

    // Light vignette
    { type: 'vignette', layer: 'overlay', config: {
      color: '#0a1440', alpha: 0.4,
    }},
  ],
};
