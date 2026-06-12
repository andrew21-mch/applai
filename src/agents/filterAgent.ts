import { profileToText, getActiveProfile } from '../services/profileService';
import { FILTER_SCORE_PROMPT, fillTemplate } from '../../prompts';
import { completeJson } from '../services/ollama';
import { pipelineLog, updateSummary } from '../services/pipelineStatus';
import { getOpportunitiesWithoutScore, updateMatchScore } from '../services/supabase';
import { blendScores, computeRuleBasedScore, extractLlmScore } from '../utils/matchScore';
import { logger } from '../utils/logger';

const MIN_SCORE = 60;

interface ScoreResult {
  score?: number;
  match_score?: number;
  reasoning?: string;
}

export async function runFilterAgent(): Promise<number> {
  logger.info('Filter agent started');

  const profile = await getActiveProfile();
  const opportunities = await getOpportunitiesWithoutScore();
  pipelineLog(
    'filter',
    `Filter agent started — scoring ${opportunities.length} opportunities with Ollama`,
  );

  if (opportunities.length === 0) {
    pipelineLog('filter', 'No unscored opportunities to filter', 'warn');
    return 0;
  }

  let scoredCount = 0;
  let shortlistedCount = 0;

  for (const opp of opportunities) {
    pipelineLog('filter', `Scoring: ${opp.title}…`);

    try {
      const ruleScore = computeRuleBasedScore(profile, opp);
      let llmScore: number | null = null;
      let reasoning = `Rule-based: ${ruleScore}/100 (skill & role overlap)`;

      try {
        const prompt = fillTemplate(FILTER_SCORE_PROMPT, {
          PROFILE: await profileToText(),
          TITLE: opp.title,
          ORGANIZATION: opp.organization ?? 'Unknown',
          TYPE: opp.type,
          LOCATION: opp.location ?? 'Not specified',
          DEADLINE: opp.deadline ?? 'Not specified',
          DESCRIPTION: opp.description ?? 'No description available',
        });

        const result = await completeJson<ScoreResult>(prompt);
        llmScore = extractLlmScore(result);
        if (result.reasoning) reasoning = result.reasoning;
      } catch (llmErr) {
        pipelineLog('filter', `Ollama score failed for "${opp.title}", using rule-based`, 'warn');
        logger.warn('LLM scoring failed, using rule-based', { id: opp.id, err: llmErr });
      }

      const score = Math.min(100, Math.max(0, blendScores(ruleScore, llmScore)));

      await updateMatchScore(opp.id, score);
      scoredCount++;
      updateSummary({ scored: scoredCount });

      if (score >= MIN_SCORE) {
        shortlistedCount++;
        updateSummary({ shortlisted: shortlistedCount });
        pipelineLog('filter', `Shortlisted (${score}/100): ${opp.title}`, 'success', {
          score,
          ruleScore,
          llmScore,
          reasoning,
        });
        logger.info('Opportunity shortlisted', {
          title: opp.title,
          score,
          ruleScore,
          llmScore,
          reasoning,
        });
      } else {
        pipelineLog('filter', `Below threshold (${score}/100): ${opp.title}`, 'warn', {
          score,
          ruleScore,
          llmScore,
          reasoning,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'scoring failed';
      pipelineLog('filter', `Failed to score "${opp.title}": ${msg}`, 'error');
      logger.error('Failed to score opportunity', { id: opp.id, title: opp.title, err });
    }
  }

  pipelineLog(
    'filter',
    `Filter complete — ${scoredCount} scored, ${shortlistedCount} shortlisted (≥${MIN_SCORE})`,
    'success',
  );
  logger.info('Filter agent completed', { scoredCount, shortlistedCount });
  return shortlistedCount;
}

export { MIN_SCORE };
