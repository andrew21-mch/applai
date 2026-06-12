const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface Opportunity {
  id: string;
  title: string;
  organization: string | null;
  type: 'job' | 'scholarship';
  url: string;
  deadline: string | null;
  location: string | null;
  description: string | null;
  match_score: number | null;
  status: 'new' | 'reviewed' | 'applied' | 'rejected';
  created_at: string;
}

export interface Application {
  id: string;
  opportunity_id: string;
  cover_letter: string | null;
  essay: string | null;
  cv_version: string | null;
  submitted_at: string | null;
  response: string | null;
  notes: string | null;
  created_at: string;
}

export interface OpportunityDetail extends Opportunity {
  applications: Application[];
}

export interface SubmissionResult {
  success: boolean;
  message: string;
  screenshotPath?: string;
  screenshotUrl?: string;
  filledFields?: string[];
  missedFields?: string[];
  pageNote?: string;
  awaitingConfirmation?: boolean;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json();
  if (!res.ok && res.status !== 202) {
    throw new Error(data.error ?? data.message ?? 'Request failed');
  }
  return data;
}

export async function fetchOpportunities(params?: {
  status?: string;
  type?: string;
  minScore?: number;
}): Promise<Opportunity[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.type) search.set('type', params.type);
  if (params?.minScore !== undefined) search.set('minScore', String(params.minScore));

  const qs = search.toString();
  const result = await request<{ data: Opportunity[] }>(
    `/api/opportunities${qs ? `?${qs}` : ''}`,
  );
  return result.data;
}

export async function fetchOpportunity(id: string): Promise<OpportunityDetail> {
  const result = await request<{ data: OpportunityDetail }>(`/api/opportunities/${id}`);
  return result.data;
}

export async function approveOpportunity(id: string): Promise<{
  data: Opportunity;
  submission?: SubmissionResult;
  message: string;
  dryRun?: boolean;
}> {
  return request(`/api/opportunities/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ apply: false }),
  });
}

export interface SubmissionLogEntry {
  id: string;
  opportunity_id: string;
  application_id: string | null;
  action: 'preview' | 'submit';
  success: boolean;
  message: string | null;
  filled_fields: string[];
  missed_fields: string[];
  screenshot_url: string | null;
  created_at: string;
  opportunities?: {
    title: string;
    organization: string | null;
    url: string;
    status: string;
  };
}

export async function fetchSubmissionHistory(): Promise<SubmissionLogEntry[]> {
  const result = await request<{ data: SubmissionLogEntry[] }>('/api/history');
  return result.data;
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  env: Record<string, boolean>;
  services: Record<string, { ok: boolean; message: string; details?: Record<string, unknown> }>;
  scheduler?: {
    search: string;
    digest: string;
    timezone: string;
    digestMinScore: string;
  };
}

export async function fetchHealth(deep = false): Promise<HealthReport> {
  const res = await fetch(`${API_URL}/health?deep=${deep}`);
  return res.json();
}

export async function rescoreOpportunities() {
  return request<{ message: string; shortlisted: number }>('/api/opportunities/rescore', {
    method: 'POST',
  });
}

export async function clearOpportunities(keepApplied = true) {
  return request<{ message: string; deleted: number }>('/api/opportunities/clear', {
    method: 'POST',
    body: JSON.stringify({ keepApplied }),
  });
}

export async function rejectOpportunity(id: string) {
  return request(`/api/opportunities/${id}/reject`, { method: 'POST' });
}

export async function prepareSubmission(id: string): Promise<SubmissionResult> {
  return request<SubmissionResult>(`/api/submit/${id}`, { method: 'POST' });
}

export async function confirmSubmission(id: string): Promise<SubmissionResult> {
  return request<SubmissionResult>(`/api/submit/${id}`, {
    method: 'POST',
    body: JSON.stringify({ confirmSubmit: true }),
  });
}

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  role: string;
  skills: string[];
  education: string;
  experience: string[];
  languages: string[];
  jobTypes: string[];
  scholarshipTypes: string[];
  salaryExpectation: string;
  rawResumeText?: string | null;
  resumeFilename?: string | null;
  updatedAt?: string | null;
}

export async function fetchProfile(): Promise<UserProfile> {
  const result = await request<{ data: UserProfile }>('/api/profile');
  return result.data;
}

export async function uploadResume(file: File): Promise<{ message: string; data: UserProfile }> {
  const form = new FormData();
  form.append('resume', file);

  const res = await fetch(`${API_URL}/api/profile/resume`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Upload failed');
  return data;
}

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

export async function getPipelineStatus(): Promise<PipelineStatus> {
  const result = await request<{ data: PipelineStatus }>('/api/pipeline/status');
  return result.data;
}

export function subscribePipeline(
  onEvent: (event: { type: string; data: unknown }) => void,
): () => void {
  const source = new EventSource(`${API_URL}/api/pipeline/stream`);

  source.onmessage = (event) => {
    try {
      onEvent(JSON.parse(event.data));
    } catch {
      // ignore malformed events
    }
  };

  source.onerror = () => {
    source.close();
  };

  return () => source.close();
}

export async function runSearch() {
  return request<{ message: string; data: PipelineStatus }>('/api/run-search', { method: 'POST' });
}

export async function sendDigest(options?: { test?: boolean; minScore?: number }) {
  return request<{ message: string; count?: number; test?: boolean }>('/api/send-digest', {
    method: 'POST',
    body: JSON.stringify(options ?? {}),
  });
}
