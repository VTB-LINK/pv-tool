// Modified by VTB-LIVE on 2026-03-24
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

declare module 'jieba-wasm' {
  // Default export is the init function
  export default function init(): Promise<void>;
  // Named exports
  export function cut(text: string, hmm?: boolean): string[];
  export function cut_all(text: string): string[];
  export function cut_for_search(text: string, hmm?: boolean): string[];
}
