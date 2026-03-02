"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ThinkshowTracker: () => ThinkshowTracker
});
module.exports = __toCommonJS(index_exports);

// src/detect.ts
function findScorm12API() {
  let win = window;
  let attempts = 0;
  const MAX_ATTEMPTS = 7;
  if (window.opener) {
    win = window.opener;
    attempts = 0;
    while (win && attempts < MAX_ATTEMPTS) {
      if (win.API) return win.API;
      try {
        win = win.parent && win.parent !== win ? win.parent : null;
      } catch {
        win = null;
      }
      attempts++;
    }
  }
  win = window.parent;
  attempts = 0;
  while (win && win !== window && attempts < MAX_ATTEMPTS) {
    if (win.API) return win.API;
    try {
      win = win.parent && win.parent !== win ? win.parent : null;
    } catch {
      win = null;
    }
    attempts++;
  }
  return null;
}
function isInIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
function detectEnvironment() {
  if (findScorm12API()) return "scorm12";
  if (isInIframe()) return "postmessage";
  return "noop";
}
function getScorm12API() {
  return findScorm12API();
}

// src/transports/postmessage.ts
var PostMessageTransport = class {
  targetOrigin;
  initPayload = null;
  initReceived = false;
  messageHandler = null;
  localStorageKey;
  constructor(targetOrigin = "*") {
    this.targetOrigin = targetOrigin;
    this.localStorageKey = `thinkshow-sdk-state-${location.pathname}`;
  }
  initialize() {
    this.messageHandler = (event) => {
      const msg = event.data;
      if (msg?.type === "lms-init" && msg?.version === "1.0") {
        this.initPayload = msg.payload;
        this.initReceived = true;
      }
    };
    window.addEventListener("message", this.messageHandler);
    this.send({ event: "ready" });
    return this.loadState();
  }
  started() {
    this.send({ event: "started" });
  }
  setProgress(percent) {
    this.send({ event: "progress", percent: Math.round(Math.min(100, Math.max(0, percent))) });
  }
  setScore(score, _max) {
  }
  setCompletionStatus(status) {
    const score = void 0;
    switch (status) {
      case "completed":
      case "passed":
        this.send({ event: "completed", score, data: { status } });
        break;
      case "failed":
        this.send({ event: "completed", score, data: { status: "failed" } });
        break;
    }
  }
  /** Send completion with score */
  sendCompletion(status, score) {
    this.send({
      event: "completed",
      score: score ?? void 0,
      data: { status }
    });
  }
  submitArtifact(artifact) {
    this.send({
      event: "submitted",
      submission: {
        type: artifact.type,
        content: artifact.content,
        metadata: artifact.metadata
      }
    });
  }
  saveState(data) {
    this.send({ event: "state-save", state: data });
    try {
      localStorage.setItem(this.localStorageKey, data);
    } catch {
    }
  }
  loadState() {
    if (this.initPayload?.previousState != null) {
      return typeof this.initPayload.previousState === "string" ? this.initPayload.previousState : JSON.stringify(this.initPayload.previousState);
    }
    try {
      return localStorage.getItem(this.localStorageKey);
    } catch {
      return null;
    }
  }
  terminate() {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }
  }
  /** Whether we've received an lms-init message from the parent */
  get hasLmsInit() {
    return this.initReceived;
  }
  /** The payload from the lms-init message */
  get lmsInitPayload() {
    return this.initPayload;
  }
  send(payload) {
    const message = {
      type: "lms-embed-event",
      version: "1.0",
      payload
    };
    try {
      window.parent.postMessage(message, this.targetOrigin);
    } catch {
    }
  }
};

// src/transports/scorm12.ts
var Scorm12Transport = class {
  api = null;
  initialized = false;
  initialize() {
    this.api = getScorm12API();
    if (!this.api) return null;
    const result = this.api.LMSInitialize("");
    this.initialized = result === "true";
    if (!this.initialized) return null;
    const suspendData = this.api.LMSGetValue("cmi.suspend_data");
    return suspendData || null;
  }
  started() {
    this.setValue("cmi.core.lesson_status", "incomplete");
    this.commit();
  }
  setProgress(_percent) {
    this.setValue("cmi.core.lesson_location", String(_percent));
    this.commit();
  }
  setScore(score, max) {
    this.setValue("cmi.core.score.raw", String(Math.round(score)));
    this.setValue("cmi.core.score.max", String(Math.round(max)));
    this.setValue("cmi.core.score.min", "0");
    this.commit();
  }
  setCompletionStatus(status) {
    const scormStatus = {
      incomplete: "incomplete",
      completed: "completed",
      passed: "passed",
      failed: "failed"
    };
    this.setValue("cmi.core.lesson_status", scormStatus[status]);
    this.commit();
  }
  submitArtifact(artifact) {
    const existing = this.loadState();
    let state = {};
    if (existing) {
      try {
        state = JSON.parse(existing);
      } catch {
        state = {};
      }
    }
    const artifacts = state._artifacts || [];
    artifacts.push(artifact);
    state._artifacts = artifacts;
    this.saveState(JSON.stringify(state));
  }
  saveState(data) {
    if (data.length > 4096) {
      console.warn("[scorm-sdk] suspend_data exceeds 4096 chars, may be truncated by LMS");
    }
    this.setValue("cmi.suspend_data", data);
    this.commit();
  }
  loadState() {
    if (!this.api || !this.initialized) return null;
    const data = this.api.LMSGetValue("cmi.suspend_data");
    return data || null;
  }
  terminate() {
    if (!this.api || !this.initialized) return;
    this.api.LMSFinish("");
    this.initialized = false;
  }
  setValue(key, value) {
    if (!this.api || !this.initialized) return;
    this.api.LMSSetValue(key, value);
  }
  commit() {
    if (!this.api || !this.initialized) return;
    this.api.LMSCommit("");
  }
};

// src/transports/noop.ts
var NoopTransport = class {
  storageKey;
  constructor() {
    this.storageKey = `thinkshow-sdk-state-${location.pathname}`;
  }
  initialize() {
    return this.loadState();
  }
  started() {
  }
  setProgress(_percent) {
  }
  setScore(_score, _max) {
  }
  setCompletionStatus(_status) {
  }
  submitArtifact(_artifact) {
  }
  saveState(data) {
    try {
      localStorage.setItem(this.storageKey, data);
    } catch {
    }
  }
  loadState() {
    try {
      return localStorage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }
  terminate() {
  }
};

// src/tracker.ts
var ThinkshowTracker = class _ThinkshowTracker {
  transport;
  score = null;
  scoreMax = 100;
  terminated = false;
  env;
  constructor(transport, env) {
    this.transport = transport;
    this.env = env;
  }
  /**
   * Create and initialize a tracker instance.
   * Auto-detects the environment (SCORM 1.2, Thinkshow LMS, or standalone).
   */
  static init(options = {}) {
    const env = options.transport ?? detectEnvironment();
    const transport = _ThinkshowTracker.createTransport(env, options);
    const tracker = new _ThinkshowTracker(transport, env);
    transport.initialize();
    const cleanup = () => {
      if (!tracker.terminated) {
        tracker.transport.terminate();
        tracker.terminated = true;
      }
    };
    window.addEventListener("beforeunload", cleanup);
    window.addEventListener("pagehide", cleanup);
    return tracker;
  }
  // ---- Completion ----
  /** Mark the exercise as completed (neutral — neither pass nor fail). */
  complete() {
    this.finish("completed");
  }
  /** Mark the exercise as passed. */
  pass() {
    this.finish("passed");
  }
  /** Mark the exercise as failed. */
  fail() {
    this.finish("failed");
  }
  // ---- Score ----
  /**
   * Set the learner's score.
   * @param score - The score value (defaults to 0-100 scale)
   * @param maxScore - Optional maximum score (default 100)
   */
  setScore(score, maxScore) {
    if (maxScore !== void 0) this.scoreMax = maxScore;
    this.score = score;
    const normalized = this.scoreMax > 0 ? Math.round(score / this.scoreMax * 100) : 0;
    this.transport.setScore(normalized, 100);
  }
  // ---- Progress ----
  /**
   * Report progress through the exercise.
   * @param percentComplete - Progress 0-100
   */
  setProgress(percentComplete) {
    const clamped = Math.round(Math.min(100, Math.max(0, percentComplete)));
    this.transport.setProgress(clamped);
    this.transport.started();
  }
  // ---- Artifacts ----
  /**
   * Submit learner-generated content (code, text, files, etc.).
   */
  submitArtifact(artifact) {
    this.transport.submitArtifact(artifact);
  }
  // ---- State persistence ----
  /**
   * Save arbitrary state for resume later.
   * @param state - Any serializable object
   */
  saveState(state) {
    const serialized = JSON.stringify(state);
    this.transport.saveState(serialized);
  }
  /**
   * Load previously saved state.
   * @returns The deserialized state, or null if none exists
   */
  loadState() {
    const raw = this.transport.loadState();
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  // ---- Info ----
  /** The detected or forced environment type */
  get environment() {
    return this.env;
  }
  /** Whether an LMS was detected (not standalone) */
  get isConnected() {
    return this.env !== "noop";
  }
  // ---- Private ----
  finish(status) {
    if (this.transport instanceof PostMessageTransport) {
      this.transport.sendCompletion(status, this.score);
    } else {
      if (this.score !== null) {
        this.transport.setScore(
          this.scoreMax > 0 ? Math.round(this.score / this.scoreMax * 100) : 0,
          100
        );
      }
      this.transport.setCompletionStatus(status);
    }
  }
  static createTransport(env, options) {
    switch (env) {
      case "scorm12":
        return new Scorm12Transport();
      case "postmessage":
        return new PostMessageTransport(options.targetOrigin);
      default:
        return new NoopTransport();
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ThinkshowTracker
});
//# sourceMappingURL=index.cjs.map