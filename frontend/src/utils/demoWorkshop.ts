import type { WorkshopResponse } from '../services/api';

export const DEMO_WORKSHOP_ID = 'demo-public-speaking-masterclass';

export const DEMO_WORKSHOP: WorkshopResponse = {
  id: DEMO_WORKSHOP_ID,
  tutor_id: '',
  tutor_user_id: '',
  title: 'Public Speaking Masterclass for Students',
  description:
    'Build confident communication, stage presence, and structured speaking through practical activities. This workshop is designed for school and college learners who want to present clearly and confidently.',
  modules: [
    'Voice confidence and body language',
    'How to structure speeches and presentations',
    'Overcoming stage fear with practical drills',
    'Q&A handling and audience engagement',
    'Final speaking activity with feedback',
  ],
  thumbnail_url:
    'https://images.unsplash.com/photo-1544531585-9847b68c8c86?auto=format&fit=crop&w=1200&q=80',
  amount: 499,
  currency: 'INR',
  scheduled_at: '2026-05-10T10:00:00.000Z',
  duration_minutes: 120,
  max_participants: 50,
  is_active: true,
  tutor_name: 'Zeal Catalyst Expert Team',
  tutor_email: 'coo@zealcatalyst.com',
  created_at: '2026-04-07T00:00:00.000Z',
  updated_at: '2026-04-07T00:00:00.000Z',
};
