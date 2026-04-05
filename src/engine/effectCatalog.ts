// Modified by VTB-LIVE on 2026-03-24
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import type { EffectEntry, LayerType } from '../types/engine';
import { t, type LocaleKey } from '../i18n';
import { v2Registry, v2Metas } from '../effects/v2/registry';
import { buildDefaultConfig, resolveLocalized } from '../effects/v2/schema';

export interface EffectPreset {
  type: string;
  label: string;
  category: string;
  layer: LayerType;
  config: Record<string, any>;
}

export type EffectDescriptor = {
  type: string;
  config?: Record<string, any>;
  label?: string;
};

const V1_EDITOR_DEFAULT_CONFIGS: Partial<Record<string, Record<string, any>>> = {
  heroText: {
    color: '$text',
    fontSize: 120,
    fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
    fontWeight: 'bold',
    letterSpacing: 8,
    rotation: 0,
    x: 0.5,
    y: 0.5,
    animation: 'breathe',
    animationSpeed: 0.5,
    animationAmount: 0.03,
    rotationSpeed: 0.1,
  },
  vignette: {
    color: '#000000',
    alpha: 0.5,
    intensity: 0.6,
    radius: 0.7,
  },
  scatteredShapes: {
    color: '$primary',
    count: 12,
    alpha: 0.5,
    minSize: 10,
    maxSize: 40,
    shapes: ['square', 'diamond'],
  },
  shadowShapes: {
    color: '#ffffff',
    shadowColor: '#000055',
    shadowAlpha: 0.5,
    shadowOffX: 12,
    shadowOffY: 14,
  },
  glitchBars: {
    color: '$primary',
    spawnRate: 0.15,
    maxBars: 8,
    alpha: 0.9,
    minHeight: 2,
    maxHeight: 12,
  },
  chromaticAberration: {
    amount: 4,
    angle: 0.2,
    offset: 3,
    flickerSpeed: 4,
  },
  flowingLines: {
    color: '$secondary',
    count: 3,
    alpha: 0.5,
    strokeWidth: 1.5,
    amplitude: 80,
    frequency: 0.005,
    speed: 0.5,
  },
  scatteredText: {
    color: '$secondary',
    fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
    count: 15,
    minSize: 20,
    maxSize: 60,
    chars: 'つもにはでをがのへとかられ',
  },
  diagonalHatch: {
    color: '$accent',
    spacing: 8,
    lineWidth: 0.8,
    alpha: 0.15,
  },
  motionBrackets: {
    color: '#00ffcc',
    alpha: 0.8,
    lineWidth: 2,
    style: 'high',
    showConnections: false,
    showTrails: false,
    showNodes: false,
    connColor: '#888888',
    trailColor: '#E66432',
    nodeColor: '#E66432',
    connMaxDist: 350,
  },
  screenBorder: {
    color: '$primary',
    lineWidth: 1.5,
    alpha: 0.6,
    margin: 20,
    gap: 6,
    starSize: 5,
    edgeStarCount: 5,
    edgeStarCountV: 3,
  },
  textureBackground: {
    intensity: 0.15,
    driftSpeed: 0.5,
  },
  glowTextCards: {
    cardColor: '#ffffff',
    textColor: '#1a1a1a',
    glowColor: '#ffffff',
    glowAlpha: 0.6,
    fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
    fontSize: 70,
    charsPerRow: 5,
    sizeVariance: 0.3,
    staggerX: 12,
    staggerY: 8,
    cardPadding: 18,
    x: 0.5,
    y: 0.5,
    staggerDelay: 0.06,
  },
  diamondShapes: {
    color: '$primary',
    count: 3,
    maxSize: 300,
    strokeWidth: 2,
    alpha: 0.7,
    x: 0.5,
    y: 0.5,
    animationSpeed: 0.08,
  },
  diagonalFill: {
    color: '$accent',
    shape: 'bowtie',
    lineSpacing: 6,
    lineWidth: 1.5,
    alpha: 0.85,
    size: 300,
    lineColor: '$background',
    rectWidth: 450,
    rectHeight: 300,
    x: 0.5,
    y: 0.5,
    animationSpeed: 0.05,
  },
  burstLines: {
    color: '$secondary',
    alpha: 0.25,
    rayCount: 24,
    innerRadius: 0.08,
    outerRadius: 0.7,
    rotSpeed: 0.05,
    lineWidth: 1,
    x: 0.5,
    y: 0.5,
  },
  formulaText: {
    color: '$text',
    fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
    count: 18,
    alpha: 0.4,
    formulaRatio: 0.65,
  },
  verticalSubText: {
    color: '#ffffff',
    fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
    fontSize: 14,
    x: 0.62,
    y: 0.35,
    charsPerCol: 5,
  },
  lightSpot: {
    color: '#ffffff',
    alpha: 0.45,
    x: 0.5,
    y: 0.1,
    radius: 0.4,
    size: 0.5,
  },
  gradientOverlay: {
    colorTop: '#004040',
    colorMid: '#004040',
    colorBottom: '#001a2e',
    alpha: 0.55,
    mode: 'linear',
  },
  scanlines: {
    color: '#003333',
    alpha: 0.15,
    spacing: 4,
  },
  dotScreen: {
    spacing: 8,
    dotRadius: 1.5,
    color: '$text',
    alpha: 0.12,
    angle: 15,
  },
  diagonalSplit: {
    color: '$accent',
    alpha: 1,
    rotSpeed: 0.15,
    baseHalfAngle: 0.6,
    angleVariation: 0.3,
    initRotation: -Math.PI / 2,
    hatchSpacing: 6,
    centerSize: 12,
    centerColor: '$primary',
  },
  centeredSquares: {
    outerSize: 300,
    midSize: 220,
    innerSize: 160,
    borderColor: '$primary',
    midColor: '$primary',
    innerColor: '$secondary',
    fontSize: 52,
    charSpreadFrac: 0.5,
    staggerY: 18,
  },
  webLines: {
    count: 22,
    color: '#ff2222',
    glowColor: '#ff4444',
    focalX: 0.5,
    focalY: 0.45,
    spread: 0.25,
    rebuildChance: 0.008,
  },
  edgeClouds: {
    color: '#ffffff',
    alpha: 1,
    cloudCount: 5,
    baseRadius: 100,
    minCircles: 6,
    maxCircles: 10,
    shadowOffsetX: 4,
    shadowOffsetY: 4,
    shadowAlpha: 0.5,
    shadowColor: '#ead9ecff',
    animSpeed: 0.3,
    seed: 42,
  },
  radialRectangles: {
    count: 12,
    baseColor: '#1133aa',
    edgeColor: '#cccc00',
    edgeBlur: 6,
    x: 0.5,
    y: 0.5,
    rotSpeed: 0.08,
    growSpeed: 0.03,
  },
  perspectiveGrid: {
    color: '$primary',
    alpha: 0.3,
    lineWidth: 1,
    mode: 'floor',
    scrollSpeed: 0.5,
    vpX: 0.5,
    vpY: 0.45,
    vLines: 20,
    hLines: 15,
    rayCount: 24,
    rings: 6,
  },
  compositionGuides: {
    color: '$text',
    alpha: 0.2,
    lineWidth: 1,
    guides: ['goldenSpiral'],
    spiralQuadrant: 0,
    rotSpeed: 0,
  },
  backgroundBlocks: {
    count: 7,
    alpha: 0.5,
  },
  balancingCircles: {
    count: 5,
    blueColor: '#0028B4',
    whiteColor: '#ffffff',
    glowAlpha: 0.4,
  },
  bigOutlineText: {
    color: '#e0e0e0',
    strokeColor: '#ffffff',
    fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
    fontSize: 0,
    staggerDelay: 0.15,
    spacingFrac: 1.3,
  },
  bloodSplatter: {
    count: 4,
    color: '#8b0000',
    alpha: 0.92,
    size: 1.0,
    seed: 42,
  },
  breathingBlocks: {
    count: 8,
    minSize: 0.15,
    maxSize: 0.55,
    minBrightness: 180,
    maxBrightness: 255,
  },
  checkerboard: {
    cellSize: 40,
    color1: '#000000',
    color2: '#ffffff',
    alpha: 0.08,
  },
  colorMask: {
    color: '$accent',
    alpha: 0.3,
  },
  concentricCircles: {
    count: 4,
    maxRadius: 250,
    strokeWidth: 1.5,
    color: '$primary',
    alpha: 0.6,
    x: 0.5,
    y: 0.5,
    animation: 'rotate',
    animationSpeed: 0.15,
  },
  crossPattern: {
    spacing: 40,
    size: 4,
    color: '$accent',
    alpha: 0.4,
    driftSpeed: 0.2,
  },
  crimeTape: {
    count: 5,
    text: 'POLICE LINE DO NOT CROSS',
    tapeColor: '#f5c800',
    textColor: '#000000',
    tapeWidth: 52,
    speed: 80,
    angleRange: 0.18,
  },
  cuteOutlineText: {
    fontSize: 80,
    fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
    fillColor: '#fab2b5',
    strokeColor: '#ffffff',
    strokeWidth: 8,
    fontWeight: '900',
    letterSpacing: 4,
    x: 0.5,
    y: 0.5,
    animationSpeed: 0.5,
    animationAmount: 0.02,
  },
  dashedGuideLines: {
    color: '#cc0000',
    dashLength: 12,
    gapLength: 8,
    lineWidth: 2,
    alpha: 0.8,
    x: 0.5,
    y: 0.5,
    width: 0.4,
    height: 0.55,
    extend: 60,
    crossSize: 12,
  },
  dataMonitors: {
    count: 4,
    borderColor: '#ffffff',
    fillColor: '#000000',
    dataColor: '#ffffff',
    alpha: 0.7,
  },
  desktopIcon: {
    x: 60,
    y: 60,
    size: 64,
    iconType: 'paint',
    fontFamily: 'Courier New, monospace',
    labelColor: '$text',
    label: 'Icon',
  },
  diagonalStructure: {
    color: '#f0f0f0',
    alpha: 0.3,
    step: 100,
  },
  fallingText: {
    count: 30,
    color: '$accent',
    fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
    minSize: 28,
    maxSize: 72,
    chars: '夜を越えて踊れ',
  },
  filmGrain: {
    alpha: 0.08,
    mono: true,
    updateInterval: 3,
  },
  halftoneBlocks: {
    count: 8,
    color: '$primary',
    blockSize: 60,
    dotSpacing: 6,
    dotRadius: 1.5,
    alpha: 0.5,
  },
  heartVoice: {
    fontSize: 80,
    style2Scale: 1.4,
    style1Color: '#000000',
    style2Color: '#ffffff',
    blur: 4,
    staggerDelay: 0.3,
  },
  hudCorners: {
    color: '$primary',
    alpha: 0.9,
    margin: 20,
    armLength: 40,
    lineWidth: 2,
  },
  hudInfoPanel: {
    panelWidth: 240,
    panelHeight: 420,
    primaryColor: '$primary',
    alertColor: '$accent',
    textColor: '$text',
    gridColor: '#323200',
    fontFamily: '"Courier New", monospace',
  },
  hudStatusText: {
    textColor: '$text',
    alertColor: '$accent',
    fontFamily: '"Courier New", monospace',
    centerText: 'SYS.MONITOR // ONLINE',
    rightText: 'NETWATCH // PROTOCOL V.2.0.77',
    fontSize: 13,
  },
  jigsawGrid: {
    seed: 914,
    cols: 8,
    rows: 5,
    color: '$line',
    alpha: 0.5,
    lineWidth: 2,
    tabScale: 0.2,
  },
  layeredText: {
    maxLayers: 4,
    color: '$primary',
    fontSize: 80,
  },
  noiseText: {
    count: 12,
    color: '#ffffff',
    bgColor: '#000000',
  },
  organicBlob: {
    shape: 'blob',
    color: '$primary',
    alpha: 0.25,
    filled: true,
    lineWidth: 2,
    count: 3,
    points: 80,
    noiseScale: 3,
    noiseAmp: 0.35,
    scale: 1,
    layers: 4,
    waveY: 0.6,
    amplitude: 40,
    foamColor: '#ffffff',
  },
  paperTear: {
    seed: 42,
    edgeColor: '#000000',
    borderWidth: 7,
    animate: true,
  },
  parallelogramStripes: {
    skewAngle: 20,
    alpha: 0.92,
    dotSpacing: 10,
    dotRadius: 3,
    cellSize: 8,
    moveSpeed: 0.3,
  },
  pinkGrid: {
    cellSize: 50,
    color: '#f8c7ca',
    lineColor: '#ffffff',
    lineWidth: 2,
    alpha: 1.0,
    speed: 30,
  },
  pinkStripes: {
    stripeWidth: 150,
    speed: 0.5,
    angle: -45,
    pinkColor: '#fbbdbe',
    alpha: 1.0,
  },
  pixelBackground: {
    pinkCount: 6,
    yellowCount: 8,
    checkerCellSize: 40,
    checkerAlpha: 0.3,
    dotSize: 4,
    dotSpacing: 12,
    dotAlpha: 0.15,
    pinkAlpha: 0.5,
    yellowAlpha: 0.6,
    checkerColor1: '#ffffff',
    checkerColor2: '#fef5f8',
    dotColor: '#ffb3d9',
    pinkColor: '#ffb3d9',
    yellowColor: '#fff9b3',
  },
  pixelTypewriter: {
    fontSize: 64,
    strokeWidth: 6,
    pixelSize: 1,
    letterSpacing: 3,
    shadowBlur: 0,
    shadowOffsetX: 3,
    shadowOffsetY: 3,
    y: 0.5,
    charDelay: 0.08,
    cursorBlinkSpeed: 0.5,
    leftX: 0.25,
    rightX: 0.75,
    maxCharsPerSide: 10,
    cursorWidth: 4,
    fontFamily: '"Courier New", monospace',
    fillColor: '$text',
    strokeColor: '#ffffff',
    shadowColor: '$primary',
    cursorColor: '$primary',
  },
  pixelWindow: {
    x: 0.5,
    y: 0.5,
    width: 280,
    height: 200,
    borderWidth: 4,
    titleBarHeight: 28,
    alpha: 0.95,
    anchorX: 0.5,
    anchorY: 0.5,
    fontSize: 14,
    iconSize: 60,
    bgColor: '#ffffff',
    borderColor: '$primary',
    titleBgColor: '$primary',
    fontFamily: '"Courier New", monospace',
    titleColor: '#ffffff',
  },
  planet: {
    x: 0.5,
    y: 0.5,
    radius: 120,
    coreRadius: 12,
    tickLen: 5,
    lineExtend: 1.8,
    arcAlpha: 0.08,
    infFontSize: 18,
    color: '#ffffff',
  },
  pulsingCircle: {
    strokeColor: '#ffffff',
    outerStrokeColor: '#ecbfc0',
    strokeAlpha: 0.8,
    strokeWidth: 8,
    radius: 250,
    x: 0.5,
    y: 0.5,
    outerStrokeWidth: 3,
    outerStrokeAlpha: 0.6,
    animSpeed: 0.2,
    strokePulseAmount: 0.5,
    radiusPulseAmount: 0.08,
    enableBeatReact: false,
  },
  rulerGuide: {
    color: '#ffffff',
    alpha: 0.5,
    x: 0.12,
    y: 0.75,
    hLength: 0.85,
    vLength: 0.65,
    lineWidth: 1,
    tickSpacing: 12,
    majorEvery: 5,
    minorTickLen: 6,
    majorTickLen: 14,
    circleRadius: 8,
  },
  scalloppedBorder: {
    color: '#ffffff',
    shadowColor: '#f8c7ca',
    alpha: 1.0,
    shadowAlpha: 0.6,
    shadowOffsetX: 0,
    shadowOffsetY: 8,
    circleRadius: 80,
    topY: 0,
    animSpeed: 0.2,
    moveAmount: 15,
  },
  smearBrush: {
    grainAlpha: 0.04,
    count: 8,
  },
  staggeredText: {
    color: '#ffffff',
    fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
    frameColor: '#ffffff',
    fontSize: 64,
    colChars: 5,
    modeDuration: 3,
    transition: 0.4,
    frameAlpha: 0.6,
    framePadding: 30,
  },
  starTrail: {
    count: 20,
    strokeWidth: 3,
    radiusX: 600,
    radiusY: 400,
    maxSize: 260,
    minSize: 35,
    loopSpeed: 0.12,
    tilt: -0.25,
    arcCenter: -0.6,
    arcSpan: 4.2,
    curveFrac: 0.45,
  },
  targetGuide: {
    color: '#6666cc',
    alpha: 0.4,
    tickCount: 8,
  },
  textCards: {
    cardColor: '$primary',
    textColor: '$background',
    borderColor: '$accent',
    fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
    fontSize: 80,
    padding: 30,
    spawnInterval: 0.4,
    lifetime: 2.5,
  },
  textStrip: {
    stripColor: '$secondary',
    textColor: '$text',
    stripWidth: 80,
    stripHeight: 600,
    rotation: -30,
    stripAlpha: 0.85,
    fontSize: 60,
  },
  triangleGrid: {
    color: '$secondary',
    fillColor: '#002200',
    alpha: 0.2,
    cols: 10,
    filled: false,
    fillAlpha: 0.08,
  },
};

function cloneEffectConfig<T>(config: T): T {
  if (config === undefined || config === null) return config;
  if (typeof config !== 'object') return config;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(config);
    } catch {
      // Svelte reactive proxies can throw DataCloneError here.
    }
  }
  return JSON.parse(JSON.stringify(config)) as T;
}

function getEffectIdentityKeys(type: string): string[] {
  if (type === 'organicBlob') return ['shape'];
  return [];
}

function isSameConfigValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function translateEffectKey(key: string, fallback: string): string {
  const translated = t(key as LocaleKey);
  return translated === key ? fallback : translated;
}

function getEffectLabelKey(effect: EffectDescriptor): string {
  if (effect.type === 'organicBlob') {
    const shape = typeof effect.config?.shape === 'string' ? effect.config.shape : 'blob';
    return `fx_organicBlob_${shape}`;
  }

  return `fx_${effect.type}`;
}

function findEffectPreset(effect: EffectDescriptor): EffectPreset | undefined {
  return effectCatalog.find((preset) => {
    if (preset.type !== effect.type) return false;
    if (effect.type === 'organicBlob') {
      return preset.config.shape === effect.config?.shape;
    }
    return true;
  });
}

export function getEffectDefaultConfig(effect: EffectDescriptor): Record<string, any> {
  const meta = v2Registry.get(effect.type)?.meta;
  if (meta) {
    return cloneEffectConfig(buildDefaultConfig(meta));
  }

  const preset = findEffectPreset(effect);
  const presetConfig = preset ? cloneEffectConfig(preset.config) : {};
  const editorDefaults = cloneEffectConfig(V1_EDITOR_DEFAULT_CONFIGS[effect.type] ?? {});
  return {
    ...presetConfig,
    ...editorDefaults,
  };
}

export function normalizeEffectConfig(effect: EffectDescriptor): Record<string, any> {
  return {
    ...getEffectDefaultConfig(effect),
    ...cloneEffectConfig(effect.config ?? {}),
  };
}

export function normalizeEffectEntry(entry: EffectEntry): EffectEntry {
  return {
    ...entry,
    visible: entry.visible !== false,
    config: normalizeEffectConfig(entry),
  };
}

export function normalizeEffectEntries(entries: EffectEntry[]): EffectEntry[] {
  return entries.map(normalizeEffectEntry);
}

export function compactEffectConfig(effect: EffectDescriptor): Record<string, any> {
  const normalizedConfig = normalizeEffectConfig(effect);
  const defaultConfig = getEffectDefaultConfig(effect);
  const compacted: Record<string, any> = {};
  const identityKeys = new Set(getEffectIdentityKeys(effect.type));

  for (const [key, value] of Object.entries(normalizedConfig)) {
    if (!identityKeys.has(key) && isSameConfigValue(value, defaultConfig[key])) continue;
    compacted[key] = cloneEffectConfig(value);
  }

  return compacted;
}

export function compactEffectEntry(entry: EffectEntry): EffectEntry {
  const normalized = normalizeEffectEntry(entry);
  return {
    ...normalized,
    config: compactEffectConfig(normalized),
  };
}

export function compactEffectEntries(entries: EffectEntry[]): EffectEntry[] {
  return entries.map(compactEffectEntry);
}

export function getEffectVersion(type: string): 1 | 2 {
  return v2Registry.has(type) ? 2 : 1;
}

export function getEffectDisplayLabel(effect: EffectDescriptor): string {
  const preset = findEffectPreset(effect);
  const fallback = preset?.label ?? effect.label ?? effect.type;
  return translateEffectKey(getEffectLabelKey({ type: effect.type, config: effect.config ?? preset?.config }), fallback);
}

export function getEffectDisplayCategory(preset: EffectPreset): string {
  const key = `ecat_${preset.category}`;
  return translateEffectKey(key, preset.category);
}

export const effectCatalog: EffectPreset[] = [
  // 背景 Background
  { type: 'textureBackground', label: '纹理背景 Texture BG', category: '背景', layer: 'background', config: { pattern: 'dots' } },
  { type: 'gradientOverlay', label: '渐变蒙版 Gradient', category: '背景', layer: 'background', config: { colorTop: '#003838', colorBottom: '#001020', alpha: 0.5 } },
  { type: 'triangleGrid', label: '三角网格 TriGrid', category: '背景', layer: 'background', config: { color: '$secondary', alpha: 0.2, cols: 10 } },
  { type: 'backgroundBlocks', label: '背景色块 Blocks', category: '背景', layer: 'background', config: { count: 7, alpha: 0.5 } },
  { type: 'breathingBlocks', label: '呼吸方块 Blocks', category: '背景', layer: 'background', config: { count: 8 } },
  { type: 'checkerboard', label: '棋盘格 Checker', category: '背景', layer: 'background', config: { cellSize: 40, color1: '#000000', color2: '#ffffff', alpha: 0.08 } },

  // 几何装饰 Geometry
  { type: 'concentricCircles', label: '同心圆 Circles', category: '几何装饰', layer: 'decoration', config: { color: '$secondary', count: 5, maxRadius: 500, x: 0.5, y: 0.5, strokeWidth: 1, alpha: 0.4, animation: 'none' } },
  { type: 'diamondShapes', label: '菱形 Diamonds', category: '几何装饰', layer: 'decoration', config: { color: '$secondary' } },
  { type: 'crossPattern', label: '十字图案 Cross', category: '几何装饰', layer: 'decoration', config: { color: '$secondary' } },
  { type: 'scatteredShapes', label: '散布形状 Shapes', category: '几何装饰', layer: 'decoration', config: { color: '$secondary' } },
  { type: 'halftoneBlocks', label: '半调色块 Halftone', category: '几何装饰', layer: 'decoration', config: { color: '$accent' } },
  { type: 'shadowShapes', label: '阴影形状 Shadow', category: '几何装饰', layer: 'decoration', config: { color: '#ffffff', shadowColor: '#000055' } },
  { type: 'centeredSquares', label: '居中方块 Squares', category: '几何装饰', layer: 'decoration', config: {} },
  { type: 'balancingCircles', label: '平衡圆 Circles', category: '几何装饰', layer: 'decoration', config: { count: 5, blueColor: '#0028B4' } },
  { type: 'radialRectangles', label: '放射矩形 RadialRect', category: '几何装饰', layer: 'decoration', config: { count: 14, baseColor: '#1133aa', edgeColor: '#cccc00' } },
  { type: 'starTrail', label: '星轨 StarTrail', category: '几何装饰', layer: 'decoration', config: { count: 20 } },
  { type: 'planet', label: '行星 Planet', category: '几何装饰', layer: 'decoration', config: { color: '#ffffff', radius: 120, coreRadius: 12 } },

  // 线条结构 Lines
  { type: 'flowingLines', label: '流动线条 Lines', category: '线条结构', layer: 'decoration', config: { color: '$secondary', count: 20 } },
  { type: 'diagonalFill', label: '斜线填充 Diagonal', category: '线条结构', layer: 'decoration', config: { color: '$secondary' } },
  { type: 'diagonalHatch', label: '斜线网格 Hatch', category: '线条结构', layer: 'decoration', config: { color: '$secondary', alpha: 0.3 } },
  { type: 'parallelogramStripes', label: '平行四边形 Stripes', category: '线条结构', layer: 'decoration', config: {} },
  { type: 'diagonalSplit', label: '对角分割 Split', category: '线条结构', layer: 'decoration', config: { color: '$accent', alpha: 1, rotSpeed: 0.25 } },
  { type: 'diagonalStructure', label: '对角线结构 DiagStruct', category: '线条结构', layer: 'decoration', config: { color: '#f0f0f0', alpha: 0.3, step: 100 } },
  { type: 'burstLines', label: '放射线 Burst', category: '线条结构', layer: 'decoration', config: { color: '$secondary', alpha: 0.2, rayCount: 24 } },
  { type: 'screenBorder', label: '屏幕边框 Border', category: '线条结构', layer: 'decoration', config: { color: '$primary' } },
  { type: 'dashedGuideLines', label: '虚线参考 Dashed', category: '线条结构', layer: 'decoration', config: { color: '$accent' } },
  { type: 'perspectiveGrid', label: '透视网格 PerspGrid', category: '线条结构', layer: 'decoration', config: { color: '$primary', alpha: 0.3, mode: 'floor', scrollSpeed: 0.5 } },
  { type: 'compositionGuides', label: '构成线 CompGuide', category: '线条结构', layer: 'decoration', config: { color: '$text', alpha: 0.2, guides: ['goldenSpiral'] } },
  { type: 'webLines', label: '蛛网线 WebLines', category: '线条结构', layer: 'decoration', config: { count: 22, color: '#ff2222', glowColor: '#ff4444', focalX: 0.5, focalY: 0.45, spread: 0.25 } },

  // 文字 Text
  { type: 'heroText', label: '主标题 Hero', category: '文字', layer: 'text', config: { color: '$text' } },
  { type: 'scatteredText', label: '散布文字 Scattered', category: '文字', layer: 'text', config: { color: '$secondary' } },
  { type: 'textStrip', label: '文字条 Strip', category: '文字', layer: 'text', config: { color: '$text', bgColor: '$accent' } },
  { type: 'textCards', label: '文字卡片 Cards', category: '文字', layer: 'text', config: { color: '$text' } },
  { type: 'bigOutlineText', label: '大字描边 BigText', category: '文字', layer: 'text', config: { color: '#e0e0e0', strokeColor: '#ffffff' } },
  { type: 'cuteOutlineText', label: '可爱描边 CuteText', category: '文字', layer: 'text', config: { fillColor: '#fab2b5', strokeColor: '#ffffff', fontSize: 80, strokeWidth: 8 } },
  { type: 'layeredText', label: '叠层文字 Layered', category: '文字', layer: 'text', config: { color: '$text' } },
  { type: 'glowTextCards', label: '发光卡片字 GlowCards', category: '文字', layer: 'text', config: { cardColor: '#ffffff', textColor: '#1a1a1a', fontSize: 68 } },
  { type: 'verticalSubText', label: '竖排副文字 VertSub', category: '文字', layer: 'text', config: { color: '#ffffff', fontSize: 13 } },
  { type: 'formulaText', label: '公式文字 Formula', category: '文字', layer: 'text', config: { color: '$text', count: 18 } },
  { type: 'fallingText', label: '文字雨 Falling', category: '文字', layer: 'decoration', config: { color: '$accent', count: 30 } },
  { type: 'staggeredText', label: '错落文字 Staggered', category: '文字', layer: 'text', config: { color: '#ffffff', fontSize: 64, modeDuration: 3.5 } },
  { type: 'heartVoice', label: '心声 HeartVoice', category: '文字', layer: 'text', config: { fontSize: 80, staggerDelay: 0.3, style1Color: '#000000', style2Color: '#ffffff', blur: 4, style2Scale: 1.4 } },

  // 叠加效果 Overlay
  { type: 'colorMask', label: '颜色蒙版 Mask', category: '叠加效果', layer: 'overlay', config: { color: '$accent', alpha: 0.3 } },
  { type: 'chromaticAberration', label: '色差 Chromatic', category: '叠加效果', layer: 'overlay', config: { offset: 3 } },
  { type: 'glitchBars', label: '故障条 Glitch', category: '叠加效果', layer: 'overlay', config: { color: '$accent' } },
  { type: 'vignette', label: '暗角 Vignette', category: '叠加效果', layer: 'overlay', config: { color: '#000000', alpha: 0.6 } },
  { type: 'scanlines', label: '扫描线 Scanlines', category: '叠加效果', layer: 'overlay', config: { color: '#003333', alpha: 0.12, spacing: 4 } },
  { type: 'filmGrain', label: '胶片噪点 Grain', category: '叠加效果', layer: 'overlay', config: { alpha: 0.08, mono: true, updateInterval: 3 } },
  { type: 'dotScreen', label: '网点纹理 Dots', category: '叠加效果', layer: 'overlay', config: { spacing: 8, dotRadius: 1.5, color: '$text', alpha: 0.12, angle: 15 } },

  // HUD
  { type: 'hudCorners', label: 'HUD角框 Corners', category: 'HUD', layer: 'decoration', config: { color: '$primary', margin: 20, armLength: 40 } },
  { type: 'hudStatusText', label: 'HUD状态 Status', category: 'HUD', layer: 'text', config: { textColor: '$text', alertColor: '$accent' } },
  { type: 'hudInfoPanel', label: 'HUD信息卡 Panel', category: 'HUD', layer: 'overlay', config: { primaryColor: '$primary', alertColor: '$accent' } },
  { type: 'rulerGuide', label: '标尺 Ruler', category: 'HUD', layer: 'decoration', config: { color: '#ffffff', alpha: 0.5 } },
  { type: 'targetGuide', label: '瞄准线 Target', category: 'HUD', layer: 'decoration', config: { color: '#6666cc' } },
  { type: 'motionBrackets', label: '运动框 Motion', category: 'HUD', layer: 'overlay', config: { color: '#00ffcc', alpha: 0.8, style: 'high' } },

  // 有机形态 Organic
  { type: 'glowRing', label: '光圈 GlowRing', category: '有机形态', layer: 'decoration', config: { colorInner: '#4444ff', colorOuter: '#cc22aa' } },
  { type: 'lightSpot', label: '亮光 LightSpot', category: '有机形态', layer: 'overlay', config: { color: '#ffffff', x: 0.5, y: 0.1, alpha: 0.45 } },
  { type: 'organicBlob', label: '有机Blob Blob', category: '有机形态', layer: 'decoration', config: { shape: 'blob', color: '$primary', alpha: 0.25, count: 3 } },
  { type: 'organicBlob', label: '海浪 Wave', category: '有机形态', layer: 'decoration', config: { shape: 'wave', color: '$primary', alpha: 0.3, layers: 4, amplitude: 40, waveY: 0.6 } },
  { type: 'organicBlob', label: '云团 Cloud', category: '有机形态', layer: 'decoration', config: { shape: 'cloud', color: '$secondary', alpha: 0.2, count: 3 } },
  { type: 'smearBrush', label: '涂抹笔触 Smear', category: '有机形态', layer: 'decoration', config: { count: 8, grainAlpha: 0.04 } },

  // 数字废墟 Digital Grunge
  { type: 'noiseText', label: '乱码文字 NoiseText', category: '数字废墟', layer: 'decoration', config: { count: 10, color: '#ffffff', bgColor: '#000000' } },
  { type: 'dataMonitors', label: '数据终端 Monitors', category: '数字废墟', layer: 'decoration', config: { count: 4, borderColor: '#ffffff', fillColor: '#000000', dataColor: '#ffffff', alpha: 0.7 } },

  // 特殊形状 Special Shape
  { type: 'crimeTape', label: '封条 CrimeTape', category: '特殊形状', layer: 'decoration', config: { count: 5, tapeColor: '#f5c800', textColor: '#000000', tapeWidth: 52, speed: 80, text: 'POLICE LINE DO NOT CROSS', angleRange: 0.18 } },
  { type: 'bloodSplatter', label: '血迹 Blood', category: '特殊形状', layer: 'background', config: { count: 4, color: '#8b0000', alpha: 0.92, size: 1.0, seed: 42 } },
  { type: 'paperTear', label: '撕裂纸张 PaperTear', category: '特殊形状', layer: 'overlay', config: { seed: 914, borderWidth: 7 } },
  { type: 'jigsawGrid', label: '拼图网格 Jigsaw', category: '特殊形状', layer: 'decoration', config: { cols: 8, rows: 5, color: '$line', alpha: 0.5, lineWidth: 2 } },

  // 云朵条纹 Clouds & Stripes
  { type: 'edgeClouds', label: '边缘云朵 EdgeClouds', category: '云朵条纹', layer: 'decoration', config: { color: '#ffffff', alpha: 1.0, cloudCount: 5, baseRadius: 100, seed: 914 } },
  { type: 'pinkStripes', label: '粉色条纹 PinkStripes', category: '云朵条纹', layer: 'background', config: { pinkColor: '#fbbdbe', stripeWidth: 150, speed: 0.3, angle: -45 } },
  { type: 'pinkGrid', label: '粉色格子 PinkGrid', category: '云朵条纹', layer: 'background', config: { color: '#f8c7ca', cellSize: 50, lineColor: '#ffffff', lineWidth: 2, speed: 30, alpha: 1.0 } },
  { type: 'scalloppedBorder', label: '上下花边 Scallop', category: '云朵条纹', layer: 'decoration', config: { color: '#ffffff', shadowColor: '#ecbfc0', shadowAlpha: 0.6, shadowOffsetX: 0, shadowOffsetY: 8, circleRadius: 80, animSpeed: 0.5, moveAmount: 15, alpha: 1.0 } },
  { type: 'pulsingCircle', label: '跃动圆形 Pulse', category: '云朵条纹', layer: 'background', config: { strokeColor: '#ffffff', strokeAlpha: 0.8, strokeWidth: 8, outerStrokeColor: '#ecbfc0', outerStrokeWidth: 3, outerStrokeAlpha: 0.6, radius: 250, x: 0.5, y: 0.5, animSpeed: 0.3, strokePulseAmount: 0.5, radiusPulseAmount: 0.08, enableBeatReact: false } },

  // Kawaii像素 Kawaii Pixel
  { 
    type: 'pixelBackground', 
    label: '像素背景 PixelBG', 
    category: 'Kawaii像素', 
    layer: 'background', 
    config: { 
      // Checkerboard settings
      checkerColor1: '#ffffff',
      checkerColor2: '#fef5f8',
      checkerCellSize: 40,
      checkerAlpha: 0.3,
      // Dots settings
      dotColor: '#ffb3d9',
      dotSize: 4,
      dotSpacing: 12,
      dotAlpha: 0.15,
      // Scattered shapes settings
      pinkColor: '#ffb3d9',
      yellowColor: '#fff9b3',
      pinkAlpha: 0.5,
      yellowAlpha: 0.6,
      pinkCount: 6,
      yellowCount: 8,
    } 
  },
  { 
    type: 'pixelTypewriter', 
    label: '像素打字机 PixelType', 
    category: 'Kawaii像素', 
    layer: 'text', 
    config: { 
      fillColor: '#5a3a5a',
      strokeColor: '#ffffff',
      fontSize: 44,
      strokeWidth: 6,
      fontWeight: '900',
      fontFamily: '"Courier New", monospace',
      letterSpacing: 3,
      leftX: 0.20,
      rightX: 0.60,
      y: 0.5,
      maxCharsPerSide: 5,
      shadowColor: '#ffb3d9',
      shadowBlur: 0,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      charDelay: 0.08,
      cursorColor: '#ffb3d9',
      cursorWidth: 4,
      cursorBlinkSpeed: 0.5,
      showCursorWhenDone: false,
      pixelSize: 3,
    } 
  },
  { 
    type: 'pixelWindow', 
    label: '像素窗口 PixelWin', 
    category: 'Kawaii像素', 
    layer: 'decoration', 
    config: { 
      windowsData: [
        { x: 0.22, y: 0.18, anchorX: 0.5, anchorY: 0.5, width: 320, height: 260, bgColor: '#ffffff', borderColor: '#ffb3d9', borderWidth: 4, titleBgColor: '#ffb3d9', titleColor: '#ffffff', title: 'Pixel Paint', titleBarHeight: 28, icon: 'heart', iconColor: '#ffb3d9', iconSize: 70, alpha: 0.95 },
        { x: 0.75, y: 0.15, anchorX: 0.5, anchorY: 0.5, width: 280, height: 180, bgColor: '#f0f8ff', borderColor: '#b3e5fc', borderWidth: 4, titleBgColor: '#b3e5fc', titleColor: '#ffffff', title: 'Welcome!!', titleBarHeight: 28, icon: 'paint', iconColor: '#b3e5fc', iconSize: 50, alpha: 0.92 },
        { x: 0.82, y: 0.28, anchorX: 0.5, anchorY: 0.5, width: 260, height: 160, bgColor: '#fff5f8', borderColor: '#ffc0e0', borderWidth: 4, titleBgColor: '#ffc0e0', titleColor: '#ffffff', title: 'Messages ♡', titleBarHeight: 28, content: 'You have 3 new\nmessages! (◕‿◕)', contentColor: '#5a3a5a', alpha: 0.90 },
        { x: 0.18, y: 0.78, anchorX: 0.5, anchorY: 0.5, width: 300, height: 200, bgColor: '#f5f0ff', borderColor: '#c8b3ff', borderWidth: 4, titleBgColor: '#c8b3ff', titleColor: '#ffffff', title: 'Music Player', titleBarHeight: 28, content: '♪ Now Playing...\n\n▶ Track 01\n━━━━━━━━━━ 2:34', contentColor: '#5a3a5a', alpha: 0.93 },
        { x: 0.25, y: 0.68, anchorX: 0.5, anchorY: 0.5, width: 240, height: 150, bgColor: '#f0fff4', borderColor: '#c8f7dc', borderWidth: 4, titleBgColor: '#c8f7dc', titleColor: '#ffffff', title: 'Calendar', titleBarHeight: 28, content: '📅 Today:\nMarch 14, 2026\nSaturday ☆', contentColor: '#5a3a5a', alpha: 0.91 },
        { x: 0.78, y: 0.78, anchorX: 0.5, anchorY: 0.5, width: 340, height: 240, bgColor: '#fffef0', borderColor: '#ffb3d9', borderWidth: 4, titleBgColor: '#ffb3d9', titleColor: '#ffffff', title: 'Note.txt', titleBarHeight: 28, content: '1. Buy milk\n2. Call mom\n3. Practice drawing\n4. Be cute!', contentColor: '#5a3a5a', alpha: 0.95 }
      ]
    } 
  },
  { 
    type: 'desktopIcon', 
    label: '桌面图标 Icon', 
    category: 'Kawaii像素', 
    layer: 'decoration', 
    config: { 
      iconsData: [
        { x: 30, y: 30, size: 64, iconType: 'paint', label: 'Paint.exe', labelColor: '#5a3a5a' },
        { x: 30, y: 120, size: 64, iconType: 'notes', label: 'Notes', labelColor: '#5a3a5a' }
      ]
    } 
  },
];

for (const meta of v2Metas) {
  // Build label matching V1 pattern: "中文名 EnglishName"
  const localName = resolveLocalized(meta.name);
  const enName = typeof meta.name === 'object' ? meta.name.en : undefined;
  const label = enName && enName !== localName ? `${localName} ${enName}` : localName;

  effectCatalog.push({
    type: meta.type,
    label,
    category: resolveLocalized(meta.category),
    layer: meta.layer,
    config: buildDefaultConfig(meta),
  });
}