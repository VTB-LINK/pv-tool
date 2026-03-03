import type { TemplateConfig } from '../core/types';

export const rainCityTemplate: TemplateConfig = {
  name: '城市、文字、雨',
  palette: {
    background: '#0a0a12',
    primary: '#00ccaa',
    secondary: '#006688',
    accent: '#ee3344',
    text: '#ee3344',
  },
  effects: [
    {
      type: 'gradientOverlay',
      layer: 'background',
      config: {
        colorTop: '#003838',
        colorMid: '#004848',
        colorBottom: '#001020',
        alpha: 0.5,
        mode: 'linear',
      },
    },
    {
      type: 'fallingText',
      layer: 'decoration',
      config: {
        color: '$accent',
        count: 35,
        minSize: 24,
        maxSize: 68,
        fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
      },
    },
    {
      type: 'chromaticAberration',
      layer: 'overlay',
      config: {
        offset: 4,
        flickerSpeed: 1.5,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: {
        color: '#000000',
        alpha: 0.7,
        radius: 0.6,
      },
    },
  ],
};
