export const DEFAULT_SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Computer Science',
  'Data Science',
  'Web Development',
  'Python',
  'Spanish',
  'French',
  'UI/UX Design',
];

export const DEFAULT_COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'India',
  'Australia',
  'Germany',
  'Spain',
  'France',
  'South Korea',
  'Japan',
];

export const DEFAULT_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Mandarin',
  'Hindi',
  'Korean',
];

export const SEARCH_SYNONYMS: Record<string, string> = {
  maths: 'mathematics',
  math: 'mathematics',
  cs: 'computer science',
  compsci: 'computer science',
  ai: 'artificial intelligence',
  ml: 'machine learning',
  ds: 'data science',
  eng: 'english',
};

export const HERO_SEARCH_SUGGESTIONS = [
  ...DEFAULT_SUBJECTS,
  'Global cuisines',
  'Ancient And traditional skills',
  'Counselling',
  'College workshop training',
  'Corporate training',
  'Student skill development program',
];

export const normalizeSearchTerm = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (SEARCH_SYNONYMS[normalized]) return SEARCH_SYNONYMS[normalized];

  return normalized
    .split(' ')
    .map((token) => SEARCH_SYNONYMS[token] || token)
    .join(' ');
};

export const resolveSubjectFilterFromQuery = (
  value: string,
  subjects: string[] = DEFAULT_SUBJECTS
): string | undefined => {
  const normalized = normalizeSearchTerm(value);
  if (!normalized) return undefined;

  return subjects.find((subject) => subject.toLowerCase() === normalized);
};
