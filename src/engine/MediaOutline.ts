// Modified by VTB-LIVE on 2026-03-24
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import * as PIXI from 'pixi.js';

export class MediaOutlineRenderer {
  readonly sprite: PIXI.Sprite;
  readonly w: number;
  readonly h: number;

  private srcCanvas: HTMLCanvasElement;
  private srcCtx: CanvasRenderingContext2D;
  private outCanvas: HTMLCanvasElement;
  private outCtx: CanvasRenderingContext2D;
  private tick = 0;

  constructor(sourceW: number, sourceH: number) {
    const maxDim = 780;
    const scale = Math.min(maxDim / Math.max(sourceW, sourceH), 1);
    this.w = Math.round(sourceW * scale);
    this.h = Math.round(sourceH * scale);

    this.srcCanvas = document.createElement('canvas');
    this.srcCanvas.width = this.w;
    this.srcCanvas.height = this.h;
    this.srcCtx = this.srcCanvas.getContext('2d', { willReadFrequently: true })!;

    this.outCanvas = document.createElement('canvas');
    this.outCanvas.width = this.w;
    this.outCanvas.height = this.h;
    this.outCtx = this.outCanvas.getContext('2d')!;

    const texture = PIXI.Texture.from(this.outCanvas);
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(0.5);
  }

  update(source: HTMLVideoElement | HTMLImageElement): void {
    this.tick++;
    if (this.tick % 3 !== 0) return;

    const w = this.w;
    const h = this.h;

    this.srcCtx.drawImage(source, 0, 0, w, h);
    const imgData = this.srcCtx.getImageData(0, 0, w, h);
    const src = imgData.data;

    // Convert to grayscale
    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
      gray[j] = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;
    }

    // 3×3 Gaussian blur to suppress noise before edge detection
    // Kernel: [1 2 1; 2 4 2; 1 2 1] / 16
    const blurred = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        blurred[idx] = (
          gray[idx - w - 1]     + 2 * gray[idx - w] + gray[idx - w + 1] +
          2 * gray[idx - 1]     + 4 * gray[idx]     + 2 * gray[idx + 1] +
          gray[idx + w - 1]     + 2 * gray[idx + w] + gray[idx + w + 1]
        ) / 16;
      }
    }

    // Sobel edge detection on blurred grayscale
    const edgeMap = new Float32Array(w * h);
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const g = (ox: number, oy: number) => blurred[(y + oy) * w + (x + ox)];
        const gx = -g(-1, -1) - 2 * g(-1, 0) - g(-1, 1)
                   + g(1, -1) + 2 * g(1, 0) + g(1, 1);
        const gy = -g(-1, -1) - 2 * g(0, -1) - g(1, -1)
                   + g(-1, 1) + 2 * g(0, 1) + g(1, 1);
        edgeMap[y * w + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // Smoothstep alpha mapping with soft threshold
    const outImg = this.outCtx.createImageData(w, h);
    const out = outImg.data;
    const lo = 60;   // edges below this are invisible
    const hi = 180;  // edges above this are fully opaque

    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const e = edgeMap[y * w + x];
        if (e > lo) {
          const t = Math.min(Math.max((e - lo) / (hi - lo), 0), 1);
          const s = t * t * (3 - 2 * t); // smoothstep
          const idx = (y * w + x) * 4;
          out[idx] = 0;
          out[idx + 1] = 0;
          out[idx + 2] = 0;
          out[idx + 3] = Math.round(s * 200);
        }
      }
    }

    this.outCtx.putImageData(outImg, 0, 0);
    this.sprite.texture.source.update();
  }

  destroy(): void {
    this.sprite.destroy(true);
  }
}