import type { Frame, Page } from 'playwright';
import { isApplicationUrl } from './applicationUrls';

type FillContext = Page | Frame;

function contexts(page: Page): FillContext[] {
  return [page, ...page.frames().filter((f) => f !== page.mainFrame())];
}

async function scrollIntoView(locator: ReturnType<Page['locator']>): Promise<void> {
  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 2000 });
  } catch {
    // ignore
  }
}

async function tryFillField(
  locator: ReturnType<Page['locator']>,
  value: string,
): Promise<boolean> {
  if (!value.trim()) return false;
  try {
    if ((await locator.count()) === 0) return false;
    if (!(await locator.isVisible())) return false;
    await scrollIntoView(locator);

    const tag = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    const editable = await locator.getAttribute('contenteditable').catch(() => null);

    if (tag === 'textarea' || tag === 'input') {
      await locator.fill(value, { timeout: 5000 });
      return true;
    }

    if (editable === 'true' || tag === 'div') {
      await locator.click({ timeout: 3000 });
      await locator.evaluate((el, text) => {
        const node = el as { focus(): void; textContent: string | null; dispatchEvent(e: Event): void };
        node.focus();
        node.textContent = text;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
      return true;
    }

    await locator.fill(value, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function tryFill(
  ctx: FillContext,
  selectors: string[],
  value: string,
): Promise<boolean> {
  if (!value.trim()) return false;

  for (const selector of selectors) {
    try {
      const locator = ctx.locator(selector).first();
      if (await tryFillField(locator, value)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function tryFillByLabel(
  ctx: FillContext,
  labels: RegExp[],
  value: string,
): Promise<boolean> {
  if (!value.trim()) return false;

  for (const label of labels) {
    try {
      const locator = ctx.getByLabel(label).first();
      if (await tryFillField(locator, value)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function tryFillCoverLetter(page: Page, coverLetter: string): Promise<boolean> {
  if (!coverLetter.trim()) return false;

  const coverLabels = [
    /cover letter/i,
    /covering letter/i,
    /motivation/i,
    /why do you want/i,
    /why are you interested/i,
    /tell us about yourself/i,
    /additional information/i,
    /anything else/i,
    /comments/i,
  ];

  for (const ctx of contexts(page)) {
    if (await tryFillByLabel(ctx, coverLabels, coverLetter)) return true;

    const coverSelectors = [
      'textarea[name*="cover" i]',
      'textarea[id*="cover" i]',
      'textarea[data-field*="cover" i]',
      'textarea.question[data-type="long_text"]',
      '#cover_letter',
      '#cover-letter',
      '[name="job_application[cover_letter]"]',
      'textarea[aria-label*="cover" i]',
      'textarea[placeholder*="cover" i]',
    ];

    if (await tryFill(ctx, coverSelectors, coverLetter)) return true;

    // Greenhouse/Lever: label text near textarea (not always linked via for=)
    try {
      const labels = ctx.locator('label, legend, .label, h3, h4, p');
      const count = await labels.count();
      for (let i = 0; i < Math.min(count, 40); i++) {
        const label = labels.nth(i);
        const text = ((await label.textContent()) ?? '').toLowerCase();
        if (!coverLabels.some((re) => re.test(text))) continue;

        const container = label.locator('xpath=ancestor::*[self::div or self::fieldset][1]');
        const field = container.locator('textarea, [contenteditable="true"], [role="textbox"]').first();
        if (await tryFillField(field, coverLetter)) return true;

        const nextField = label.locator('xpath=following::textarea[1] | following::*[@contenteditable="true"][1]').first();
        if (await tryFillField(nextField, coverLetter)) return true;
      }
    } catch {
      // continue
    }

    // Last resort: largest empty visible textarea (usually the essay/cover field)
    try {
      const textareas = ctx.locator('textarea:visible');
      const count = await textareas.count();
      let bestIdx = -1;
      let bestSize = 0;
      for (let i = 0; i < count; i++) {
        const ta = textareas.nth(i);
        const val = (await ta.inputValue().catch(() => '')) || '';
        if (val.trim()) continue;
        const rows = parseInt((await ta.getAttribute('rows')) ?? '3', 10);
        if (rows >= bestSize) {
          bestSize = rows;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0 && await tryFillField(textareas.nth(bestIdx), coverLetter)) return true;
    } catch {
      // continue
    }
  }

  return false;
}

async function tryUploadResume(page: Page, resumePath: string): Promise<boolean> {
  const fileSelectors = [
    'input[type="file"][name*="resume" i]',
    'input[type="file"][id*="resume" i]',
    'input[type="file"][name*="cv" i]',
    'input[type="file"][id*="cv" i]',
    'input[type="file"][accept*="pdf" i]',
    'input[type="file"][accept*="doc" i]',
    'input[type="file"]',
  ];

  for (const ctx of contexts(page)) {
    for (const selector of fileSelectors) {
      try {
        const inputs = ctx.locator(selector);
        const count = await inputs.count();
        for (let i = 0; i < count; i++) {
          const input = inputs.nth(i);
          try {
            await input.setInputFiles(resumePath, { timeout: 5000 });
            await page.waitForTimeout(1500);
            return true;
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    // Greenhouse attach button → hidden file input
    try {
      const attachBtn = ctx.locator('button:has-text("Attach"), label:has-text("Attach"), :text("Upload")').first();
      if ((await attachBtn.count()) > 0 && (await attachBtn.isVisible())) {
        const fileInput = ctx.locator('input[type="file"]').first();
        if ((await fileInput.count()) > 0) {
          await fileInput.setInputFiles(resumePath, { timeout: 5000 });
          await page.waitForTimeout(1500);
          return true;
        }
      }
    } catch {
      // continue
    }
  }

  return false;
}

async function fillInAnyContext(
  page: Page,
  selectors: string[],
  labels: RegExp[],
  value: string,
): Promise<boolean> {
  for (const ctx of contexts(page)) {
    if (await tryFillByLabel(ctx, labels, value)) return true;
    if (await tryFill(ctx, selectors, value)) return true;
  }
  return false;
}

async function clickMaybeNewTab(page: Page, locator: ReturnType<Page['locator']>): Promise<Page> {
  const popupPromise = page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);

  await locator.click({ timeout: 5000 });

  const popup = await popupPromise;
  if (popup) {
    await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
    await popup.waitForTimeout(2000);
    return popup;
  }

  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForTimeout(2000);
  return page;
}

/** Navigate from a listing page to the actual application form. Returns the active page. */
export async function navigateToApplicationForm(page: Page): Promise<{ page: Page; note: string | null }> {
  if (isApplicationUrl(page.url())) {
    return { page, note: 'direct-application-url' };
  }

  const atsLinkSelectors = [
    'a[href*="greenhouse.io"]',
    'a[href*="lever.co"]',
    'a[href*="ashbyhq.com"]',
    'a[href*="workable.com"]',
    'a[href*="myworkdayjobs.com"]',
    'a[href*="smartrecruiters.com"]',
  ];

  for (const selector of atsLinkSelectors) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) continue;
      if (!(await locator.isVisible())) continue;
      const activePage = await clickMaybeNewTab(page, locator);
      if (isApplicationUrl(activePage.url())) {
        return { page: activePage, note: selector };
      }
    } catch {
      continue;
    }
  }

  const applySelectors = [
    'a:has-text("Apply for this job")',
    'a:has-text("Apply for this Job")',
    'a:has-text("Apply Now")',
    'a:has-text("Apply now")',
    'button:has-text("Apply Now")',
    'button:has-text("Apply now")',
    'a:has-text("Apply")',
    'button:has-text("Apply")',
    'a[href*="apply"]',
    'a[href*="application"]',
    '[data-testid*="apply"]',
  ];

  for (let step = 0; step < 2; step++) {
    for (const selector of applySelectors) {
      try {
        const locator = page.locator(selector).first();
        if ((await locator.count()) === 0) continue;
        if (!(await locator.isVisible())) continue;
        const activePage = await clickMaybeNewTab(page, locator);
        if (isApplicationUrl(activePage.url())) {
          return { page: activePage, note: selector };
        }
        page = activePage;
      } catch {
        continue;
      }
    }
  }

  return { page, note: null };
}

export async function fillApplicationForm(
  page: Page,
  fields: {
    name: string;
    email: string;
    coverLetter: string;
    phone?: string;
    resumePath?: string;
  },
): Promise<{ filled: string[]; missed: string[]; pageNote?: string }> {
  const filled: string[] = [];
  const missed: string[] = [];

  await page.waitForTimeout(1000);

  const [firstName, ...rest] = fields.name.trim().split(/\s+/);
  const lastName = rest.join(' ');

  const nameSelectors = [
    'input[name="name"]',
    'input[id="name"]',
    'input[name="full_name"]',
    'input[name="fullName"]',
    'input[name="applicant_name"]',
    'input[name="job_application[name]"]',
    'input[autocomplete="name"]',
    'input[placeholder*="full name" i]',
    'input[placeholder*="your name" i]',
    'input[placeholder*="name" i]',
    'input[aria-label*="name" i]',
  ];

  const firstNameSelectors = [
    'input[name="first_name"]',
    'input[name="firstName"]',
    'input[name="job_application[first_name]"]',
    'input[id="first_name"]',
    'input[id="firstName"]',
    'input[autocomplete="given-name"]',
    'input[placeholder*="first" i]',
  ];

  const lastNameSelectors = [
    'input[name="last_name"]',
    'input[name="lastName"]',
    'input[name="job_application[last_name]"]',
    'input[id="last_name"]',
    'input[id="lastName"]',
    'input[autocomplete="family-name"]',
    'input[placeholder*="last" i]',
  ];

  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[name="job_application[email]"]',
    'input[id="email"]',
    'input[name="email_address"]',
    'input[autocomplete="email"]',
    'input[placeholder*="email" i]',
  ];

  const phoneSelectors = [
    'input[type="tel"]',
    'input[name="phone"]',
    'input[name="job_application[phone]"]',
    'input[name="phone_number"]',
    'input[autocomplete="tel"]',
    'input[placeholder*="phone" i]',
  ];

  const nameLabels = [/full name/i, /^name$/i, /your name/i];
  const firstLabels = [/first name/i, /given name/i];
  const lastLabels = [/last name/i, /family name/i, /surname/i];
  const emailLabels = [/email/i, /e-mail/i];
  const phoneLabels = [/phone/i, /mobile/i, /telephone/i];

  let nameFilled = await fillInAnyContext(page, nameSelectors, nameLabels, fields.name);
  if (!nameFilled && firstName) {
    const firstOk = await fillInAnyContext(page, firstNameSelectors, firstLabels, firstName);
    const lastOk = lastName
      ? await fillInAnyContext(page, lastNameSelectors, lastLabels, lastName)
      : false;
    nameFilled = firstOk || lastOk;
  }

  if (nameFilled) filled.push('name');
  else missed.push('name');

  if (await fillInAnyContext(page, emailSelectors, emailLabels, fields.email)) {
    filled.push('email');
  } else {
    missed.push('email');
  }

  if (fields.phone) {
    if (await fillInAnyContext(page, phoneSelectors, phoneLabels, fields.phone)) {
      filled.push('phone');
    }
  }

  if (fields.resumePath) {
    if (await tryUploadResume(page, fields.resumePath)) {
      filled.push('resume');
    } else {
      missed.push('resume');
    }
  }

  if (fields.coverLetter.trim()) {
    if (await tryFillCoverLetter(page, fields.coverLetter)) {
      filled.push('coverLetter');
    } else {
      missed.push('coverLetter');
    }
  } else {
    missed.push('coverLetter');
  }

  let pageNote: string | undefined;
  if (filled.length === 0) {
    const hasForm = await page.locator('form, input, textarea').count().catch(() => 0);
    pageNote =
      hasForm === 0
        ? 'This page is not a direct application form. Clear old results, run a new search (now targets Greenhouse/Lever), then try a listing with "Apply" on an ATS site.'
        : 'A form was detected but fields could not be matched — the site may use a custom ATS, login wall, or iframe we could not access.';
  } else if (missed.includes('coverLetter') && fields.coverLetter.trim()) {
    pageNote =
      'Cover letter field not found — some ATS sites use custom editors or optional questions with different labels. Check the screenshot.';
  }

  return { filled, missed, pageNote };
}

export async function clickSubmitButton(page: Page): Promise<boolean> {
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit application")',
    'button:has-text("Submit Application")',
    'button:has-text("Submit")',
    'button:has-text("Apply")',
    'button:has-text("Send")',
    'a:has-text("Submit application")',
  ];

  for (const ctx of contexts(page)) {
    for (const selector of submitSelectors) {
      try {
        const locator = ctx.locator(selector).first();
        if ((await locator.count()) === 0) continue;
        if (!(await locator.isVisible())) continue;
        await locator.click({ timeout: 5000 });
        return true;
      } catch {
        continue;
      }
    }
  }

  return false;
}
