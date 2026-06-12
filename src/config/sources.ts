import type { UserProfile } from '../types/profile';
import { ATS_SEARCH_SITES } from '../utils/applicationUrls';

export interface SearchQuery {
  query: string;
  type: 'job' | 'scholarship';
}

const YEAR = new Date().getFullYear();

function dedupe(queries: SearchQuery[]): SearchQuery[] {
  const seen = new Set<string>();
  return queries.filter((q) => {
    if (seen.has(q.query)) return false;
    seen.add(q.query);
    return true;
  });
}

function rolesFromExperience(experience: string[]): string[] {
  const roles: string[] = [];
  for (const line of experience) {
    const title = line.split(/\s+at\s+/i)[0]?.split(/[—–-]/)[0]?.trim();
    if (title && title.length > 3) roles.push(title);
  }
  return roles;
}

/** Build Tavily queries using only resume-extracted profile fields */
export function buildSearchQueriesFromProfile(profile: UserProfile): SearchQuery[] {
  const skills = profile.skills.slice(0, 5);
  const skillPhrase = skills.join(' ');
  const roles = new Set<string>();

  if (profile.role?.trim()) roles.add(profile.role.trim());
  for (const title of rolesFromExperience(profile.experience)) roles.add(title);

  const queries: SearchQuery[] = [];

  for (const role of roles) {
    queries.push({
      query: skillPhrase
        ? `remote ${role} ${skillPhrase} jobs ${YEAR} ${ATS_SEARCH_SITES}`
        : `remote ${role} jobs ${YEAR} ${ATS_SEARCH_SITES}`,
      type: 'job',
    });
  }

  if (roles.size === 0 && skillPhrase) {
    queries.push({
      query: `remote ${skillPhrase} jobs ${YEAR} ${ATS_SEARCH_SITES}`,
      type: 'job',
    });
  }

  const education = profile.education?.trim();
  if (education) {
    const eduLabel = education.split(/[—–-]/)[0].trim();
    queries.push({
      query: skillPhrase
        ? `scholarships ${eduLabel} ${skillPhrase} ${YEAR}`
        : `scholarships ${eduLabel} ${YEAR}`,
      type: 'scholarship',
    });
  }

  return dedupe(queries);
}

export function getSearchQueries(profile: UserProfile): SearchQuery[] {
  if (!profile.rawResumeText) return [];
  return buildSearchQueriesFromProfile(profile);
}

export const jobBoardDomains = [
  'linkedin.com',
  'remotive.com',
  'weworkremotely.com',
  'indeed.com',
  'glassdoor.com',
  'remoteok.com',
];

export const scholarshipDomains = [
  'scholars4dev.com',
  'opportunitiesforafricans.com',
  'afterschoolafrica.com',
  'mastersportal.com',
  'scholarship-positions.com',
];
