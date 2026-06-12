'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchProfile, uploadResume, type UserProfile } from '@/lib/api';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');

  useEffect(() => {
    fetchProfile()
      .then(setProfile)
      .catch((err) => {
        setMessage(err instanceof Error ? err.message : 'Failed to load profile');
        setMessageType('error');
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage('');
    try {
      const result = await uploadResume(file);
      setProfile(result.data);
      setMessage(result.message);
      setMessageType('success');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed');
      setMessageType('error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="container">
      <Link href="/" className="back-link">← Back to opportunities</Link>

      <header className="header">
        <div>
          <h1>My Profile</h1>
          <p>Upload your resume — skills and experience are extracted automatically</p>
        </div>
      </header>

      <section className="section" style={{ marginBottom: '1.5rem' }}>
        <h2>Upload Resume</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Supported: PDF, DOCX, TXT (max 5MB). Skills are extracted and used for search, filtering, and cover letters.
          Uploading a new resume replaces the previous one — only the latest is active.
        </p>
        <label className="btn" style={{ display: 'inline-block', cursor: uploading ? 'wait' : 'pointer' }}>
          {uploading ? 'Parsing resume…' : 'Choose resume file'}
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </section>

      {message && (
        <div className={`alert alert-${messageType === 'error' ? 'error' : messageType === 'success' ? 'success' : 'info'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <p className="empty">Loading profile…</p>
      ) : profile ? (
        <div className="detail-grid">
          <section className="section">
            <h2>Basic Info</h2>
            <p><strong>Name:</strong> {profile.name}</p>
            <p><strong>Role:</strong> {profile.role}</p>
            <p><strong>Location:</strong> {profile.location}</p>
            <p><strong>Email:</strong> {profile.email || '—'}</p>
            {profile.resumeFilename && (
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
                Resume: {profile.resumeFilename}
                {profile.updatedAt && ` · updated ${new Date(profile.updatedAt).toLocaleString()}`}
              </p>
            )}
          </section>

          <section className="section">
            <h2>Skills ({profile.skills.length})</h2>
            {profile.skills.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {profile.skills.map((s) => (
                  <span key={s} className="badge badge-new">{s}</span>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)' }}>No skills yet — upload a resume</p>
            )}
          </section>

          <section className="section">
            <h2>Education</h2>
            <p className="prose">{profile.education || 'Not specified'}</p>
          </section>

          <section className="section">
            <h2>Experience</h2>
            {profile.experience.length > 0 ? (
              <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
                {profile.experience.map((exp, i) => (
                  <li key={i}>{exp}</li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--muted)' }}>Not specified</p>
            )}
          </section>

          <section className="section">
            <h2>Job Preferences</h2>
            <p><strong>Target roles:</strong> {profile.jobTypes.join(', ')}</p>
            <p><strong>Scholarships:</strong> {profile.scholarshipTypes.join(', ')}</p>
            <p><strong>Salary:</strong> {profile.salaryExpectation}</p>
          </section>
        </div>
      ) : (
        <p className="empty">
          Could not load profile. Make sure the API is running on port 4000, then refresh.
        </p>
      )}
    </div>
  );
}
