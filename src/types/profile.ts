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
