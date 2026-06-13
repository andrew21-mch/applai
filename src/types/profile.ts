export type CareerLevel =
  | 'intern'
  | 'junior'
  | 'mid'
  | 'senior'
  | 'lead'
  | 'principal'
  | 'executive';

export interface CareerAnalysis {
  careerLevel: CareerLevel;
  yearsExperience: number | null;
  seniorityLabel: string;
  primaryDomain: string;
  targetRoles: string[];
  appropriateJobLevels: CareerLevel[];
  strengths: string[];
  levelReasoning: string;
  analyzedAt?: string;
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
  resumeStoragePath?: string | null;
  careerAnalysis?: CareerAnalysis | null;
  updatedAt?: string | null;
}

export interface ParsedResumeFields {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  role: string | null;
  skills: string[];
  education: string | null;
  experience: string[];
  languages: string[];
}
