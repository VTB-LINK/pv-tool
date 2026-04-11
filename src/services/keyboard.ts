// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

/**
 * Keyboard shortcuts for PV Tool.
 * Returns a cleanup function for Svelte onDestroy.
 */

export interface KeyboardActions {
  togglePanels: () => void;
  toggleRecording: () => void;
  togglePlay: () => void;
  openEditor: () => void;
  nextTemplate: () => void;
  prevTemplate: () => void;
  resetPostFx: () => void;
}

interface ShortcutDef {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: keyof KeyboardActions;
  /** i18n key for the shortcut description (e.g. 'shortcut_toggle_panels') */
  descriptionKey: string;
}

const SHORTCUTS: ShortcutDef[] = [
  { key: 'h', action: 'togglePanels', descriptionKey: 'shortcut_toggle_panels' },
  { key: 'r', ctrl: true, action: 'toggleRecording', descriptionKey: 'shortcut_toggle_recording' },
  { key: ' ', action: 'togglePlay', descriptionKey: 'shortcut_toggle_play' },
  { key: 'e', action: 'openEditor', descriptionKey: 'shortcut_toggle_editor' },
  { key: 'ArrowRight', action: 'nextTemplate', descriptionKey: 'shortcut_next_template' },
  { key: 'ArrowLeft', action: 'prevTemplate', descriptionKey: 'shortcut_prev_template' },
  { key: '0', action: 'resetPostFx', descriptionKey: 'shortcut_reset_postfx' },
];

const KEY_DISPLAY: Record<string, string> = {
  ' ': 'Space',
  'ArrowRight': '→',
  'ArrowLeft': '←',
  'ArrowUp': '↑',
  'ArrowDown': '↓',
};

/** Get all available shortcut definitions for help display. */
export function getShortcutList(): { keyParts: string[]; descriptionKey: string }[] {
  return SHORTCUTS.map(s => {
    const parts: string[] = [];
    if (s.ctrl) parts.push('Ctrl');
    if (s.shift) parts.push('Shift');
    if (s.alt) parts.push('Alt');
    parts.push(KEY_DISPLAY[s.key] ?? s.key);
    return { keyParts: parts, descriptionKey: s.descriptionKey };
  });
}

/**
 * Bind keyboard shortcuts globally.
 * Returns a cleanup function to remove the listener.
 */
export function bindKeyboard(actions: KeyboardActions): () => void {
  function handler(e: KeyboardEvent) {
    // Skip when typing in inputs
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    for (const shortcut of SHORTCUTS) {
      if (e.key.toLowerCase() === shortcut.key.toLowerCase() || e.key === shortcut.key) {
        if (shortcut.ctrl && !e.ctrlKey && !e.metaKey) continue;
        if (shortcut.shift && !e.shiftKey) continue;
        if (shortcut.alt && !e.altKey) continue;

        // Non-modifier shortcuts should not fire when ctrl/alt is held
        if (!shortcut.ctrl && (e.ctrlKey || e.metaKey)) continue;
        if (!shortcut.alt && e.altKey) continue;

        e.preventDefault();
        const action = actions[shortcut.action];
        if (action) action();
        return;
      }
    }
  }

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
