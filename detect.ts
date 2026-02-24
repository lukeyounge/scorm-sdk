import type { ScormAPI } from './types';

export type DetectedEnv = 'postmessage' | 'scorm12' | 'noop';

/**
 * Walk up the window hierarchy looking for the SCORM 1.2 API object.
 * SCORM spec says look up to 7 levels of parent windows.
 */
function findScorm12API(): ScormAPI | null {
  let win: Window | null = window;
  let attempts = 0;
  const MAX_ATTEMPTS = 7;

  // Check opener chain first
  if (window.opener) {
    win = window.opener;
    attempts = 0;
    while (win && attempts < MAX_ATTEMPTS) {
      if ((win as any).API) return (win as any).API as ScormAPI;
      try {
        win = win.parent && win.parent !== win ? win.parent : null;
      } catch {
        // Cross-origin — can't access parent
        win = null;
      }
      attempts++;
    }
  }

  // Check parent chain
  win = window.parent;
  attempts = 0;
  while (win && win !== window && attempts < MAX_ATTEMPTS) {
    if ((win as any).API) return (win as any).API as ScormAPI;
    try {
      win = win.parent && win.parent !== win ? win.parent : null;
    } catch {
      win = null;
    }
    attempts++;
  }

  return null;
}

/** Check if we're inside an iframe (potential Thinkshow LMS embed). */
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin — we're definitely in an iframe
    return true;
  }
}

/**
 * Auto-detect the environment.
 * Priority: SCORM 1.2 API > iframe postMessage > standalone noop.
 */
export function detectEnvironment(): DetectedEnv {
  // SCORM 1.2 takes priority — real LMS present
  if (findScorm12API()) return 'scorm12';

  // If we're in an iframe, assume postMessage communication with parent LMS
  if (isInIframe()) return 'postmessage';

  // Standalone — no LMS
  return 'noop';
}

/** Get the SCORM 1.2 API object. Call only when you know it exists. */
export function getScorm12API(): ScormAPI | null {
  return findScorm12API();
}
