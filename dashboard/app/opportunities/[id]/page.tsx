'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  approveOpportunity,
  confirmSubmission,
  fetchOpportunity,
  prepareSubmission,
  rejectOpportunity,
  type OpportunityDetail,
  type SubmissionResult,
} from '@/lib/api';

export default function OpportunityDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [opp, setOpp] = useState<OpportunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchOpportunity(id);
      setOpp(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleApprove() {
    if (!confirm('Approve and preview form fill? Nothing will be submitted yet.')) {
      return;
    }
    setActionLoading(true);
    setSubmission(null);
    try {
      const result = await approveOpportunity(id);
      setSubmission(result.submission ?? null);
      setMessage(result.message);
      setMessageType('info');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Approve failed');
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    setActionLoading(true);
    try {
      await rejectOpportunity(id);
      setMessage('Opportunity rejected.');
      setMessageType('info');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Reject failed');
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePrepareSubmit() {
    setActionLoading(true);
    setSubmission(null);
    try {
      const result = await prepareSubmission(id);
      setSubmission(result);
      setMessage(result.message);
      setMessageType(result.awaitingConfirmation ? 'info' : result.success ? 'success' : 'error');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Prepare submission failed');
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmSubmit() {
    if (!confirm('Are you sure you want to submit this application? This cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const result = await confirmSubmission(id);
      setSubmission(result);
      setMessage(result.message);
      setMessageType(result.success ? 'success' : 'error');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Submit failed');
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <p className="empty">Loading…</p>
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="container">
        <p className="empty">Opportunity not found.</p>
        <Link href="/" className="back-link">← Back to list</Link>
      </div>
    );
  }

  const application = opp.applications?.[0];

  return (
    <div className="container">
      <Link href="/" className="back-link">← Back to opportunities</Link>

      <header className="header">
        <div>
          <h1>{opp.title}</h1>
          <div className="meta" style={{ marginTop: '0.5rem' }}>
            <span>{opp.organization ?? 'Unknown'}</span>
            <span>{opp.location ?? 'Remote'}</span>
            {opp.match_score !== null && <span className="score">{opp.match_score}/100</span>}
            <span className={`badge badge-${opp.type}`}>{opp.type}</span>
            <span className={`badge badge-${opp.status}`}>{opp.status}</span>
          </div>
        </div>
      </header>

      {message && (
        <div className={`alert alert-${messageType === 'error' ? 'error' : messageType === 'success' ? 'success' : 'info'}`}>
          {message}
        </div>
      )}

      <div className="detail-grid">
        <section className="section">
          <h2>Details</h2>
          <p className="prose">{opp.description ?? 'No description available.'}</p>
          <div className="meta" style={{ marginTop: '1rem' }}>
            {opp.deadline && <span>Deadline: {new Date(opp.deadline).toLocaleDateString()}</span>}
            <a href={opp.url} target="_blank" rel="noopener noreferrer">View listing →</a>
          </div>
        </section>

        {application?.cover_letter && (
          <section className="section">
            <h2>Cover Letter Draft</h2>
            <p className="prose">{application.cover_letter}</p>
          </section>
        )}

        {application?.essay && (
          <section className="section">
            <h2>Personal Statement Draft</h2>
            <p className="prose">{application.essay}</p>
          </section>
        )}

        {submission?.screenshotUrl && (
          <section className="section">
            <h2>Submission Screenshot</h2>
            <a href={submission.screenshotUrl} target="_blank" rel="noopener noreferrer">
              View screenshot →
            </a>
          </section>
        )}

        {submission && (submission.filledFields || submission.missedFields) && (
          <section className="section">
            <h2>Form Fill Report</h2>
            <p>Filled: {submission.filledFields?.join(', ') || 'none'}</p>
            <p>Missed: {submission.missedFields?.join(', ') || 'none'}</p>
            {submission.pageNote && (
              <p style={{ color: 'var(--warning)', marginTop: '0.75rem', fontSize: '0.9rem' }}>
                {submission.pageNote}
              </p>
            )}
          </section>
        )}
      </div>

      <div className="actions">
        {opp.status === 'new' && (
          <>
            <button className="btn btn-success" onClick={handleApprove} disabled={actionLoading}>
              {actionLoading ? 'Previewing…' : 'Approve & Preview'}
            </button>
            <button className="btn btn-danger" onClick={handleReject} disabled={actionLoading}>
              Reject
            </button>
          </>
        )}

        {opp.status === 'reviewed' && (
          <>
            <button className="btn" onClick={handlePrepareSubmit} disabled={actionLoading}>
              {actionLoading ? 'Preparing…' : 'Prepare Submission'}
            </button>
            {submission?.awaitingConfirmation && (
              <button className="btn btn-success" onClick={handleConfirmSubmit} disabled={actionLoading}>
                Confirm & Submit
              </button>
            )}
            <button className="btn btn-danger" onClick={handleReject} disabled={actionLoading}>
              Reject
            </button>
          </>
        )}

        {opp.status === 'applied' && (
          <span style={{ color: 'var(--success)' }}>✓ Application submitted</span>
        )}
      </div>
    </div>
  );
}
