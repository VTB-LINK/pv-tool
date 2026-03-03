import type { LayerType } from './types';

export interface EffectPreset {
  type: string;
  label: string;
  layer: LayerType;
  config: Record<string, any>;
}

export const effectCatalog: EffectPreset[] = [
  // --- 背景 Background ---
  { type: 'textureBackground', label: '纹理背景 Texture BG', layer: 'background', config: { pattern: 'dots' } },
  { type: 'gradientOverlay', label: '渐变蒙版 Gradient', layer: 'background', config: { colorTop: '#003838', colorBottom: '#001020', alpha: 0.5 } },

  // --- 装饰 Decoration ---
  { type: 'concentricCircles', label: '同心圆 Circles', layer: 'decoration', config: { color: '$secondary', count: 5 } },
  { type: 'diamondShapes', label: '菱形 Diamonds', layer: 'decoration', config: { color: '$secondary' } },
  { type: 'flowingLines', label: '流动线条 Lines', layer: 'decoration', config: { color: '$secondary', count: 20 } },
  { type: 'crossPattern', label: '十字图案 Cross', layer: 'decoration', config: { color: '$secondary' } },
  { type: 'scatteredShapes', label: '散布形状 Shapes', layer: 'decoration', config: { color: '$secondary' } },
  { type: 'halftoneBlocks', label: '半调色块 Halftone', layer: 'decoration', config: { color: '$accent' } },
  { type: 'diagonalFill', label: '斜线填充 Diagonal', layer: 'decoration', config: { color: '$secondary' } },
  { type: 'diagonalHatch', label: '斜线网格 Hatch', layer: 'decoration', config: { color: '$secondary', alpha: 0.3 } },
  { type: 'parallelogramStripes', label: '平行四边形 Stripes', layer: 'decoration', config: {} },
  { type: 'diagonalSplit', label: '对角分割 Split', layer: 'decoration', config: { color: '$accent', alpha: 1, rotSpeed: 0.25 } },
  { type: 'shadowShapes', label: '阴影形状 Shadow', layer: 'decoration', config: { color: '#ffffff', shadowColor: '#000055' } },
  { type: 'centeredSquares', label: '居中方块 Squares', layer: 'decoration', config: {} },
  { type: 'screenBorder', label: '屏幕边框 Border', layer: 'decoration', config: { color: '$primary' } },
  { type: 'dashedGuideLines', label: '虚线参考 Dashed', layer: 'decoration', config: { color: '$accent' } },
  { type: 'fallingText', label: '文字雨 Falling', layer: 'decoration', config: { color: '$accent', count: 30 } },
  { type: 'glowRing', label: '光圈 GlowRing', layer: 'decoration', config: { colorInner: '#4444ff', colorOuter: '#cc22aa' } },
  { type: 'targetGuide', label: '瞄准线 Target', layer: 'decoration', config: { color: '#6666cc' } },
  { type: 'lightSpot', label: '亮光 LightSpot', layer: 'overlay', config: { color: '#ffffff', x: 0.5, y: 0.1, alpha: 0.45 } },

  // --- 文字 Text ---
  { type: 'heroText', label: '主标题 Hero', layer: 'text', config: { color: '$text' } },
  { type: 'scatteredText', label: '散布文字 Scattered', layer: 'text', config: { color: '$secondary' } },
  { type: 'textStrip', label: '文字条 Strip', layer: 'text', config: { color: '$text', bgColor: '$accent' } },
  { type: 'textCards', label: '文字卡片 Cards', layer: 'text', config: { color: '$text' } },
  { type: 'bigOutlineText', label: '大字描边 BigText', layer: 'text', config: { color: '#e0e0e0', strokeColor: '#ffffff' } },
  { type: 'layeredText', label: '叠层文字 Layered', layer: 'text', config: { color: '$text' } },

  // --- 叠加 Overlay ---
  { type: 'colorMask', label: '颜色蒙版 Mask', layer: 'overlay', config: { color: '$accent', alpha: 0.3 } },
  { type: 'chromaticAberration', label: '色差 Chromatic', layer: 'overlay', config: { offset: 3 } },
  { type: 'glitchBars', label: '故障条 Glitch', layer: 'overlay', config: { color: '$accent' } },
  { type: 'vignette', label: '暗角 Vignette', layer: 'overlay', config: { color: '#000000', alpha: 0.6 } },
  { type: 'scanlines', label: '扫描线 Scanlines', layer: 'overlay', config: { color: '#003333', alpha: 0.12, spacing: 4 } },

  // --- 结构 Structure ---
  { type: 'triangleGrid', label: '三角网格 TriGrid', layer: 'background', config: { color: '$secondary', alpha: 0.2, cols: 10 } },
  { type: 'burstLines', label: '放射线 Burst', layer: 'decoration', config: { color: '$secondary', alpha: 0.2, rayCount: 24 } },
  { type: 'diagonalStructure', label: '对角线结构 DiagStruct', layer: 'decoration', config: { color: '#f0f0f0', alpha: 0.3, step: 100 } },
  { type: 'backgroundBlocks', label: '背景色块 Blocks', layer: 'background', config: { count: 7, alpha: 0.5 } },
  { type: 'balancingCircles', label: '平衡圆 Circles', layer: 'decoration', config: { count: 5, blueColor: '#0028B4' } },
  { type: 'formulaText', label: '公式文字 Formula', layer: 'text', config: { color: '$text', count: 18 } },

  // --- HUD 元素 ---
  { type: 'hudCorners', label: 'HUD角框 Corners', layer: 'decoration', config: { color: '$primary', margin: 20, armLength: 40 } },
  { type: 'hudStatusText', label: 'HUD状态 Status', layer: 'text', config: { textColor: '$text', alertColor: '$accent' } },
  { type: 'hudInfoPanel', label: 'HUD信息卡 Panel', layer: 'overlay', config: { primaryColor: '$primary', alertColor: '$accent' } },

  // --- 标尺/方块 Ruler/Blocks ---
  { type: 'rulerGuide', label: '标尺 Ruler', layer: 'decoration', config: { color: '#ffffff', alpha: 0.5 } },
  { type: 'breathingBlocks', label: '呼吸方块 Blocks', layer: 'background', config: { count: 8 } },

  // --- 特效文字 Special Text ---
  { type: 'glowTextCards', label: '发光卡片字 GlowCards', layer: 'text', config: { cardColor: '#ffffff', textColor: '#1a1a1a', fontSize: 68 } },
  { type: 'verticalSubText', label: '竖排副文字 VertSub', layer: 'text', config: { color: '#ffffff', fontSize: 13 } },
  { type: 'radialRectangles', label: '放射矩形 RadialRect', layer: 'decoration', config: { count: 14, baseColor: '#1133aa', edgeColor: '#cccc00' } },

  // --- 纹理 Texture ---
  { type: 'filmGrain', label: '胶片噪点 Grain', layer: 'overlay', config: { alpha: 0.08, mono: true, updateInterval: 3 } },
  { type: 'dotScreen', label: '网点纹理 Dots', layer: 'overlay', config: { spacing: 8, dotRadius: 1.5, color: '$text', alpha: 0.12, angle: 15 } },
  { type: 'checkerboard', label: '棋盘格 Checker', layer: 'background', config: { cellSize: 40, color1: '#000000', color2: '#ffffff', alpha: 0.08 } },

  // --- 透视/构成 Perspective & Composition ---
  { type: 'perspectiveGrid', label: '透视网格 PerspGrid', layer: 'decoration', config: { color: '$primary', alpha: 0.3, mode: 'floor', scrollSpeed: 0.5 } },
  { type: 'compositionGuides', label: '构成线 CompGuide', layer: 'decoration', config: { color: '$text', alpha: 0.2, guides: ['goldenSpiral'] } },

  // --- 有机形态 Organic ---
  { type: 'organicBlob', label: '有机Blob Blob', layer: 'decoration', config: { shape: 'blob', color: '$primary', alpha: 0.25, count: 3 } },
  { type: 'organicBlob', label: '海浪 Wave', layer: 'decoration', config: { shape: 'wave', color: '$primary', alpha: 0.3, layers: 4, amplitude: 40, waveY: 0.6 } },
  { type: 'organicBlob', label: '云团 Cloud', layer: 'decoration', config: { shape: 'cloud', color: '$secondary', alpha: 0.2, count: 3 } },

  // --- 动态检测 Motion Detection ---
  { type: 'motionBrackets', label: '运动框 Motion', layer: 'overlay', config: { color: '#00ffcc', alpha: 0.8, style: 'high' } },
];
