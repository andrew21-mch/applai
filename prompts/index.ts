import { PARSE_RESUME_PROMPT } from './parseResume';
import { FILTER_SCORE_PROMPT } from './filterScore';
import { COVER_LETTER_PROMPT } from './coverLetter';
import { SCHOLARSHIP_ESSAY_PROMPT } from './scholarshipEssay';
import { EXTRACT_OPPORTUNITY_PROMPT } from './extractOpportunity';
import { CAREER_ANALYSIS_PROMPT } from './careerAnalysis';
import { FORM_FIELD_SUGGESTIONS_PROMPT } from './formFieldSuggestions';

export {
  FILTER_SCORE_PROMPT,
  COVER_LETTER_PROMPT,
  SCHOLARSHIP_ESSAY_PROMPT,
  EXTRACT_OPPORTUNITY_PROMPT,
  PARSE_RESUME_PROMPT,
  CAREER_ANALYSIS_PROMPT,
  FORM_FIELD_SUGGESTIONS_PROMPT,
};

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), value),
    template,
  );
}
