import { EventEmitter } from 'events';

export type PipelinePhase = 'idle' | 'search' | 'filter' | 'writer' | 'complete' | 'error';
export type PipelineLogLevel = 'info' | 'success' | 'warn' | 'error';

export interface PipelineLogEntry {
  id: string;
  timestamp: string;
  phase: PipelinePhase;
  level: PipelineLogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

export interface PipelineStatus {
  running: boolean;
  phase: PipelinePhase;
  startedAt: string | null;
  finishedAt: string | null;
  summary: {
    found: number;
    scored: number;
    shortlisted: number;
    draftsWritten: number;
  };
  logs: PipelineLogEntry[];
}

const MAX_LOGS = 200;
let logCounter = 0;

const state: PipelineStatus = {
  running: false,
  phase: 'idle',
  startedAt: null,
  finishedAt: null,
  summary: { found: 0, scored: 0, shortlisted: 0, draftsWritten: 0 },
  logs: [],
};

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(event: string, data: unknown): void {
  emitter.emit(event, data);
}

function addLog(
  phase: PipelinePhase,
  message: string,
  level: PipelineLogLevel = 'info',
  meta?: Record<string, unknown>,
): PipelineLogEntry {
  const entry: PipelineLogEntry = {
    id: `log-${++logCounter}`,
    timestamp: new Date().toISOString(),
    phase,
    level,
    message,
    meta,
  };

  state.logs.push(entry);
  if (state.logs.length > MAX_LOGS) {
    state.logs = state.logs.slice(-MAX_LOGS);
  }

  emit('log', entry);
  return entry;
}

export function getPipelineStatus(): PipelineStatus {
  return { ...state, logs: [...state.logs], summary: { ...state.summary } };
}

export function isPipelineRunning(): boolean {
  return state.running;
}

export function subscribePipeline(listener: (event: { type: string; data: unknown }) => void): () => void {
  const onLog = (data: PipelineLogEntry) => listener({ type: 'log', data });
  const onPhase = (data: { phase: PipelinePhase }) => listener({ type: 'phase', data });
  const onStatus = (data: PipelineStatus) => listener({ type: 'status', data });
  const onComplete = (data: PipelineStatus) => listener({ type: 'complete', data });

  emitter.on('log', onLog);
  emitter.on('phase', onPhase);
  emitter.on('status', onStatus);
  emitter.on('complete', onComplete);

  return () => {
    emitter.off('log', onLog);
    emitter.off('phase', onPhase);
    emitter.off('status', onStatus);
    emitter.off('complete', onComplete);
  };
}

export function startPipeline(): void {
  state.running = true;
  state.phase = 'search';
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.summary = { found: 0, scored: 0, shortlisted: 0, draftsWritten: 0 };
  state.logs = [];

  addLog('search', 'Pipeline started', 'info');
  emit('phase', { phase: state.phase });
  emit('status', getPipelineStatus());
}

export function setPhase(phase: PipelinePhase): void {
  state.phase = phase;
  emit('phase', { phase });
  emit('status', getPipelineStatus());
}

export function pipelineLog(
  phase: PipelinePhase,
  message: string,
  level: PipelineLogLevel = 'info',
  meta?: Record<string, unknown>,
): void {
  addLog(phase, message, level, meta);
}

export function updateSummary(partial: Partial<PipelineStatus['summary']>): void {
  state.summary = { ...state.summary, ...partial };
  emit('status', getPipelineStatus());
}

export function completePipeline(): void {
  state.running = false;
  state.phase = 'complete';
  state.finishedAt = new Date().toISOString();

  const { found, shortlisted, draftsWritten } = state.summary;
  addLog(
    'complete',
    `Pipeline finished — ${found} new, ${shortlisted} shortlisted, ${draftsWritten} drafts written`,
    'success',
    state.summary,
  );

  emit('phase', { phase: 'complete' });
  const status = getPipelineStatus();
  emit('status', status);
  emit('complete', status);
}

export function failPipeline(error: unknown): void {
  state.running = false;
  state.phase = 'error';
  state.finishedAt = new Date().toISOString();

  const message = error instanceof Error ? error.message : 'Unknown pipeline error';
  addLog('error', `Pipeline failed: ${message}`, 'error');

  emit('phase', { phase: 'error' });
  const status = getPipelineStatus();
  emit('status', status);
  emit('complete', status);
}
