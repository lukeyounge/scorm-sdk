import type { Transport, Artifact, CompletionStatus, ScormAPI } from '../types';
import { getScorm12API } from '../detect';

/**
 * SCORM 1.2 transport — communicates with a standard SCORM 1.2 LMS
 * (Moodle, Canvas, Blackboard, etc.) via the runtime API.
 */
export class Scorm12Transport implements Transport {
  private api: ScormAPI | null = null;
  private initialized = false;

  initialize(): string | null {
    this.api = getScorm12API();
    if (!this.api) return null;

    const result = this.api.LMSInitialize('');
    this.initialized = result === 'true';

    if (!this.initialized) return null;

    // Read suspend data for resume
    const suspendData = this.api.LMSGetValue('cmi.suspend_data');
    return suspendData || null;
  }

  started(): void {
    // SCORM 1.2: set lesson_status to 'incomplete' when learner starts
    this.setValue('cmi.core.lesson_status', 'incomplete');
    this.commit();
  }

  setProgress(_percent: number): void {
    // SCORM 1.2 doesn't have a direct progress field.
    // We can use cmi.core.lesson_location as a breadcrumb.
    this.setValue('cmi.core.lesson_location', String(_percent));
    this.commit();
  }

  setScore(score: number, max: number): void {
    this.setValue('cmi.core.score.raw', String(Math.round(score)));
    this.setValue('cmi.core.score.max', String(Math.round(max)));
    this.setValue('cmi.core.score.min', '0');
    this.commit();
  }

  setCompletionStatus(status: CompletionStatus): void {
    // SCORM 1.2 lesson_status values: passed, completed, failed, incomplete, browsed, not attempted
    const scormStatus: Record<CompletionStatus, string> = {
      incomplete: 'incomplete',
      completed: 'completed',
      passed: 'passed',
      failed: 'failed',
    };
    this.setValue('cmi.core.lesson_status', scormStatus[status]);
    this.commit();
  }

  submitArtifact(artifact: Artifact): void {
    // SCORM 1.2 has no artifact concept.
    // Store in suspend_data alongside other state.
    const existing = this.loadState();
    let state: Record<string, unknown> = {};
    if (existing) {
      try {
        state = JSON.parse(existing);
      } catch {
        state = {};
      }
    }
    const artifacts = (state._artifacts as unknown[] | undefined) || [];
    artifacts.push(artifact);
    state._artifacts = artifacts;
    this.saveState(JSON.stringify(state));
  }

  saveState(data: string): void {
    // SCORM 1.2 suspend_data is limited to 4096 chars
    if (data.length > 4096) {
      console.warn('[scorm-sdk] suspend_data exceeds 4096 chars, may be truncated by LMS');
    }
    this.setValue('cmi.suspend_data', data);
    this.commit();
  }

  loadState(): string | null {
    if (!this.api || !this.initialized) return null;
    const data = this.api.LMSGetValue('cmi.suspend_data');
    return data || null;
  }

  terminate(): void {
    if (!this.api || !this.initialized) return;
    this.api.LMSFinish('');
    this.initialized = false;
  }

  private setValue(key: string, value: string): void {
    if (!this.api || !this.initialized) return;
    this.api.LMSSetValue(key, value);
  }

  private commit(): void {
    if (!this.api || !this.initialized) return;
    this.api.LMSCommit('');
  }
}
