// Modified by VTB-LIVE on 2026-03-24
// Copyright (c) 2026 VTB-LIVE (Modifications)
//
// Original Work:
// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under AGPL-3.0. For commercial use, see COMMERCIAL.md

import { zh, type LocaleKey } from './zh';
import { ja } from './ja';
import { en } from './en';

export type Locale = 'zh' | 'ja' | 'en';

const locales: Record<Locale, Record<LocaleKey, string>> = { zh, ja, en };

function detectLocale(): Locale {
  const path = window.location.pathname;
  if (path.includes('/ja/') || path.endsWith('/ja')) return 'ja';
  if (path.includes('/en/') || path.endsWith('/en')) return 'en';
  return 'zh';
}

export const locale: Locale = detectLocale();

export function t(key: LocaleKey): string {
  return locales[locale]?.[key] ?? locales.zh[key] ?? key;
}

export { type LocaleKey };
