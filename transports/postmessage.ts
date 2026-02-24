import type { Transport, Artifact, CompletionStatus, EmbedMessage, LmsInitMessage } from '../types';

/**
 * PostMessage transport — communicates with the Thinkshow LMS
 * via the standardized lms-embed-event / lms-init protocol.
 */
export class PostMessageTransport implements Transport {
  private targetOrigin: string;
  private initPayload: LmsInitMessage['payload'] | null = null;
  private initReceived = false;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private localStorageKey: string;

  constructor(targetOrigin = '*') {
    this.targetOrigin = targetOrigin;
    this.localStorageKey = `thinkshow-sdk-state-${location.pathname}`;
  }

  initialize(): string | null {
    // Listen for lms-init from parent
    this.messageHandler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'lms-init' && msg?.version === '1.0') {
        this.initPayload = msg.payload;
        this.initReceived = true;
      }
    };
    window.addEventListener('message', this.messageHandler);

    // Signal ready to parent
    this.send({ event: 'ready' });

    // Return locally cached state (lms-init may arrive async)
    return this.loadState();
  }

  started(): void {
    this.send({ event: 'started' });
  }

  setProgress(percent: number): void {
    this.send({ event: 'progress', percent: Math.round(Math.min(100, Math.max(0, percent))) });
  }

  setScore(score: number, _max: number): void {
    // Score is sent with completion, but we can also send a progress-like update
    // The LMS captures score from the 'completed' event, so we store it here
    // and it will be included in the complete/pass/fail call
  }

  setCompletionStatus(status: CompletionStatus): void {
    const score = undefined; // Score is sent separately via the tracker
    switch (status) {
      case 'completed':
      case 'passed':
        this.send({ event: 'completed', score, data: { status } });
        break;
      case 'failed':
        this.send({ event: 'completed', score, data: { status: 'failed' } });
        break;
      // 'incomplete' — don't send a completion event
    }
  }

  /** Send completion with score */
  sendCompletion(status: CompletionStatus, score: number | null): void {
    this.send({
      event: 'completed',
      score: score ?? undefined,
      data: { status },
    });
  }

  submitArtifact(artifact: Artifact): void {
    this.send({
      event: 'submitted',
      submission: {
        type: artifact.type,
        content: artifact.content,
        metadata: artifact.metadata,
      },
    });
  }

  saveState(data: string): void {
    // Send to parent LMS
    this.send({ event: 'state-save', state: data });
    // Also cache locally for faster loadState
    try {
      localStorage.setItem(this.localStorageKey, data);
    } catch {
      // localStorage may be unavailable
    }
  }

  loadState(): string | null {
    // Prefer state from LMS init message
    if (this.initPayload?.previousState != null) {
      return typeof this.initPayload.previousState === 'string'
        ? this.initPayload.previousState
        : JSON.stringify(this.initPayload.previousState);
    }
    // Fall back to localStorage
    try {
      return localStorage.getItem(this.localStorageKey);
    } catch {
      return null;
    }
  }

  terminate(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
  }

  /** Whether we've received an lms-init message from the parent */
  get hasLmsInit(): boolean {
    return this.initReceived;
  }

  /** The payload from the lms-init message */
  get lmsInitPayload(): LmsInitMessage['payload'] | null {
    return this.initPayload;
  }

  private send(payload: EmbedMessage['payload']): void {
    const message: EmbedMessage = {
      type: 'lms-embed-event',
      version: '1.0',
      payload,
    };
    try {
      window.parent.postMessage(message, this.targetOrigin);
    } catch {
      // Parent may not be accessible (e.g., different origin without proper config)
    }
  }
}
