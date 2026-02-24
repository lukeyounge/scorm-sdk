// ---- Public types ----

/** Artifact submitted by the learner */
export interface Artifact {
  type: 'text' | 'code' | 'file' | 'form' | 'custom';
  content: string | Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/** Options for ThinkshowTracker.init() */
export interface TrackerOptions {
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

// ---- Internal types (transport layer) ----

/** Completion status for SCORM-style reporting */
export type CompletionStatus = 'incomplete' | 'completed' | 'passed' | 'failed';

/** The internal state that the tracker accumulates before flushing */
export interface TrackerState {
  completionStatus: CompletionStatus;
  score: number | null;
  scoreMax: number;
  progress: number;
  artifacts: Artifact[];
  suspendData: string | null;
  started: boolean;
}

/** The transport interface that each backend implements */
export interface Transport {
  /** Called once on init. Return previous suspend data if available. */
  initialize(): string | null;
  /** Report that the learner has started interacting. */
  started(): void;
  /** Report progress 0-100. */
  setProgress(percent: number): void;
  /** Report score. */
  setScore(score: number, max: number): void;
  /** Report completion status. */
  setCompletionStatus(status: CompletionStatus): void;
  /** Submit a learner artifact. */
  submitArtifact(artifact: Artifact): void;
  /** Persist arbitrary state for resume. */
  saveState(data: string): void;
  /** Read persisted state. */
  loadState(): string | null;
  /** Flush / terminate the session. */
  terminate(): void;
}

// ---- postMessage protocol (matches LMS types.ts) ----

export interface EmbedMessage {
  type: 'lms-embed-event';
  version: '1.0';
  payload: EmbedEventPayload;
}

export type EmbedEventPayload =
  | { event: 'ready' }
  | { event: 'started' }
  | { event: 'progress'; percent: number }
  | { event: 'completed'; score?: number; data?: unknown }
  | { event: 'submitted'; submission: { type: string; content: string | object; metadata?: Record<string, unknown> } }
  | { event: 'state-save'; state: string }
  | { event: 'error'; message: string };

export interface LmsInitMessage {
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

// ---- SCORM 1.2 API shape ----

export interface ScormAPI {
  LMSInitialize(param: string): string;
  LMSFinish(param: string): string;
  LMSGetValue(key: string): string;
  LMSSetValue(key: string, value: string): string;
  LMSCommit(param: string): string;
  LMSGetLastError(): string;
  LMSGetErrorString(code: string): string;
  LMSGetDiagnostic(code: string): string;
}
