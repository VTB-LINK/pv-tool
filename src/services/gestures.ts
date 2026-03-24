// VTB-LIVE Fork - Copyright (c) 2026 VTB-LIVE
// Licensed under AGPL-3.0.

/**
 * Touch gesture utilities — pinch-zoom on canvas, swipe detection for tab switching.
 */

export interface SwipeResult {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  duration: number;
}

export interface PinchResult {
  scale: number;      // relative scale (1.0 = no change)
  centerX: number;
  centerY: number;
}

type SwipeHandler = (result: SwipeResult) => void;
type PinchHandler = (result: PinchResult) => void;

interface GestureState {
  startX: number;
  startY: number;
  startTime: number;
  initialPinchDist: number;
  isPinching: boolean;
}

const MIN_SWIPE_DISTANCE = 50;   // px
const MAX_SWIPE_TIME = 400;      // ms
const SWIPE_ANGLE_THRESHOLD = 30; // degrees from axis

/**
 * Bind swipe detection to an element.
 * Returns a cleanup function.
 */
export function bindSwipe(element: HTMLElement, onSwipe: SwipeHandler): () => void {
  const state: GestureState = {
    startX: 0, startY: 0, startTime: 0,
    initialPinchDist: 0, isPinching: false,
  };

  function handleStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    state.startX = e.touches[0].clientX;
    state.startY = e.touches[0].clientY;
    state.startTime = Date.now();
    state.isPinching = false;
  }

  function handleEnd(e: TouchEvent) {
    if (state.isPinching) return;
    if (e.changedTouches.length !== 1) return;

    const dx = e.changedTouches[0].clientX - state.startX;
    const dy = e.changedTouches[0].clientY - state.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - state.startTime;

    if (dist < MIN_SWIPE_DISTANCE || elapsed > MAX_SWIPE_TIME) return;

    // Determine swipe direction
    const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
    let direction: SwipeResult['direction'];

    if (angle < SWIPE_ANGLE_THRESHOLD) {
      direction = dx > 0 ? 'right' : 'left';
    } else if (angle > (90 - SWIPE_ANGLE_THRESHOLD)) {
      direction = dy > 0 ? 'down' : 'up';
    } else {
      return; // diagonal — ignore
    }

    onSwipe({ direction, distance: dist, duration: elapsed });
  }

  element.addEventListener('touchstart', handleStart, { passive: true });
  element.addEventListener('touchend', handleEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', handleStart);
    element.removeEventListener('touchend', handleEnd);
  };
}

/**
 * Bind pinch-zoom detection (2-finger) to an element.
 * Returns a cleanup function.
 */
export function bindPinch(element: HTMLElement, onPinch: PinchHandler): () => void {
  let initialDist = 0;

  function dist(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function handleStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      initialDist = dist(e.touches[0], e.touches[1]);
    }
  }

  function handleMove(e: TouchEvent) {
    if (e.touches.length !== 2 || initialDist === 0) return;
    e.preventDefault();

    const currentDist = dist(e.touches[0], e.touches[1]);
    const scale = currentDist / initialDist;
    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

    onPinch({ scale, centerX: cx, centerY: cy });
  }

  function handleEnd() {
    initialDist = 0;
  }

  element.addEventListener('touchstart', handleStart, { passive: true });
  element.addEventListener('touchmove', handleMove, { passive: false });
  element.addEventListener('touchend', handleEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', handleStart);
    element.removeEventListener('touchmove', handleMove);
    element.removeEventListener('touchend', handleEnd);
  };
}
