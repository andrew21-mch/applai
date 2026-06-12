import { loadEnv, requireEnv } from '../config/env';
import { tavily } from '@tavily/core';
import { getSearchQueries } from '../config/sources';
import { getActiveProfile } from '../services/profileService';
import { EXTRACT_OPPORTUNITY_PROMPT, fillTemplate } from '../../prompts';
import { completeJson } from '../services/ollama';
import {
  pipelineLog,
  setPhase,
  startPipeline,
  completePipeline,
  failPipeline,
  updateSummary,
} from '../services/pipelineStatus';
import { getExistingUrls, insertOpportunity } from '../services/supabase';
import { runFilterAgent } from './filterAgent';
import { runWriterAgent } from './writerAgent';
import { logger } from '../utils/logger';
import { isSavableJobUrl } from '../utils/applicationUrls';
import type { ExtractedOpportunity, OpportunityType } from '../types';

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
}

interface ExtractedFields {
  title: string;
  organization: string;
  url: string;
  deadline: string | null;
  location: string;
  description: string;
}

async function searchTavily(query: string): Promise<TavilyResult[]> {
  const apiKey = requireEnv('TAVILY_API_KEY');
  try {
    const client = tavily({ apiKey });
    const response = await client.search(query, {
      searchDepth: 'advanced',
      maxResults: 10,
      includeAnswer: false,
    });

    return (response.results ?? []) as TavilyResult[];
  } catch (err) {
    logger.error('Tavily search failed', { query, err });
    throw err;
  }
}

async function extractOpportunity(
  result: TavilyResult,
  type: OpportunityType,
): Promise<ExtractedOpportunity | null> {
  const content = [
    `Title: ${result.title ?? 'Unknown'}`,
    `URL: ${result.url ?? ''}`,
    result.content ?? result.raw_content ?? '',
  ].join('\n\n');

  if (!content.trim() || content.length < 50) {
    return null;
  }

  pipelineLog('search', `Extracting details with Ollama: ${result.title ?? 'untitled'}…`);

  try {
    const prompt = fillTemplate(EXTRACT_OPPORTUNITY_PROMPT, {
      CONTENT: content,
      TYPE: type,
    });

    const extracted = await completeJson<ExtractedFields>(prompt);

    if (!extracted.title || !extracted.url) {
      pipelineLog('search', 'Skipped — could not extract required fields', 'warn');
      return null;
    }

    return {
      title: extracted.title,
      organization: extracted.organization || 'Unknown',
      url: extracted.url || result.url || '',
      deadline: extracted.deadline,
      location: extracted.location || 'Remote',
      description: extracted.description || content.slice(0, 500),
      type,
    };
  } catch {
    const title = (result.title ?? '').replace(/…+$/, '').trim();
    const url = result.url ?? '';
    if (!title || !url) return null;

    let org = 'Unknown';
    try {
      org = new URL(url).hostname.replace(/^www\./, '').split('.')[0];
      org = org.charAt(0).toUpperCase() + org.slice(1);
    } catch { /* keep Unknown */ }

    pipelineLog('search', `Ollama failed, saving from Tavily: ${title.slice(0, 60)}`, 'warn');
    return {
      title,
      organization: org,
      url,
      deadline: null,
      location: /remote/i.test(result.content ?? '') ? 'Remote' : 'Not specified',
      description: (result.content ?? result.raw_content ?? title).slice(0, 500),
      type,
    };
  }
}

export async function runSearchAgent(): Promise<number> {
  logger.info('Search agent started');
  pipelineLog('search', 'Search agent started — querying job boards & scholarship sites');

  const existingUrls = await getExistingUrls();
  let newCount = 0;

  const profile = await getActiveProfile();
  const searchQueries = getSearchQueries(profile);

  if (searchQueries.length === 0) {
    pipelineLog(
      'search',
      'No search queries — upload your resume at /profile first (search uses only your CV data)',
      'warn',
    );
    updateSummary({ found: 0 });
    pipelineLog('search', 'Search skipped — no resume profile', 'warn');
    logger.warn('Search skipped — no resume uploaded');
    return 0;
  }

  pipelineLog(
    'search',
    `Resume-based search — ${searchQueries.length} queries (${profile.skills.length} skills, role: ${profile.role || 'from experience'})`,
    'info',
  );

  for (const { query, type } of searchQueries) {
    pipelineLog('search', `Tavily search (${type}): ${query.slice(0, 80)}…`);

    try {
      const results = await searchTavily(query);
      pipelineLog('search', `Got ${results.length} results for ${type} query`, 'info', { type });

      for (const result of results) {
        const url = result.url ?? '';
        if (!url || existingUrls.has(url)) {
          if (url && existingUrls.has(url)) {
            pipelineLog('search', `Skipped duplicate: ${result.title ?? url}`, 'warn');
          }
          continue;
        }

        if (type === 'job' && !isSavableJobUrl(url)) {
          pipelineLog('search', `Skipped listing (not an apply URL): ${url.slice(0, 70)}…`, 'warn');
          continue;
        }

        const opportunity = await extractOpportunity(result, type);
        if (!opportunity) continue;

        if (type === 'job' && !isSavableJobUrl(opportunity.url)) {
          pipelineLog('search', `Skipped after extract — not an apply URL: ${opportunity.url.slice(0, 70)}…`, 'warn');
          continue;
        }

        const saved = await insertOpportunity(opportunity);
        if (saved) {
          existingUrls.add(url);
          newCount++;
          pipelineLog('search', `Saved: ${saved.title}`, 'success', {
            organization: saved.organization,
            type: saved.type,
          });
          logger.info('Saved new opportunity', { title: saved.title, url: saved.url });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'search failed';
      pipelineLog('search', `Query failed: ${msg}`, 'error', { query });
      logger.error('Search query failed', { query, err });
    }
  }

  updateSummary({ found: newCount });
  pipelineLog('search', `Search complete — ${newCount} new opportunities`, 'success');
  logger.info('Search agent completed', { newCount });
  return newCount;
}

export async function runSearchPipeline(): Promise<void> {
  loadEnv();
  requireEnv('TAVILY_API_KEY');

  logger.info('Running full search pipeline');
  startPipeline();

  try {
    const newCount = await runSearchAgent();

    setPhase('filter');
    const shortlisted = await runFilterAgent();

    setPhase('writer');
    const draftsWritten = await runWriterAgent();

    updateSummary({ shortlisted, draftsWritten });
    completePipeline();
    logger.info('Search pipeline completed', { newCount, shortlisted, draftsWritten });
  } catch (err) {
    failPipeline(err);
    logger.error('Search pipeline failed', err);
    throw err;
  }
}
