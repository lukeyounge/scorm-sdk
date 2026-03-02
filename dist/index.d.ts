/** Artifact submitted by the learner */
interface Artifact {
    type: 'text' | 'code' | 'file' | 'form' | 'custom';
    content: string | Record<string, unknown>;
    metadata?: Record<string, unknown>;
}
/** Options for ThinkshowTracker.init() */
interface TrackerOptions {
    /**
     * Force a specific transport instead of auto-detecting.
     * - 'postmessage' — Thinkshow LMS (iframe postMessage)
     * - 'scorm12'     — Standard SCORM 1.2 LMS
     * - 'noop'        — Standalone / no LMS
     */
    transport?: 'postmessage' | 'scorm12' | 'noop';
    /**
     * Target origin for postMessage transport.
     * Defaults to '*' (any origin). Set for tighter security.
     */
    targetOrigin?: string;
}
/** Completion status for SCORM-style reporting */
type CompletionStatus = 'incomplete' | 'completed' | 'passed' | 'failed';
interface EmbedMessage {
    type: 'lms-embed-event';
    version: '1.0';
    payload: EmbedEventPayload;
}
type EmbedEventPayload = {
    event: 'ready';
} | {
    event: 'started';
} | {
    event: 'progress';
    percent: number;
} | {
    event: 'completed';
    score?: number;
    data?: unknown;
} | {
    event: 'submitted';
    submission: {
        type: string;
        content: string | object;
        metadata?: Record<string, unknown>;
    };
} | {
    event: 'state-save';
    state: string;
} | {
    event: 'error';
    message: string;
};
interface LmsInitMessage {
    type: 'lms-init';
    version: '1.0';
    payload: {
        userId?: string;
        lessonId?: string;
        slideId?: string;
        previousState?: unknown;
        config?: Record<string, unknown>;
    };
}

/**
 * ThinkshowTracker — the main API for adding SCORM tracking to a web app.
 *
 * Usage:
 * ```ts
 * import { ThinkshowTracker } from '@thinkshow/scorm-sdk'
 * const tracker = ThinkshowTracker.init()
 * ```
 */
declare class ThinkshowTracker {
    private transport;
    private score;
    private scoreMax;
    private terminated;
    private env;
    private constructor();
    /**
     * Create and initialize a tracker instance.
     * Auto-detects the environment (SCORM 1.2, Thinkshow LMS, or standalone).
     */
    static init(options?: TrackerOptions): ThinkshowTracker;
    /** Mark the exercise as completed (neutral — neither pass nor fail). */
    complete(): void;
    /** Mark the exercise as passed. */
    pass(): void;
    /** Mark the exercise as failed. */
    fail(): void;
    /**
     * Set the learner's score.
     * @param score - The score value (defaults to 0-100 scale)
     * @param maxScore - Optional maximum score (default 100)
     */
    setScore(score: number, maxScore?: number): void;
    /**
     * Report progress through the exercise.
     * @param percentComplete - Progress 0-100
     */
    setProgress(percentComplete: number): void;
    /**
     * Submit learner-generated content (code, text, files, etc.).
     */
    submitArtifact(artifact: Artifact): void;
    /**
     * Save arbitrary state for resume later.
     * @param state - Any serializable object
     */
    saveState(state: unknown): void;
    /**
     * Load previously saved state.
     * @returns The deserialized state, or null if none exists
     */
    loadState<T = unknown>(): T | null;
    /** The detected or forced environment type */
    get environment(): string;
    /** Whether an LMS was detected (not standalone) */
    get isConnected(): boolean;
    private finish;
    private static createTransport;
}

export { type Artifact, type CompletionStatus, type EmbedEventPayload, type EmbedMessage, type LmsInitMessage, ThinkshowTracker, type TrackerOptions };
