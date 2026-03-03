// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

export type LayerType = 'background' | 'decoration' | 'media' | 'text' | 'overlay';

export interface ColorPalette {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

export interface EffectEntry {
  type: string;
  layer: LayerType;
  config: Record<string, any>;
}

export interface TemplateConfig {
  name: string;
  palette: ColorPalette;
  effects: EffectEntry[];
  bpm?: number;
  features?: {
    mediaOutline?: boolean;
    autoExtractColors?: boolean;
    motionDetection?: boolean;
    invertMedia?: boolean;
  };
}

export interface MotionTargetInfo {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
}

export interface UpdateContext {
  time: number;
  deltaTime: number;
  screenWidth: number;
  screenHeight: number;
  palette: ColorPalette;
  animationSpeed: number;
  motionIntensity: number;
  currentText: string;
  beatIntensity: number;
  motionTargets: MotionTargetInfo[];
}

export interface Beat {
  time: number;
  type: 'kick' | 'snare' | 'accent';
}

export interface LyricChar {
  text: string;
  startTime: number;
  endTime: number;
}

export interface LyricPhrase {
  chars: LyricChar[];
  startTime: number;
  endTime: number;
}

export interface Segment {
  type: 'verse' | 'chorus' | 'bridge';
  startTime: number;
  endTime: number;
}

export interface MusicData {
  bpm: number;
  beats: Beat[];
  lyrics: LyricPhrase[];
  segments: Segment[];
}

export function resolveColor(color: string, palette: ColorPalette): string {
  if (color.startsWith('$')) {
    const key = color.slice(1) as keyof ColorPalette;
    return palette[key] || '#000000';
  }
  return color;
}