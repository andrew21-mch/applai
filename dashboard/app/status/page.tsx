'use client';

import { useEffect, useState } from 'react';
import { fetchHealth, sendDigest, type HealthReport } from '@/lib/api';

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`badge badge-${ok ? 'new' : 'rejected'}`} style={{ marginLeft: '0.5rem' }}>
      {ok ? 'OK' : 'FAIL'}
    </span>
  );
}

export default function StatusPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [deep, setDeep] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState<'test' | 'digest' | null>(null);
  const [notifyResult, setNotifyResult] = useState<string | null>(null);

  async function load(runDeep = false) {
    setLoading(true);
    try {
      const data = await fetchHealth(runDeep);
      setReport(data);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(deep);
  }, [deep]);

  async function runNotification(kind: 'test' | 'digest') {
    setNotifyBusy(kind);
    setNotifyResult(null);
    try {
      const result = await sendDigest(kind === 'test' ? { test: true } : {});
      setNotifyResult(result.message);
      await load(deep);
    } catch (err) {
      setNotifyResult(err instanceof Error ? err.message : 'Notification failed');
    } finally {
      setNotifyBusy(null);
    }
  }

  const notifications = report?.services.notifications;
  const notifyConfigured =
    notifications?.details?.email === true || notifications?.details?.whatsapp === true;

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>System Status</h1>
          <p>Service health for ApplAI dependencies</p>
        </div>
        <button className="btn btn-secondary" onClick={() => load(deep)} disabled={loading}>
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </header>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
        <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} />
        Deep check (launches Playwright browser — slower)
      </label>

      {loading && !report ? (
        <p className="empty">Running health checks…</p>
      ) : !report ? (
        <div className="alert alert-error">Could not reach API at /health</div>
      ) : (
        <div className="detail-grid">
          <section className="section">
            <h2>
              Overall
              <StatusBadge ok={report.status === 'healthy'} />
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              Status: <strong>{report.status}</strong> · {new Date(report.timestamp).toLocaleString()}
            </p>
          </section>

          {Object.entries(report.services).map(([name, check]) => (
            <section key={name} className="section">
              <h2 style={{ textTransform: 'capitalize' }}>
                {name}
                <StatusBadge ok={check.ok} />
              </h2>
              <p>{check.message}</p>
              {name === 'notifications' && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  <button
                    className="btn btn-secondary"
                    disabled={!notifyConfigured || notifyBusy !== null}
                    onClick={() => runNotification('test')}
                  >
                    {notifyBusy === 'test' ? 'Sending…' : 'Send test'}
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={!notifyConfigured || notifyBusy !== null}
                    onClick={() => runNotification('digest')}
                  >
                    {notifyBusy === 'digest' ? 'Sending…' : 'Send digest now'}
                  </button>
                </div>
              )}
              {notifyResult && name === 'notifications' && (
                <p style={{ marginTop: '0.75rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
                  {notifyResult}
                </p>
              )}
              {check.details && (
                <pre style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem', overflow: 'auto' }}>
                  {JSON.stringify(check.details, null, 2)}
                </pre>
              )}
            </section>
          ))}

          {report.scheduler && (
            <section className="section">
              <h2>Scheduler</h2>
              <ul style={{ listStyle: 'none', lineHeight: 2, color: 'var(--muted)' }}>
                <li>Search: <code>{report.scheduler.search}</code></li>
                <li>Digest: <code>{report.scheduler.digest}</code></li>
                <li>Timezone: {report.scheduler.timezone}</li>
                <li>Digest min score: {report.scheduler.digestMinScore}</li>
              </ul>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                Cron runs only while the API process is running. Override with{' '}
                <code>CRON_SEARCH</code>, <code>CRON_DIGEST</code>, <code>CRON_TZ</code> in <code>.env</code>.
              </p>
            </section>
          )}

          <section className="section">
            <h2>Environment</h2>
            <ul style={{ listStyle: 'none', lineHeight: 2 }}>
              {Object.entries(report.env).map(([key, set]) => (
                <li key={key}>
                  {set ? '✓' : '✗'} {key}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
