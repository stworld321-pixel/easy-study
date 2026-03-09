import type { TutorProfile } from '../types';

const slugify = (value: string) =>
  (value || '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildTutorSlug = (tutor: TutorProfile): string => {
  const name = slugify(tutor.full_name || 'tutor');
  const subject = slugify((tutor.subjects && tutor.subjects[0]) || 'general');
  const city = slugify(tutor.city || 'online');
  return `${name}-${subject}-tutor-${city}`;
};

export const buildTutorMetaDescription = (tutor: TutorProfile): string => {
  const subjects = tutor.subjects?.length ? tutor.subjects.join(', ') : 'multiple subjects';
  const name = tutor.full_name || 'our tutor';
  const years = tutor.experience_years || 0;
  const students = tutor.total_students || 0;
  const lessons = tutor.total_lessons || 0;
  return `Learn ${subjects} with ${name}, an experienced tutor with ${years} years teaching experience. ${students}+ students and ${lessons}+ lessons completed. Book an online lesson today.`;
};

export const ensureMetaTag = (name: string, content: string): void => {
  let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

export const ensurePropertyMetaTag = (property: string, content: string): void => {
  let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

