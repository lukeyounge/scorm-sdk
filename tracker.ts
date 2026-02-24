import type { Transport, Artifact, TrackerOptions, CompletionStatus } from './types';
import { detectEnvironment } from './detect';
import { PostMessageTransport } from './transports/postmessage';
import { Scorm12Transport } from './transports/scorm12';
import { NoopTransport } from './transports/noop';

/**
 * ThinkshowTracker — the main API for adding SCORM tracking to a web app.
 *
 * Usage:
 * ```ts
 * import { ThinkshowTracker } from '@thinkshow/scorm-sdk'
 * const tracker = ThinkshowTracker.init()
 * ```
 */
export class ThinkshowTracker {
  private transport: Transport;
  private score: number | null = null;
  private scoreMax = 100;
  private terminated = false;
  private env: string;

  private constructor(transport: Transport, env: string) {
    this.transport = transport;
    this.env = env;
  }

  /**
   * Create and initialize a tracker instance.
   * Auto-detects the environment (SCORM 1.2, Thinkshow LMS, or standalone).
   */
  static init(options: TrackerOptions = {}): ThinkshowTracker {
    const env = options.transport ?? detectEnvironment();
    const transport = ThinkshowTracker.createTransport(env, options);

    const tracker = new ThinkshowTracker(transport, env);

    // Initialize the transport (may return suspend data)
    transport.initialize();

    // Auto-terminate on page unload
    const cleanup = () => {
      if (!tracker.terminated) {
        tracker.transport.terminate();
        tracker.terminated = true;
      }
    };
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    return tracker;
  }

  // ---- Completion ----

  /** Mark the exercise as completed (neutral — neither pass nor fail). */
  complete(): void {
    this.finish('completed');
  }

  /** Mark the exercise as passed. */
  pass(): void {
    this.finish('passed');
  }

  /** Mark the exercise as failed. */
  fail(): void {
    this.finish('failed');
  }

  // ---- Score ----

  /**
   * Set the learner's score.
   * @param score - The score value (defaults to 0-100 scale)
   * @param maxScore - Optional maximum score (default 100)
   */
  setScore(score: number, maxScore?: number): void {
    if (maxScore !== undefined) this.scoreMax = maxScore;
    this.score = score;

    // Normalize to 0-100 for the transport
    const normalized = this.scoreMax > 0 ? Math.round((score / this.scoreMax) * 100) : 0;
    this.transport.setScore(normalized, 100);
  }

  // ---- Progress ----

  /**
   * Report progress through the exercise.
   * @param percentComplete - Progress 0-100
   */
  setProgress(percentComplete: number): void {
    const clamped = Math.round(Math.min(100, Math.max(0, percentComplete)));
    this.transport.setProgress(clamped);

    // If first interaction, signal started
    this.transport.started();
  }

  // ---- Artifacts ----

  /**
   * Submit learner-generated content (code, text, files, etc.).
   */
  submitArtifact(artifact: Artifact): void {
    this.transport.submitArtifact(artifact);
  }

  // ---- State persistence ----

  /**
   * Save arbitrary state for resume later.
   * @param state - Any serializable object
   */
  saveState(state: unknown): void {
    const serialized = JSON.stringify(state);
    this.transport.saveState(serialized);
  }

  /**
   * Load previously saved state.
   * @returns The deserialized state, or null if none exists
   */
  loadState<T = unknown>(): T | null {
    const raw = this.transport.loadState();
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  // ---- Info ----

  /** The detected or forced environment type */
  get environment(): string {
    return this.env;
  }

  /** Whether an LMS was detected (not standalone) */
  get isConnected(): boolean {
    return this.env !== 'noop';
  }

  // ---- Private ----

  private finish(status: CompletionStatus): void {
    // For postMessage transport, send completion with score in one message
    if (this.transport instanceof PostMessageTransport) {
      this.transport.sendCompletion(status, this.score);
    } else {
      if (this.score !== null) {
        this.transport.setScore(
          this.scoreMax > 0 ? Math.round((this.score / this.scoreMax) * 100) : 0,
          100,
        );
      }
      this.transport.setCompletionStatus(status);
    }
  }

  private static createTransport(env: string, options: TrackerOptions): Transport {
    switch (env) {
      case 'scorm12':
        return new Scorm12Transport();
      case 'postmessage':
        return new PostMessageTransport(options.targetOrigin);
      default:
        return new NoopTransport();
    }
  }
}
