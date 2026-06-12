/** Hosts/paths that typically host real application forms */
const APPLICATION_HOSTS = [
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.lever.co',
  'jobs.ashbyhq.com',
  'apply.workable.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
  'bamboohr.com',
  'icims.com',
  'taleo.net',
];

const BLOCKED_URL_PATTERNS = [
  /linkedin\.com\/in\//i,
  /linkedin\.com\/pub\//i,
  /\/jobs\/[a-z0-9-]+-jobs\/?$/i,
  /\/careers\/?$/i,
  /\/jobs\/?$/i,
  /facebook\.com/i,
  /twitter\.com/i,
  /x\.com/i,
  /instagram\.com/i,
];

export function isApplicationUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    if (APPLICATION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return true;
    if (/greenhouse\.io/i.test(host)) return true;
    if (/lever\.co/i.test(host)) return true;
    if (/ashbyhq\.com/i.test(host)) return true;
    if (/\/jobs\/\d+/i.test(u.pathname)) return true;
    if (/\/job\/[^/]+/i.test(u.pathname)) return true;
    if (/\/apply/i.test(u.pathname)) return true;

    return false;
  } catch {
    return false;
  }
}

export function isBlockedListingUrl(url: string): boolean {
  if (isApplicationUrl(url)) return false;
  return BLOCKED_URL_PATTERNS.some((p) => p.test(url));
}

/** Single job pages on boards that link out to ATS apply forms */
function isJobBoardListing(url: string): boolean {
  return (
    /remotive\.com\/remote-jobs\/[^/]+/i.test(url) ||
    /weworkremotely\.com\/remote-jobs\/[^/]+/i.test(url) ||
    /remoteok\.com\/remote-[^/]+/i.test(url)
  );
}

/** Only save URLs we can realistically auto-apply to (or navigate to apply from) */
export function isSavableJobUrl(url: string): boolean {
  if (!url.startsWith('http')) return false;
  if (isBlockedListingUrl(url)) return false;
  return isApplicationUrl(url) || isJobBoardListing(url);
}

export const ATS_SEARCH_SITES =
  'site:boards.greenhouse.io OR site:job-boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com OR site:apply.workable.com OR site:remotive.com OR site:weworkremotely.com';
