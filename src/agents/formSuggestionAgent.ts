import { FORM_FIELD_SUGGESTIONS_PROMPT, fillTemplate } from '../../prompts';
import { profileCareerSummary } from './profileAnalysisAgent';
import { completeJson } from '../services/ollama';
import { logger } from '../utils/logger';
import type { ScannedFormField } from '../utils/formScan';
import type { UserProfile } from '../types/profile';

export interface FormFieldSuggestion {
  fieldKey: string;
  suggestedAnswer: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'profile' | 'draft' | 'ai';
  reason?: string;
}

interface RawSuggestion {
  fieldKey?: string;
  suggestedAnswer?: string;
  confidence?: string;
  source?: string;
  reason?: string;
}

function heuristicSuggestion(
  field: ScannedFormField,
  profile: UserProfile,
  coverLetter: string,
): FormFieldSuggestion | null {
  const label = `${field.label ?? ''} ${field.placeholder ?? ''} ${field.name ?? ''}`.toLowerCase();

  if (/file|upload|resume|cv|curriculum/i.test(label) || field.inputType === 'file') {
    return {
      fieldKey: field.fieldKey,
      suggestedAnswer: profile.resumeFilename ? `Upload: ${profile.resumeFilename}` : 'Upload resume from profile',
      confidence: 'high',
      source: 'profile',
      reason: 'Resume file on profile',
    };
  }

  if (/email|e-mail/i.test(label) && profile.email) {
    return { fieldKey: field.fieldKey, suggestedAnswer: profile.email, confidence: 'high', source: 'profile' };
  }
  if (/phone|mobile|tel/i.test(label) && profile.phone) {
    return { fieldKey: field.fieldKey, suggestedAnswer: profile.phone, confidence: 'high', source: 'profile' };
  }
  if (/first.?name|given/i.test(label)) {
    const first = profile.name.split(/\s+/)[0];
    if (first) return { fieldKey: field.fieldKey, suggestedAnswer: first, confidence: 'high', source: 'profile' };
  }
  if (/last.?name|family|surname/i.test(label)) {
    const parts = profile.name.split(/\s+/);
    const last = parts.length > 1 ? parts.slice(1).join(' ') : '';
    if (last) return { fieldKey: field.fieldKey, suggestedAnswer: last, confidence: 'high', source: 'profile' };
  }
  if (/full.?name|^name$/i.test(label) && profile.name) {
    return { fieldKey: field.fieldKey, suggestedAnswer: profile.name, confidence: 'high', source: 'profile' };
  }
  if (/location|city|address/i.test(label) && profile.location) {
    return { fieldKey: field.fieldKey, suggestedAnswer: profile.location, confidence: 'high', source: 'profile' };
  }
  if (/cover.?letter|motivation|why.*role|why.*join/i.test(label) && coverLetter) {
    return { fieldKey: field.fieldKey, suggestedAnswer: coverLetter, confidence: 'high', source: 'draft' };
  }
  if (/years.*experience|experience.*years/i.test(label) && profile.careerAnalysis?.yearsExperience != null) {
    return {
      fieldKey: field.fieldKey,
      suggestedAnswer: String(profile.careerAnalysis.yearsExperience),
      confidence: 'medium',
      source: 'profile',
      reason: 'From career analysis',
    };
  }
  if (/salary|compensation|pay/i.test(label) && profile.salaryExpectation) {
    return {
      fieldKey: field.fieldKey,
      suggestedAnswer: profile.salaryExpectation,
      confidence: 'medium',
      source: 'profile',
    };
  }

  return null;
}

export async function suggestFormFieldAnswers(
  fields: ScannedFormField[],
  profile: UserProfile,
  coverLetter = '',
): Promise<FormFieldSuggestion[]> {
  const suggestions: FormFieldSuggestion[] = [];
  const needsAi: ScannedFormField[] = [];

  for (const field of fields) {
    const heuristic = heuristicSuggestion(field, profile, coverLetter);
    if (heuristic) {
      suggestions.push(heuristic);
    } else if (field.inputType !== 'file') {
      needsAi.push(field);
    }
  }

  if (needsAi.length === 0) return suggestions;

  const fieldsJson = JSON.stringify(
    needsAi.map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      name: f.name,
      type: f.inputType,
      placeholder: f.placeholder,
      required: f.required,
      options: f.options.length ? f.options : undefined,
    })),
  );

  const prompt = fillTemplate(FORM_FIELD_SUGGESTIONS_PROMPT, {
    PROFILE: profileCareerSummary(profile),
    CAREER_LEVEL: profile.careerAnalysis?.seniorityLabel ?? profile.role,
    COVER_LETTER: coverLetter.slice(0, 2000) || 'none',
    FIELDS_JSON: fieldsJson,
  });

  try {
    const raw = await completeJson<RawSuggestion[] | { suggestions: RawSuggestion[] }>(prompt, 1536);
    const list = Array.isArray(raw) ? raw : (raw as { suggestions: RawSuggestion[] }).suggestions ?? [];

    for (const item of list) {
      if (!item.fieldKey || !item.suggestedAnswer?.trim()) continue;
      suggestions.push({
        fieldKey: item.fieldKey,
        suggestedAnswer: item.suggestedAnswer.trim(),
        confidence: (['high', 'medium', 'low'].includes(item.confidence ?? '')
          ? item.confidence
          : 'low') as FormFieldSuggestion['confidence'],
        source: (['profile', 'draft', 'ai'].includes(item.source ?? '')
          ? item.source
          : 'ai') as FormFieldSuggestion['source'],
        reason: item.reason,
      });
    }
  } catch (err) {
    logger.warn('AI form suggestions failed', err);
  }

  return suggestions;
}

export function mergeFieldsWithSuggestions(
  fields: ScannedFormField[],
  suggestions: FormFieldSuggestion[],
): Array<ScannedFormField & { suggestion?: FormFieldSuggestion }> {
  const byKey = new Map(suggestions.map((s) => [s.fieldKey, s]));
  return fields.map((field) => ({
    ...field,
    suggestion: byKey.get(field.fieldKey),
  }));
}
