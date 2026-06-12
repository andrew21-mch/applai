import { profileToText } from '../services/profileService';
import {
  COVER_LETTER_PROMPT,
  SCHOLARSHIP_ESSAY_PROMPT,
  fillTemplate,
} from '../../prompts';
import { complete } from '../services/ollama';
import { pipelineLog, updateSummary } from '../services/pipelineStatus';
import { getShortlistedWithoutApplication, insertApplication } from '../services/supabase';
import { logger } from '../utils/logger';

export async function runWriterAgent(): Promise<number> {
  logger.info('Writer agent started');

  const opportunities = await getShortlistedWithoutApplication();
  pipelineLog(
    'writer',
    `Writer agent started — generating drafts for ${opportunities.length} opportunities`,
  );

  if (opportunities.length === 0) {
    pipelineLog('writer', 'No shortlisted opportunities need drafts', 'warn');
    return 0;
  }

  let writtenCount = 0;

  for (const opp of opportunities) {
    pipelineLog('writer', `Writing cover letter for: ${opp.title}…`);

    try {
      const profile = await profileToText();
      const commonVars = {
        PROFILE: profile,
        TITLE: opp.title,
        ORGANIZATION: opp.organization ?? 'the organization',
        LOCATION: opp.location ?? 'Remote',
        DESCRIPTION: opp.description ?? 'No description available',
        DEADLINE: opp.deadline ?? 'Not specified',
      };

      const coverLetterPrompt = fillTemplate(COVER_LETTER_PROMPT, commonVars);
      const coverLetter = await complete(coverLetterPrompt, 1024);

      let essay: string | null = null;
      if (opp.type === 'scholarship') {
        pipelineLog('writer', `Writing personal statement for scholarship: ${opp.title}…`);
        const essayPrompt = fillTemplate(SCHOLARSHIP_ESSAY_PROMPT, commonVars);
        essay = await complete(essayPrompt, 1024);
      }

      await insertApplication(opp.id, coverLetter, essay);
      writtenCount++;
      updateSummary({ draftsWritten: writtenCount });

      pipelineLog('writer', `Draft saved: ${opp.title}`, 'success', {
        type: opp.type,
        hasEssay: !!essay,
      });

      logger.info('Application draft created', {
        title: opp.title,
        type: opp.type,
        hasEssay: !!essay,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'write failed';
      pipelineLog('writer', `Failed to write for "${opp.title}": ${msg}`, 'error');
      logger.error('Failed to write application', { id: opp.id, title: opp.title, err });
    }
  }

  pipelineLog('writer', `Writer complete — ${writtenCount} drafts created`, 'success');
  logger.info('Writer agent completed', { writtenCount });
  return writtenCount;
}
