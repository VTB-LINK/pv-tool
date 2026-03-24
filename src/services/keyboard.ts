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
  description: string;
}

const SHORTCUTS: ShortcutDef[] = [
  { key: 'h', action: 'togglePanels', description: 'Toggle panel visibility' },
  { key: 'r', ctrl: true, action: 'toggleRecording', description: 'Start/stop recording' },
  { key: ' ', action: 'togglePlay', description: 'Play/pause audio' },
  { key: 'e', action: 'openEditor', description: 'Open template editor' },
  { key: 'ArrowRight', action: 'nextTemplate', description: 'Next template' },
  { key: 'ArrowLeft', action: 'prevTemplate', description: 'Previous template' },
  { key: '0', action: 'resetPostFx', description: 'Reset all post-fx to zero' },
];

/** Get all available shortcut definitions for help display. */
export function getShortcutList(): { key: string; description: string; modifiers?: string }[] {
  return SHORTCUTS.map(s => ({
    key: s.key === ' ' ? 'Space' : s.key,
    description: s.description,
    modifiers: [s.ctrl && 'Ctrl', s.shift && 'Shift', s.alt && 'Alt'].filter(Boolean).join('+') || undefined,
  }));
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
