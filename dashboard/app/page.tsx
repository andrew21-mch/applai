'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PipelinePanel from '@/components/PipelinePanel';
import {
  clearOpportunities,
  fetchOpportunities,
  getPipelineStatus,
  rescoreOpportunities,
  runSearch,
  type Opportunity,
} from '@/lib/api';

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pipelineActive, setPipelineActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [message, setMessage] = useState('');
  const [clearing, setClearing] = useState(false);
  const [rescoring, setRescoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOpportunities({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        minScore: minScore ? parseInt(minScore, 10) : undefined,
      });
      setOpportunities(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, minScore]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getPipelineStatus()
      .then((s) => {
        if (s.running) setPipelineActive(true);
      })
      .catch(() => undefined);
  }, []);

  async function handleRunSearch() {
    setMessage('');
    try {
      const result = await runSearch();
      setPipelineActive(true);
      setMessage(result.message ?? 'Search pipeline started.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Search failed');
    }
  }

  async function handleRescore() {
    setRescoring(true);
    setMessage('');
    try {
      const result = await rescoreOpportunities();
      setMessage(result.message);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Rescore failed');
    } finally {
      setRescoring(false);
    }
  }

  async function handleClear() {
    if (!confirm('Clear all crawled opportunities? Applied ones will be kept.')) return;
    setClearing(true);
    setMessage('');
    try {
      const result = await clearOpportunities(true);
      setMessage(result.message);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setClearing(false);
    }
  }

  function handlePipelineComplete() {
    setPipelineActive(false);
    load();
    setMessage('Pipeline finished — list refreshed.');
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>ApplAI</h1>
          <p>Review matched jobs and scholarships</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleRescore} disabled={rescoring || pipelineActive}>
            {rescoring ? 'Scoring…' : 'Rescore all'}
          </button>
          <button className="btn btn-danger" onClick={handleClear} disabled={clearing || pipelineActive}>
            {clearing ? 'Clearing…' : 'Clear crawled'}
          </button>
          <button className="btn" onClick={handleRunSearch} disabled={pipelineActive}>
          {pipelineActive ? 'Pipeline running…' : 'Run Search'}
          </button>
        </div>
      </header>

      {message && <div className="alert alert-info">{message}</div>}

      <PipelinePanel active={pipelineActive} onComplete={handlePipelineComplete} />

      <div className="filters">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="applied">Applied</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="job">Jobs</option>
          <option value="scholarship">Scholarships</option>
        </select>
        <select value={minScore} onChange={(e) => setMinScore(e.target.value)}>
          <option value="">Any score</option>
          <option value="60">Score ≥ 60</option>
          <option value="70">Score ≥ 70</option>
          <option value="80">Score ≥ 80</option>
        </select>
      </div>

      {loading ? (
        <p className="empty">Loading opportunities…</p>
      ) : opportunities.length === 0 ? (
        <p className="empty">
          No opportunities match your filters.
          {(statusFilter || typeFilter || minScore) && ' Try clearing filters or lowering the score threshold.'}
          {!statusFilter && !typeFilter && !minScore && ' Run a search to get started.'}
        </p>
      ) : (
        opportunities.map((opp) => (
          <Link key={opp.id} href={`/opportunities/${opp.id}`} style={{ textDecoration: 'none' }}>
            <article className="card">
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ color: 'var(--text)' }}>
                    {opp.title}
                  </div>
                  <div className="meta" style={{ marginTop: '0.35rem' }}>
                    <span>{opp.organization ?? 'Unknown org'}</span>
                    <span>{opp.location ?? 'Remote'}</span>
                    {opp.match_score !== null && (
                      <span className="score">{opp.match_score}/100</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className={`badge badge-${opp.type}`}>{opp.type}</span>
                  <span className={`badge badge-${opp.status}`}>{opp.status}</span>
                </div>
              </div>
              {opp.description && (
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                  {opp.description.slice(0, 180)}
                  {opp.description.length > 180 ? '…' : ''}
                </p>
              )}
            </article>
          </Link>
        ))
      )}
    </div>
  );
}
