'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchSubmissionHistory, type SubmissionLogEntry } from '@/lib/api';

export default function HistoryPage() {
  const [logs, setLogs] = useState<SubmissionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubmissionHistory()
      .then(setLogs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>Application History</h1>
          <p>Audit log of form previews and submissions</p>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="empty">Loading history…</p>
      ) : logs.length === 0 ? (
        <p className="empty">
          No submission events yet. Approve an opportunity to preview a form fill.
          {' '}Run <code>supabase/submission_logs.sql</code> if the table is missing.
        </p>
      ) : (
        logs.map((log) => {
          const opp = log.opportunities;
          return (
            <article key={log.id} className="card" style={{ marginBottom: '0.75rem' }}>
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ color: 'var(--text)' }}>
                    {opp?.title ?? 'Unknown opportunity'}
                  </div>
                  <div className="meta" style={{ marginTop: '0.35rem' }}>
                    <span>{opp?.organization ?? '—'}</span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className={`badge badge-${log.action === 'submit' ? 'applied' : 'reviewed'}`}>
                    {log.action}
                  </span>
                  <span className={`badge badge-${log.success ? 'new' : 'rejected'}`}>
                    {log.success ? 'success' : 'failed'}
                  </span>
                </div>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                {log.message}
              </p>
              <div className="meta" style={{ marginTop: '0.5rem' }}>
                <span>Filled: {(log.filled_fields ?? []).join(', ') || 'none'}</span>
                <span>Missed: {(log.missed_fields ?? []).join(', ') || 'none'}</span>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem' }}>
                {log.screenshot_url && (
                  <a href={log.screenshot_url} target="_blank" rel="noopener noreferrer">
                    Screenshot →
                  </a>
                )}
                {log.opportunity_id && (
                  <Link href={`/opportunities/${log.opportunity_id}`}>View opportunity →</Link>
                )}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
