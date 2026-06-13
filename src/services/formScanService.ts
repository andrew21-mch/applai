import { chromium } from 'playwright';
import { getOpportunityById } from './supabase';
import { getActiveProfile } from './profileService';
import { navigateToApplicationForm } from '../utils/formFill';
import { scanFormFields } from '../utils/formScan';
import {
  mergeFieldsWithSuggestions,
  suggestFormFieldAnswers,
} from '../agents/formSuggestionAgent';
import { logger } from '../utils/logger';

export interface FormScanResult {
  url: string;
  fields: ReturnType<typeof mergeFieldsWithSuggestions>;
  fieldCount: number;
  pageNote?: string;
}

export async function scanOpportunityForm(opportunityId: string): Promise<FormScanResult> {
  let browser;
  try {
    const opportunity = await getOpportunityById(opportunityId);
    const application = opportunity.applications?.[0];
    const profile = await getActiveProfile();
    const coverLetter = application?.cover_letter?.trim() ?? '';

    const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
    browser = await chromium.launch({ headless });
    let page = await browser.newPage();

    await page.goto(opportunity.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const navigation = await navigateToApplicationForm(page);
    page = navigation.page;

    const fields = await scanFormFields(page);
    const suggestions = await suggestFormFieldAnswers(fields, profile, coverLetter);
    const merged = mergeFieldsWithSuggestions(fields, suggestions);

    let pageNote: string | undefined = navigation.note ?? undefined;
    if (fields.length === 0) {
      pageNote =
        'No form fields detected — page may require login, use a custom ATS, or is not a direct apply URL.';
    }

    logger.info('Form scan complete', { opportunityId, fieldCount: fields.length });

    return {
      url: page.url(),
      fields: merged,
      fieldCount: fields.length,
      pageNote,
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
