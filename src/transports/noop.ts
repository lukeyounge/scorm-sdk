import type { Transport, Artifact, CompletionStatus } from '../types';

/**
 * Noop transport — used when no LMS is detected.
 * Silently accepts all calls so the app works standalone.
 * State is persisted to localStorage as a convenience.
 */
export class NoopTransport implements Transport {
  private storageKey: string;

  constructor() {
    this.storageKey = `thinkshow-sdk-state-${location.pathname}`;
  }

  initialize(): string | null {
    return this.loadState();
  }

  started(): void {}
  setProgress(_percent: number): void {}
  setScore(_score: number, _max: number): void {}
  setCompletionStatus(_status: CompletionStatus): void {}
  submitArtifact(_artifact: Artifact): void {}

  saveState(data: string): void {
    try {
      localStorage.setItem(this.storageKey, data);
    } catch {
      // localStorage may be unavailable
    }
  }

  loadState(): string | null {
    try {
      return localStorage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  terminate(): void {}
}
