'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getPipelineStatus,
  subscribePipeline,
  type PipelineLogEntry,
  type PipelineStatus,
} from '@/lib/api';

const PHASE_LABELS: Record<string, string> = {
  idle: 'Idle',
  search: 'Search',
  filter: 'Filter',
  writer: 'Writer',
  complete: 'Complete',
  error: 'Error',
};

interface PipelinePanelProps {
  active: boolean;
  onComplete?: () => void;
}

export default function PipelinePanel({ active, onComplete }: PipelinePanelProps) {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    getPipelineStatus().then(setStatus).catch(() => undefined);

    const unsubscribe = subscribePipeline((event) => {
      if (event.type === 'status' || event.type === 'complete') {
        setStatus(event.data as PipelineStatus);
        if (event.type === 'complete') {
          onComplete?.();
        }
      }
      if (event.type === 'log') {
        setStatus((prev) => {
          if (!prev) return prev;
          const entry = event.data as PipelineLogEntry;
          return { ...prev, logs: [...prev.logs, entry] };
        });
      }
      if (event.type === 'phase') {
        const { phase } = event.data as { phase: string };
        setStatus((prev) => (prev ? { ...prev, phase: phase as PipelineStatus['phase'] } : prev));
      }
    });

    return unsubscribe;
  }, [active, onComplete]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [status?.logs.length]);

  if (!active && (!status || status.phase === 'idle')) {
    return null;
  }

  const phase = status?.phase ?? 'idle';
  const summary = status?.summary;

  return (
    <section className="pipeline-panel">
      <div className="pipeline-header">
        <div>
          <h2>Search Pipeline</h2>
          <p className="pipeline-phase">
            {status?.running ? (
              <span className="pipeline-spinner" />
            ) : null}
            Phase: <strong>{PHASE_LABELS[phase] ?? phase}</strong>
          </p>
        </div>
        {summary && (
          <div className="pipeline-stats">
            <span>{summary.found} found</span>
            <span>{summary.scored} scored</span>
            <span>{summary.shortlisted} shortlisted</span>
            <span>{summary.draftsWritten} drafts</span>
          </div>
        )}
      </div>

      <div className="pipeline-steps">
        {(['search', 'filter', 'writer', 'complete'] as const).map((step) => (
          <div
            key={step}
            className={`pipeline-step ${
              phase === step ? 'active' : ''
            } ${isStepDone(step, phase) ? 'done' : ''}`}
          >
            {PHASE_LABELS[step]}
          </div>
        ))}
      </div>

      <div className="pipeline-logs">
        {(status?.logs ?? []).map((log) => (
          <div key={log.id} className={`pipeline-log pipeline-log-${log.level}`}>
            <span className="pipeline-log-time">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={`pipeline-log-phase badge badge-${log.phase === 'error' ? 'rejected' : 'new'}`}>
              {log.phase}
            </span>
            <span className="pipeline-log-msg">{log.message}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </section>
  );
}

function isStepDone(step: string, current: string): boolean {
  const order = ['search', 'filter', 'writer', 'complete'];
  const stepIdx = order.indexOf(step);
  const currentIdx = order.indexOf(current);
  if (current === 'error') return stepIdx < currentIdx;
  if (current === 'complete') return stepIdx <= order.indexOf('complete');
  return stepIdx < currentIdx;
}
