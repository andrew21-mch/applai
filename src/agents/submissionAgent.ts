import { mkdir } from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import { logger } from '../utils/logger';
import { fillApplicationForm, clickSubmitButton, navigateToApplicationForm } from '../utils/formFill';
import {
  getOpportunityById,
  markApplicationSubmitted,
  updateOpportunityStatus,
  uploadScreenshot,
} from '../services/supabase';
import { getActiveProfile, downloadActiveResumeFile } from '../services/profileService';
import { logSubmissionEvent } from '../services/submissionLog';

export interface SubmissionOptions {
  confirmSubmit?: boolean;
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

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');

async function finish(
  opportunityId: string,
  applicationId: string | null,
  action: 'preview' | 'submit',
  result: SubmissionResult,
): Promise<SubmissionResult> {
  await logSubmissionEvent(opportunityId, applicationId, action, result);
  return result;
}

/**
 * Submission Agent — MANUAL TRIGGER ONLY
 *
 * Two-step flow:
 * 1. POST /api/submit/:id (no body) — fills form, screenshots, returns for review
 * 2. POST /api/submit/:id { "confirmSubmit": true } — clicks submit after review
 */
export async function runSubmissionAgent(
  opportunityId: string,
  options: SubmissionOptions = {},
): Promise<SubmissionResult> {
  const { confirmSubmit = false } = options;
  logger.info('Submission agent started', { opportunityId, confirmSubmit });

  let browser;

  try {
    const opportunity = await getOpportunityById(opportunityId);
    const application = opportunity.applications?.[0];

    if (!application) {
      return finish(opportunityId, null, confirmSubmit ? 'submit' : 'preview', {
        success: false,
        message: 'No application draft found. Run the writer agent first.',
      });
    }

    if (opportunity.status !== 'reviewed') {
      return finish(opportunityId, application.id, confirmSubmit ? 'submit' : 'preview', {
        success: false,
        message: `Opportunity must be approved (status: reviewed) before submission. Current status: ${opportunity.status}`,
      });
    }

    await mkdir(SCREENSHOTS_DIR, { recursive: true });

    const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
    browser = await chromium.launch({ headless });
    let page = await browser.newPage();

    logger.info('Navigating to application URL', { url: opportunity.url });
    await page.goto(opportunity.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const navigation = await navigateToApplicationForm(page);
    page = navigation.page;
    if (navigation.note) {
      logger.info('Navigated toward application form', { note: navigation.note, url: page.url() });
    }

    const profile = await getActiveProfile();
    const resumeFile = await downloadActiveResumeFile();
    const coverLetter = application.cover_letter?.trim() || '';

    if (!coverLetter) {
      logger.warn('No cover letter draft — writer may not have run for this opportunity');
    }
    if (!resumeFile) {
      logger.warn('No resume file in storage — upload CV at /profile');
    }

    const { filled, missed, pageNote } = await fillApplicationForm(page, {
      name: profile.name,
      email: profile.email,
      coverLetter,
      phone: profile.phone,
      resumePath: resumeFile?.path,
    });

    logger.info('Form fill result', { filled, missed, pageNote });

    const nothingFilled = filled.length === 0;
    const resultMessage = nothingFilled
      ? pageNote ??
        'No form fields could be filled on this page. The URL may not be a direct application form.'
      : missed.length > 0
        ? `Partially filled (${filled.join(', ')}). Could not fill: ${missed.join(', ')}.`
        : 'All fields filled successfully.';

    const screenshotFilename = `${opportunityId}-${Date.now()}.png`;
    const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    let screenshotUrl: string | undefined;
    try {
      screenshotUrl = await uploadScreenshot(screenshotPath, screenshotFilename);
    } catch (err) {
      logger.warn('Screenshot upload failed, local copy saved', { screenshotPath, err });
    }

    if (!confirmSubmit) {
      await browser.close();
      browser = undefined;

      return finish(opportunityId, application.id, 'preview', {
        success: false,
        message: `${resultMessage} Review the screenshot before confirming submit.`,
        screenshotPath,
        screenshotUrl,
        filledFields: filled,
        missedFields: missed,
        pageNote,
        awaitingConfirmation: !nothingFilled,
      });
    }

    logger.info('Confirmation received — attempting submit click');
    const submitted = await clickSubmitButton(page);
    await page.waitForTimeout(3000);

    const postSubmitScreenshot = path.join(
      SCREENSHOTS_DIR,
      `${opportunityId}-submitted-${Date.now()}.png`,
    );
    await page.screenshot({ path: postSubmitScreenshot, fullPage: true });

    await browser.close();
    browser = undefined;

    if (!submitted) {
      return finish(opportunityId, application.id, 'submit', {
        success: false,
        message:
          'Could not find a submit button. Check the screenshot and submit manually on the site.',
        screenshotPath,
        screenshotUrl,
        filledFields: filled,
        missedFields: missed,
        pageNote,
      });
    }

    await markApplicationSubmitted(application.id, {
      notes: `Auto-submitted via Playwright. Filled: ${filled.join(', ')}. Missed: ${missed.join(', ') || 'none'}.`,
      screenshotUrl,
    });
    await updateOpportunityStatus(opportunityId, 'applied');

    return finish(opportunityId, application.id, 'submit', {
      success: true,
      message: `Application submitted to ${opportunity.organization ?? opportunity.title}.`,
      screenshotPath: postSubmitScreenshot,
      screenshotUrl,
      filledFields: filled,
      missedFields: missed,
    });
  } catch (err) {
    logger.error('Submission agent failed', { opportunityId, err });
    return finish(opportunityId, null, confirmSubmit ? 'submit' : 'preview', {
      success: false,
      message: err instanceof Error ? err.message : 'Unknown error during submission',
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
