export type OpportunityType = 'job' | 'scholarship';

export type OpportunityStatus = 'new' | 'reviewed' | 'applied' | 'rejected';

export interface Opportunity {
  id: string;
  title: string;
  organization: string | null;
  type: OpportunityType;
  url: string;
  deadline: string | null;
  location: string | null;
  description: string | null;
  match_score: number | null;
  status: OpportunityStatus;
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

export interface OpportunityWithApplication extends Opportunity {
  applications?: Application[];
}

export interface ExtractedOpportunity {
  title: string;
  organization: string;
  url: string;
  deadline: string | null;
  location: string;
  description: string;
  type: OpportunityType;
}
