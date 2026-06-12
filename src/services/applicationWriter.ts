import { COVER_LETTER_PROMPT, SCHOLARSHIP_ESSAY_PROMPT, fillTemplate } from '../../prompts';
import { complete } from './ollama';
import { profileToText } from './profileService';
import { getOpportunityById, insertApplication } from './supabase';
import type { Application } from '../types';

export async function writeDraftForOpportunity(opportunityId: string): Promise<Application> {
  const opportunity = await getOpportunityById(opportunityId);
  const existing = opportunity.applications?.[0];
  if (existing) return existing;

  const profile = await profileToText();
  const vars = {
    PROFILE: profile,
    TITLE: opportunity.title,
    ORGANIZATION: opportunity.organization ?? 'the organization',
    LOCATION: opportunity.location ?? 'Remote',
    DESCRIPTION: opportunity.description ?? 'No description available',
    DEADLINE: opportunity.deadline ?? 'Not specified',
  };

  const coverLetter = await complete(fillTemplate(COVER_LETTER_PROMPT, vars), 1024);
  let essay: string | null = null;
  if (opportunity.type === 'scholarship') {
    essay = await complete(fillTemplate(SCHOLARSHIP_ESSAY_PROMPT, vars), 1024);
  }

  return insertApplication(opportunity.id, coverLetter, essay);
}
