import type { UserProfile } from '../types/profile';

/** Fallback values when no resume is uploaded — override by uploading a CV at /profile */
export const profileDefaults: Omit<UserProfile, 'id' | 'rawResumeText' | 'resumeFilename' | 'resumeStoragePath' | 'updatedAt'> = {
  name: 'Your Name',
  email: process.env.NOTIFICATION_EMAIL ?? '',
  phone: process.env.WHATSAPP_TO ?? '',
  location: 'Your city, country',
  role: 'Software Engineer',
  skills: [],
  education: '',
  experience: [],
  languages: ['English'],
  jobTypes: ['Software Engineer', 'Full-Stack Developer', 'Remote Developer'],
  scholarshipTypes: ['STEM', 'Computer Science', 'Postgraduate'],
  salaryExpectation: 'Open to discussion',
};

export function mergeWithDefaults(partial: Partial<UserProfile>): UserProfile {
  return {
    ...profileDefaults,
    ...partial,
    skills: partial.skills?.length ? partial.skills : profileDefaults.skills,
    experience: partial.experience?.length ? partial.experience : profileDefaults.experience,
    languages: partial.languages?.length ? partial.languages : profileDefaults.languages,
    jobTypes: partial.jobTypes?.length ? partial.jobTypes : profileDefaults.jobTypes,
    scholarshipTypes: partial.scholarshipTypes?.length
      ? partial.scholarshipTypes
      : profileDefaults.scholarshipTypes,
  };
}

export function profileToTextFrom(profile: UserProfile): string {
  const career = profile.careerAnalysis;
  const careerBlock = career
    ? `
Career Level: ${career.careerLevel} (${career.seniorityLabel})
Years Experience: ${career.yearsExperience ?? 'unknown'}
Primary Domain: ${career.primaryDomain}
Target Roles: ${career.targetRoles.join(', ')}
Appropriate Levels: ${career.appropriateJobLevels.join(', ')}
Strengths: ${career.strengths.join(', ')}`
    : '';

  return `
Name: ${profile.name}
Email: ${profile.email}
Location: ${profile.location}
Role: ${profile.role}
Skills: ${profile.skills.join(', ') || 'Not specified'}
Education: ${profile.education || 'Not specified'}
Experience: ${profile.experience.join(', ') || 'Not specified'}
Languages: ${profile.languages.join(', ')}
Job Types Sought: ${profile.jobTypes.join(', ')}
Scholarship Types Sought: ${profile.scholarshipTypes.join(', ')}
Salary Expectation: ${profile.salaryExpectation}${careerBlock}
`.trim();
}
